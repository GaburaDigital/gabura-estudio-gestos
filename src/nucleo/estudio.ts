// O "cérebro" do Estúdio, sem desenho: qual ação e qual gesto estão escolhidos, a contagem, a gravação, as
// tentativas, as observações, os ajustes de cada gesto, a biblioteca de preparações e o modo testar.
// A página (PC) e o menu do VR só chamam estas funções e desenham o estado. Assim os testes automáticos conseguem
// gravar e testar gestos sem óculos (só chamando `quadroVR`).

import { AJUSTES_PADRAO, LIMITES, acoesDoGesto, gestoPorId, idValido, todasAcoes, type Acao, type AjustesGesto, type Configuracao, type Gesto, type Modo, type Texto } from './config';
import { Armazem, type NotasAcao, type Projeto } from './armazem';
import { acharTrecho, alturaDosOlhos, amostraParaQuadro, type Amostra, type EventoPC, type Gravacao } from './gravacao';
import { Reconhecedor, fichasPC, type EventoReconhecido } from './reconhecedor';

export type Estado = 'parado' | 'contagem' | 'gravando' | 'testando';

export class Estudio {
  config: Configuracao | null = null;
  notas: Record<string, NotasAcao> = {};
  gravacoes: Gravacao[] = [];
  modo: Modo = 'vr';
  acaoIdx = 0;
  /** Gesto escolhido (um passo ou uma alternativa da ação, ou uma preparação da biblioteca). */
  gestoId: string | null = null;
  estado: Estado = 'parado';
  falta = 0;
  aviso: { chave: string; valor?: string } | null = null;
  reconhecedor: Reconhecedor | null = null;
  aoMudar: () => void = () => {};
  aoReconhecer: (e: EventoReconhecido) => void = () => {};
  /** A gravação que acabou de ser feita (o boneco repete na hora). */
  ultimaGravada: Gravacao | null = null;

  private quadros: number[][] = [];
  private eventos: EventoPC[] = [];
  private t0 = 0;
  private fimContagem = 0;
  private fimGravacao = 0;
  private gravandoGesto: Gesto | null = null;

  constructor(readonly armazem: Armazem) {}

  // ---------------- projeto ----------------
  /** Abre um projeto. Com `manterEdicoes`, uma configuração nova do mesmo projeto não apaga as preparações
   *  criadas e os ajustes feitos no Estúdio. */
  async abrirProjeto(config: Configuracao, notas?: Record<string, NotasAcao>, gravacoes?: Gravacao[], manterEdicoes = true): Promise<void> {
    const antigo = await this.armazem.lerProjeto(config.projeto);
    if (manterEdicoes && antigo?.config?.gestos) config = juntarEdicoes(config, antigo.config);
    this.config = config;
    this.notas = { ...(antigo?.notas ?? {}), ...(notas ?? {}) };
    if (gravacoes) for (const g of gravacoes) await this.armazem.salvarGravacao(config.projeto, g);
    await this.salvarProjeto();
    this.gravacoes = await this.armazem.gravacoes(config.projeto);
    this.estado = 'parado'; this.reconhecedor = null;
    this.escolher(0);
    this.aoMudar();
  }
  private async salvarProjeto(): Promise<void> {
    if (!this.config) return;
    const p: Projeto = { projeto: this.config.projeto, config: this.config, notas: this.notas, atualizado: '' };
    await this.armazem.salvarProjeto(p);
  }

  get acoes(): Acao[] { return this.config ? todasAcoes(this.config).filter((a) => a.plataformas.includes(this.modo)) : []; }
  get acao(): Acao | null { return this.acoes[this.acaoIdx] ?? null; }
  get gesto(): Gesto | null { return this.config && this.gestoId ? gestoPorId(this.config, this.gestoId) ?? null : null; }
  get repeticoes(): number { return this.config?.gravacao.repeticoes ?? 5; }
  get preparacoes(): Gesto[] { return this.config?.gestos.filter((g) => g.tipo === 'preparacao') ?? []; }

