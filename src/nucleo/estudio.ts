// O "cérebro" do Estúdio, sem desenho: qual ação e parte estão escolhidas, a contagem, a gravação, as tentativas
// guardadas, as observações e o modo testar. A página (PC) e o painel do VR só chamam estas funções e desenham o
// estado. Assim os testes automáticos conseguem gravar e testar gestos sem óculos (só chamando `quadroVR`).

import { todasAcoes, type Acao, type Configuracao, type Modo } from './config';
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
  parteIdx = 0;
  estado: Estado = 'parado';
  /** Segundos que faltam na contagem ou na gravação (para a tela). */
  falta = 0;
  /** Última mensagem para quem está gravando (PT/EN fica na tela). */
  aviso: { chave: string; valor?: string } | null = null;
  reconhecedor: Reconhecedor | null = null;
  /** Quem quer saber de mudanças (tela, painel do VR). */
  aoMudar: () => void = () => {};
  aoReconhecer: (e: EventoReconhecido) => void = () => {};

  private quadros: number[][] = [];
  private eventos: EventoPC[] = [];
  private t0 = 0;
  private fimContagem = 0;
  private fimGravacao = 0;

  constructor(readonly armazem: Armazem) {}

  // ---------------- projeto ----------------
  async abrirProjeto(config: Configuracao, notas?: Record<string, NotasAcao>, gravacoes?: Gravacao[]): Promise<void> {
    const antigo = await this.armazem.lerProjeto(config.projeto);
    this.config = config;
    this.notas = { ...(antigo?.notas ?? {}), ...(notas ?? {}) };
    if (gravacoes) for (const g of gravacoes) await this.armazem.salvarGravacao(config.projeto, g);
    await this.salvarProjeto();
    this.gravacoes = await this.armazem.gravacoes(config.projeto);
    this.acaoIdx = 0; this.parteIdx = 0; this.estado = 'parado'; this.reconhecedor = null;
    this.ajustarAcaoAoModo();
    this.aoMudar();
  }
  private async salvarProjeto(): Promise<void> {
    if (!this.config) return;
    const p: Projeto = { projeto: this.config.projeto, config: this.config, notas: this.notas, atualizado: '' };
    await this.armazem.salvarProjeto(p);
  }

  get acoes(): Acao[] { return this.config ? todasAcoes(this.config).filter((a) => a.plataformas.includes(this.modo)) : []; }
  get acao(): Acao | null { return this.acoes[this.acaoIdx] ?? null; }
  get parte() { return this.acao?.partes[this.parteIdx] ?? null; }
  get repeticoes(): number { return this.config?.gravacao.repeticoes ?? 5; }

  tentativas(acao: string, parte: string, modo = this.modo): Gravacao[] {
    return this.gravacoes.filter((g) => g.acao === acao && g.parte === parte && g.modo === modo).sort((a, b) => a.n - b.n);
  }
  /** Quantas partes da ação estão completas (com todas as gravações). */
  completas(a: Acao, modo = this.modo): number {
    return a.partes.filter((p) => this.tentativas(a.id, p.id, modo).length >= this.repeticoes).length;
  }

  trocarModo(m: Modo): void {
    if (this.estado === 'contagem' || this.estado === 'gravando') return;
    this.modo = m; this.estado = 'parado'; this.reconhecedor = null; this.acaoIdx = 0; this.parteIdx = 0;
    this.aoMudar();
  }
  private ajustarAcaoAoModo(): void { this.acaoIdx = Math.min(this.acaoIdx, Math.max(0, this.acoes.length - 1)); this.parteIdx = Math.min(this.parteIdx, Math.max(0, (this.acao?.partes.length ?? 1) - 1)); }

  escolher(acaoIdx: number, parteIdx = 0): void {
    if (this.estado === 'contagem' || this.estado === 'gravando') return;
    const n = this.acoes.length; if (!n) return;
    this.acaoIdx = ((acaoIdx % n) + n) % n;
    const np = this.acao!.partes.length;
    this.parteIdx = ((parteIdx % np) + np) % np;
    this.aviso = null; this.aoMudar();
  }
  escolherPorId(acao: string, parte?: string): void {
    const i = this.acoes.findIndex((a) => a.id === acao); if (i < 0) return;
    this.escolher(i, parte ? Math.max(0, this.acoes[i].partes.findIndex((p) => p.id === parte)) : 0);
  }

  async salvarNotas(acao: string, n: Partial<NotasAcao>): Promise<void> {
    this.notas[acao] = { ...{ observacoes: '', tolerancia: 1 }, ...(this.notas[acao] ?? {}), ...n };
    await this.salvarProjeto();
    if (this.estado === 'testando') this.prepararTeste();
  }

  // ---------------- gravar ----------------
  /** Começa a contagem (3, 2, 1) e depois grava pela duração da parte. */
  gravar(agora: number): boolean {
    const a = this.acao, p = this.parte;
    if (!a || !p || this.estado === 'contagem' || this.estado === 'gravando') return false;
    if (this.tentativas(a.id, p.id).length >= this.repeticoes) { this.aviso = { chave: 'cheio' }; this.aoMudar(); return false; }
    this.estado = 'contagem'; this.quadros = []; this.eventos = [];
    this.fimContagem = agora + (this.config?.gravacao.contagem ?? 3);
    this.fimGravacao = this.fimContagem + p.duracao;
    this.falta = this.fimContagem - agora; this.aviso = null;
    this.aoMudar();
    return true;
  }

  /** Um quadro do VR (também usado nos testes automáticos). `agora` em segundos. */
  quadroVR(a: Amostra, agora: number): EventoReconhecido[] {
    if (this.estado === 'testando') {
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

  /** Um evento do teclado ou do mouse (modo PC). */
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

  /** Avança o relógio da contagem e da gravação (chamar a cada quadro). */
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
    const a = this.acao!, p = this.parte!, cfg = this.config!;
    this.estado = 'parado';
    const usados = new Set(this.tentativas(a.id, p.id).map((g) => g.n));
    let n = 1; while (usados.has(n)) n++;
    const g: Gravacao = { versao_formato: 1, modo: this.modo, acao: a.id, parte: p.id, n, data: new Date().toISOString(), duracao: p.duracao };
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
    this.aviso = { chave: 'gravou', valor: `${this.tentativas(a.id, p.id).length}/${this.repeticoes}` };
    this.ultimaGravada = g;
    this.aoMudar();
  }
  /** A gravação que acabou de ser feita (o boneco repete na hora). */
  ultimaGravada: Gravacao | null = null;

  async apagar(g: Pick<Gravacao, 'modo' | 'acao' | 'parte' | 'n'>): Promise<void> {
    if (!this.config) return;
    await this.armazem.apagarGravacao(this.config.projeto, g);
    this.gravacoes = this.gravacoes.filter((x) => !(x.modo === g.modo && x.acao === g.acao && x.parte === g.parte && x.n === g.n));
    this.aviso = { chave: 'apagou' };
    this.aoMudar();
  }
  /** Apaga a última tentativa da parte escolhida (botão B no VR). */
  async apagarUltima(): Promise<void> {
    const a = this.acao, p = this.parte; if (!a || !p) return;
    const ts = this.tentativas(a.id, p.id); const g = ts[ts.length - 1];
    if (g) await this.apagar(g);
  }

  // ---------------- testar ----------------
  private alturaTeste = 1.6;
  alternarTeste(alturaOlhos = 1.6): void {
    if (this.estado === 'contagem' || this.estado === 'gravando') return;
    if (this.estado === 'testando') { this.estado = 'parado'; this.reconhecedor = null; }
    else { this.alturaTeste = alturaOlhos; this.prepararTeste(); this.estado = 'testando'; }
    this.aoMudar();
  }
  private prepararTeste(): void {
    if (!this.config) return;
    const ajustes: Record<string, { tolerancia: number }> = {};
    for (const [k, v] of Object.entries(this.notas)) ajustes[k] = { tolerancia: v.tolerancia };
    this.reconhecedor = new Reconhecedor(this.config, this.modo, this.gravacoes, ajustes);
  }
}