  tentativas(gesto: string, modo = this.modo): Gravacao[] {
    return this.gravacoes.filter((g) => g.gesto === gesto && g.modo === modo).sort((a, b) => a.n - b.n);
  }
  /** Quantos gestos da ação estão completos e quantos são. */
  progressoDaAcao(a: Acao, modo = this.modo): { feitos: number; total: number } {
    const gs = [...new Set(a.passos.flatMap((p) => p.alternativas.map((x) => x.gesto)))];
    return { feitos: gs.filter((g) => this.tentativas(g, modo).length >= this.repeticoes).length, total: gs.length };
  }

  trocarModo(m: Modo): void {
    if (this.ocupado) return;
    this.modo = m; this.estado = 'parado'; this.reconhecedor = null; this.escolher(0);
    this.aoMudar();
  }
  get ocupado(): boolean { return this.estado === 'contagem' || this.estado === 'gravando'; }

  /** Escolhe a ação (e o primeiro gesto dela). */
  escolher(acaoIdx: number): void {
    if (this.ocupado) return;
    const n = this.acoes.length; if (!n) { this.gestoId = null; return; }
    this.acaoIdx = ((acaoIdx % n) + n) % n;
    this.gestoId = this.acao!.passos[0].alternativas[0].gesto;
    this.aviso = null; this.aoMudar();
  }
  escolherPorId(acao: string, gesto?: string): void {
    const i = this.acoes.findIndex((a) => a.id === acao); if (i < 0) return;
    this.escolher(i);
    if (gesto) this.escolherGesto(gesto);
  }
  escolherGesto(gesto: string): void {
    if (this.ocupado || !this.config || !gestoPorId(this.config, gesto)) return;
    this.gestoId = gesto; this.aviso = null; this.aoMudar();
  }

  async salvarNotas(acao: string, n: Partial<NotasAcao>): Promise<void> {
    this.notas[acao] = { ...{ observacoes: '' }, ...(this.notas[acao] ?? {}), ...n };
    await this.salvarProjeto();
  }

  // ---------------- ajustes e biblioteca ----------------
  /** Muda um ajuste do gesto (o que conta, espelhado, tempo, segurar, tolerância). Vale para todas as ações que o usam. */
  async ajustar(gesto: string, a: Partial<AjustesGesto>): Promise<void> {
    const g = this.config && gestoPorId(this.config, gesto); if (!g) return;
    const lim = (v: number, [min, max]: readonly [number, number]) => Math.round(Math.min(max, Math.max(min, v)) * 100) / 100;
    if (a.duracao !== undefined) a.duracao = lim(a.duracao, LIMITES.duracao);
    if (a.segurar !== undefined) a.segurar = lim(a.segurar, LIMITES.segurar);
    if (a.tolerancia !== undefined) a.tolerancia = lim(a.tolerancia, LIMITES.tolerancia);
    g.ajustes = { ...g.ajustes, ...a }; g.editado = true;
    await this.salvarProjeto();
    if (this.estado === 'testando') this.prepararTeste();
    this.aoMudar();
  }

  /** Cria uma preparação nova na biblioteca (com um nome) e devolve o id. */
  async criarPreparacao(nome: string): Promise<string | null> {
    if (!this.config) return null;
    const base = 'prep_' + nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    let id = idValido(base) ? base : 'prep_' + Date.now().toString(36); let i = 2;
    while (gestoPorId(this.config, id)) id = `${base}_${i++}`.slice(0, 40);
    const t: Texto = { pt: nome.slice(0, 60), en: nome.slice(0, 60) };
    this.config.gestos.push({ id, nome: t, tipo: 'preparacao', sugestao: { pt: '', en: '' }, sugestao_pc: null, ajustes: { ...AJUSTES_PADRAO, conta: 'mao_dir', espelhado: true, duracao: 2, segurar: 0.3 } });
    await this.salvarProjeto(); this.aoMudar();
    return id;
  }
  /** Põe uma preparação da biblioteca na ação, antes do último passo (o de liberar). */
  async adicionarPreparacao(acao: string, gesto: string): Promise<void> {
    const a = this.config && todasAcoes(this.config).find((x) => x.id === acao), g = this.config && gestoPorId(this.config, gesto);
    if (!a || !g || a.passos.length >= 6) return;
    let pid = 'preparar', i = 2; while (a.passos.some((p) => p.id === pid)) pid = 'preparar_' + i++;
    a.passos.splice(Math.max(0, a.passos.length - 1), 0, { id: pid, nome: g.nome, alternativas: [{ id: pid, nome: g.nome, gesto: g.id, efeito: null }] });
    await this.salvarProjeto(); this.escolherGesto(gesto); this.aoMudar();
  }
  /** Tira um passo de preparação da ação (os outros passos não podem ser tirados). */
  async removerPreparacao(acao: string, passo: string): Promise<void> {
    const a = this.config && todasAcoes(this.config).find((x) => x.id === acao); if (!a) return;
    const i = a.passos.findIndex((p) => p.id === passo);
    const g = i >= 0 ? gestoPorId(this.config!, a.passos[i].alternativas[0].gesto) : null;
    if (i < 0 || g?.tipo !== 'preparacao') return;
    a.passos.splice(i, 1);
    if (this.gestoId === g.id) this.gestoId = a.passos[0].alternativas[0].gesto;
    await this.salvarProjeto(); this.aoMudar();
  }
  async renomearGesto(gesto: string, nome: string): Promise<void> {
    const g = this.config && gestoPorId(this.config, gesto); if (!g || !nome.trim()) return;
    g.nome = { pt: nome.slice(0, 60), en: nome.slice(0, 60) }; g.editado = true;
    await this.salvarProjeto(); this.aoMudar();
  }
  /** Ações que usam o gesto (para avisar que regravar muda em todas). */
  usosDoGesto(gesto: string): Acao[] { return this.config ? acoesDoGesto(this.config, gesto) : []; }

  // ---------------- gravar ----------------
  gravar(agora: number): boolean {
    const g = this.gesto;
    if (!g || this.ocupado || this.estado === 'testando') return false;
    if (this.tentativas(g.id).length >= this.repeticoes) { this.aviso = { chave: 'cheio' }; this.aoMudar(); return false; }
    this.estado = 'contagem'; this.quadros = []; this.eventos = []; this.gravandoGesto = g;
    this.fimContagem = agora + (this.config?.gravacao.contagem ?? 3);
    this.fimGravacao = this.fimContagem + g.ajustes.duracao;
    this.falta = this.fimContagem - agora; this.aviso = null;
    this.aoMudar();
    return true;
  }
  /** Para a contagem ou a gravação sem guardar. */
  cancelar(): void { if (this.ocupado) { this.estado = 'parado'; this.aviso = { chave: 'cancelou' }; this.aoMudar(); } }

  quadroVR(a: Amostra, agora: number): EventoReconhecido[] {
    if (this.estado === 'testando') {
      if (this.modo !== 'vr') return [];
      const ev = this.reconhecedor?.amostra(a, this.alturaTeste) ?? [];
      for (const e of ev) this.aoReconhecer(e);
      return ev;
    }
    this.tempo(agora);
    if (this.estado === 'gravando' && this.modo === 'vr') {
      if (!this.quadros.length) this.t0 = a.t;
      this.quadros.push(amostraParaQuadro(a, this.t0));
    }
    return [];
  }

  eventoPC(e: Omit<EventoPC, 't'>, agora: number): EventoReconhecido[] {
    if (this.estado === 'testando' && this.modo === 'pc') {
      const ev = this.reconhecedor?.evento({ ...e, t: agora }) ?? [];
      for (const x of ev) this.aoReconhecer(x);
      return ev;
    }
    this.tempo(agora);
    if (this.estado === 'gravando' && this.modo === 'pc') this.eventos.push({ ...e, t: Math.round((agora - this.fimContagem) * 1000) / 1000 });
    return [];
  }

  tempo(agora: number): void {
    if (this.estado === 'contagem') {
      this.falta = this.fimContagem - agora;
      if (agora >= this.fimContagem) { this.estado = 'gravando'; this.falta = this.fimGravacao - agora; this.aoMudar(); }
    } else if (this.estado === 'gravando') {
      this.falta = this.fimGravacao - agora;
      if (agora >= this.fimGravacao) void this.terminarGravacao();
    }
  }

  private async terminarGravacao(): Promise<void> {
    const ge = this.gravandoGesto!, cfg = this.config!;
    this.estado = 'parado';
    const usados = new Set(this.tentativas(ge.id).map((g) => g.n));
    let n = 1; while (usados.has(n)) n++;
    const g: Gravacao = { versao_formato: 2, modo: this.modo, gesto: ge.id, n, data: new Date().toISOString(), duracao: ge.ajustes.duracao };
    if (this.modo === 'vr') {
      if (this.quadros.length < 3) { this.aviso = { chave: 'semDados' }; this.aoMudar(); return; }
      g.quadros = this.quadros; g.altura_olhos = alturaDosOlhos(this.quadros);
      Object.assign(g, acharTrecho(this.quadros));
    } else {
      if (!fichasPC(this.eventos).length) { this.aviso = { chave: 'semTeclas' }; this.aoMudar(); return; }
      g.eventos = this.eventos;
    }
    this.gravacoes.push(g);
    await this.armazem.salvarGravacao(cfg.projeto, g);
    this.aviso = { chave: 'gravou', valor: `${this.tentativas(ge.id).length}/${this.repeticoes}` };
    this.ultimaGravada = g;
    this.aoMudar();
  }

  async apagar(g: Pick<Gravacao, 'modo' | 'gesto' | 'n'>): Promise<void> {
    if (!this.config) return;
    await this.armazem.apagarGravacao(this.config.projeto, g);
    this.gravacoes = this.gravacoes.filter((x) => !(x.modo === g.modo && x.gesto === g.gesto && x.n === g.n));
    this.aviso = { chave: 'apagou' };
    this.aoMudar();
  }
  async apagarUltima(): Promise<void> {
    const g = this.gesto; if (!g) return;
    const ts = this.tentativas(g.id); const u = ts[ts.length - 1];
    if (u) await this.apagar(u);
  }

  // ---------------- testar ----------------
  private alturaTeste = 1.6;
  alternarTeste(alturaOlhos = 1.6): void {
    if (this.ocupado) return;
    if (this.estado === 'testando') { this.estado = 'parado'; this.reconhecedor = null; }
    else { this.alturaTeste = alturaOlhos; this.prepararTeste(); this.estado = 'testando'; }
    this.aoMudar();
  }
  private prepararTeste(): void {
    if (this.config) this.reconhecedor = new Reconhecedor(this.config, this.modo, this.gravacoes);
  }
}

/** Uma configuração nova do mesmo projeto, com o que foi feito no Estúdio: preparações criadas, ajustes dos gestos
 *  e preparações postas nas ações continuam. */
function juntarEdicoes(nova: Configuracao, antiga: Configuracao): Configuracao {
  const r = structuredClone(nova);
  for (const g of antiga.gestos) {
    const x = gestoPorId(r, g.id);
    if (x) { if (g.editado) { x.ajustes = { ...g.ajustes }; x.nome = g.nome; x.editado = true; } } // só o que foi mudado no Estúdio
    else if (g.tipo === 'preparacao') r.gestos.push(structuredClone(g));
  }
  for (const a of todasAcoes(antiga)) {
    const x = todasAcoes(r).find((y) => y.id === a.id); if (!x) continue;
    a.passos.forEach((p, i) => {
      const g = gestoPorId(antiga, p.alternativas[0].gesto);
      if (g?.tipo !== 'preparacao' || x.passos.some((q) => q.alternativas.some((z) => z.gesto === g.id))) return;
      x.passos.splice(Math.min(i, x.passos.length - 1), 0, structuredClone(p));
    });
    // passos de preparação que a configuração nova tem e que foram tirados no Estúdio continuam fora
    x.passos = x.passos.filter((p) => { const g = gestoPorId(r, p.alternativas[0].gesto); return g?.tipo !== 'preparacao' || a.passos.some((q) => q.id === p.id) || !antiga.gestos.some((z) => z.id === g.id); });
  }
  return r;
}
