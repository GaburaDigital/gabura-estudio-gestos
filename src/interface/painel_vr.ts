// Menu do Estúdio dentro do VR (C35): um quadro à esquerda de quem grava, com telas para navegar.
// Analógico direito ↑↓ escolhe a linha, ←→ muda o valor; A confirma; B volta; segurar Y por 1 s volta ao começo
// de qualquer lugar (também para parar o teste ou cancelar uma gravação). B e Y nunca entram num gesto;
// A e X podem fazer parte dos gestos (durante a contagem e a gravação, nenhum botão mexe no menu).

import * as THREE from 'three';
import type { Estudio } from '../nucleo/estudio';
import { CONTA, efeitoDe, gestoPorId, nivelDaCarga, type Acao, type Gesto } from '../nucleo/config';
import { T, tx } from '../textos';

const L = 1024, A = 900;
type Tela = { nome: 'inicio' } | { nome: 'acao' } | { nome: 'prep' } | { nome: 'gesto' } | { nome: 'teste' };
interface Linha { texto: string; valor?: string; cor?: string; ok?: () => void; mudar?: (d: number) => void; recuo?: boolean }
export interface AcoesMenu { rever: () => void; testar: () => void; gravar: () => void }

export class MenuVR {
  readonly malha: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private textura: THREE.CanvasTexture;
  private tela: Tela = { nome: 'inicio' };
  private pilha: Tela[] = [];
  private cursor = 0;
  private topo = 0;
  private ultimoDesenho = '';
  private linhas: Linha[] = [];
  /** Últimos reconhecimentos (modo testar). */
  reconhecidos: { nome: string; t: number; final: boolean }[] = [];

  constructor(private e: Estudio, private acoes: AcoesMenu) {
    this.canvas.width = L; this.canvas.height = A;
    this.textura = new THREE.CanvasTexture(this.canvas); this.textura.colorSpace = THREE.SRGBColorSpace;
    this.malha = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 * A / L), new THREE.MeshBasicMaterial({ map: this.textura, transparent: true }));
    this.malha.position.set(-0.85, 1.25, -0.95); this.malha.rotation.y = 0.65;
  }

  get nomeTela(): string { return this.tela.nome; }
  irPara(t: Tela, empilhar = true): void { if (empilhar) this.pilha.push(this.tela); this.tela = t; this.cursor = 0; this.topo = 0; this.ultimoDesenho = ''; }
  voltar(): void {
    if (this.tela.nome === 'teste') this.acoes.testar(); // sair do teste
    const t = this.pilha.pop(); if (t) { this.tela = t; this.cursor = 0; this.topo = 0; this.ultimoDesenho = ''; }
  }
  inicio(): void { if (this.e.estado === 'testando') this.acoes.testar(); this.e.cancelar(); this.pilha = []; this.tela = { nome: 'inicio' }; this.cursor = 0; this.topo = 0; this.ultimoDesenho = ''; }
  /** O teste foi ligado por fora (página ou teste automático): o menu mostra a tela do teste. */
  mostrarTeste(): void { if (this.tela.nome !== 'teste') this.irPara({ nome: 'teste' }); }

  /** Comandos do controle (já com as bordas: só quando acabou de apertar). */
  comando(c: 'cima' | 'baixo' | 'esq' | 'dir' | 'A' | 'B'): void {
    if (this.e.ocupado) return;
    const n = this.linhas.length;
    if (c === 'cima' && n) this.cursor = (this.cursor - 1 + n) % n;
    if (c === 'baixo' && n) this.cursor = (this.cursor + 1) % n;
    if (c === 'esq' || c === 'dir') this.linhas[this.cursor]?.mudar?.(c === 'dir' ? 1 : -1);
    if (c === 'A') this.linhas[this.cursor]?.ok?.();
    if (c === 'B') this.voltar();
    this.ultimoDesenho = '';
  }

  // ---------------- linhas de cada tela ----------------
  private montar(): void {
    const e = this.e, cfg = e.config;
    this.linhas = [];
    if (!cfg) return;
    const L2 = (l: Linha) => this.linhas.push(l);
    if (this.tela.nome === 'inicio') {
      L2({ texto: '▶ ' + T.testar, cor: '#ffe066', ok: () => { this.acoes.testar(); } });
      e.acoes.forEach((a, i) => { const p = e.progressoDaAcao(a); L2({ texto: tx(a.nome), valor: `${p.feitos}/${p.total}`, cor: p.feitos >= p.total ? '#8fd651' : undefined, ok: () => { e.escolher(i); this.irPara({ nome: 'acao' }); } }); });
      L2({ texto: T.biblioteca, cor: '#c58fff', ok: () => this.irPara({ nome: 'prep' }) });
    } else if (this.tela.nome === 'acao' && e.acao) {
      const a = e.acao;
      a.passos.forEach((p, k) => p.alternativas.forEach((alt) => {
        const g = gestoPorId(cfg, alt.gesto); if (!g) return;
        const n = e.tentativas(g.id).length;
        const nome = `${k + 1}. ${tx(p.nome)}${p.alternativas.length > 1 ? ' · ' + tx(alt.nome) : ''}${g.tipo === 'preparacao' ? ' ⟲' : ''}`;
        L2({ texto: nome, valor: `${n}/${e.repeticoes}`, cor: n >= e.repeticoes ? '#8fd651' : undefined, recuo: p.alternativas.length > 1, ok: () => { e.escolherGesto(g.id); this.irPara({ nome: 'gesto' }); } });
      }));
      if (a.passos.length < 6) L2({ texto: '+ ' + T.adicionarPreparacao, cor: '#c58fff', ok: () => this.irPara({ nome: 'prep' }) });
      L2({ texto: '▶ ' + T.testar, cor: '#ffe066', ok: () => this.acoes.testar() });
    } else if (this.tela.nome === 'prep') {
      const naAcao = this.pilha[this.pilha.length - 1]?.nome === 'acao' && e.acao;
      for (const g of e.preparacoes) {
        const n = e.tentativas(g.id).length;
        L2({ texto: tx(g.nome), valor: `${n}/${e.repeticoes} · ${e.usosDoGesto(g.id).length}×`, ok: async () => {
          if (naAcao) { await e.adicionarPreparacao(e.acao!.id, g.id); this.pilha.pop(); this.tela = { nome: 'acao' }; this.irPara({ nome: 'gesto' }); }
          else { e.escolherGesto(g.id); this.irPara({ nome: 'gesto' }); }
        } });
      }
      L2({ texto: '+ ' + T.novaPreparacao, cor: '#8fd651', ok: async () => {
        const id = await e.criarPreparacao(`${T.preparacao} ${e.preparacoes.length + 1}`); if (!id) return;
        if (naAcao) { await e.adicionarPreparacao(e.acao!.id, id); this.pilha.pop(); this.tela = { nome: 'acao' }; }
        e.escolherGesto(id); this.irPara({ nome: 'gesto' });
      } });
    } else if (this.tela.nome === 'gesto' && e.gesto) {
      const g = e.gesto, aj = g.ajustes, mudarNum = (k: 'duracao' | 'segurar' | 'tolerancia', passo: number) => (d: number) => void e.ajustar(g.id, { [k]: aj[k] + d * passo });
      L2({ texto: '● ' + T.gravar + ' (A)', cor: '#ff6b5b', ok: () => this.acoes.gravar() });
      L2({ texto: T.rever, ok: () => this.acoes.rever() });
      L2({ texto: T.apagarUltima, ok: () => void e.apagarUltima() });
      L2({ texto: T.conta, valor: '◀ ' + T.contas[aj.conta] + ' ▶', mudar: (d) => { const i = CONTA.indexOf(aj.conta); void e.ajustar(g.id, { conta: CONTA[(i + d + CONTA.length) % CONTA.length] }); } });
      L2({ texto: T.espelhado, valor: '◀ ' + (aj.espelhado ? T.sim : T.nao) + ' ▶', mudar: () => void e.ajustar(g.id, { espelhado: !aj.espelhado }), ok: () => void e.ajustar(g.id, { espelhado: !aj.espelhado }) });
      L2({ texto: T.tempoGravacao, valor: `◀ ${aj.duracao.toFixed(1)} s ▶`, mudar: mudarNum('duracao', 0.5) });
      L2({ texto: T.segurar, valor: `◀ ${aj.segurar.toFixed(1)} s ▶`, mudar: mudarNum('segurar', 0.1) });
      L2({ texto: T.tolerancia, valor: `◀ ${aj.tolerancia.toFixed(2)}× ▶`, mudar: mudarNum('tolerancia', 0.05) });
      const a = e.acao, passoPrep = a?.passos.find((p) => p.alternativas.some((x) => x.gesto === g.id));
      if (a && g.tipo === 'preparacao' && passoPrep) L2({ texto: T.tirarDaAcao, cor: '#ff6b5b', ok: async () => { await e.removerPreparacao(a.id, passoPrep.id); this.voltar(); } });
      L2({ texto: '▶ ' + T.testar, cor: '#ffe066', ok: () => this.acoes.testar() });
    } else if (this.tela.nome === 'teste') {
      // medidor: os gestos mais perto de disparar; ←→ muda a tolerância do gesto da linha
      const med = [...(e.reconhecedor?.medidas ?? new Map())].filter(([, m]) => e.estado === 'testando' && Number.isFinite(m.distancia))
        .sort((x, y) => x[1].distancia / x[1].limite - y[1].distancia / y[1].limite).slice(0, 6);
      for (const [gid, m] of med) {
        const g = gestoPorId(cfg, gid); if (!g) continue;
        const perto = Math.max(0, Math.min(1, 1.6 - m.distancia / m.limite)); // 1 = disparando
        L2({ texto: tx(g.nome), valor: `${Math.round(perto * 100)}%${m.tamanhoOk ? '' : ' ↓'} · ${g.ajustes.tolerancia.toFixed(2)}×`, cor: perto >= 0.6 ? '#ffe066' : undefined,
          mudar: (d) => void e.ajustar(g.id, { tolerancia: g.ajustes.tolerancia + d * 0.05 }) });
      }
    }
    if (this.cursor >= this.linhas.length) this.cursor = Math.max(0, this.linhas.length - 1);
  }

  desenhar(): void {
    const e = this.e;
    if (e.estado === 'testando' && this.tela.nome !== 'teste') this.mostrarTeste();
    if (e.estado !== 'testando' && this.tela.nome === 'teste') { const t = this.pilha.pop(); this.tela = t ?? { nome: 'inicio' }; this.ultimoDesenho = ''; }
    this.montar();
    const g = e.gesto, eng = e.reconhecedor?.engatilhadas() ?? [];
    const chave = [this.tela.nome, this.cursor, e.estado, e.modo, e.acao?.id, g?.id, Math.ceil(e.falta * 10), e.aviso?.chave, e.aviso?.valor, e.gravacoes.length,
      this.reconhecidos.length, JSON.stringify(eng), JSON.stringify(g?.ajustes), this.linhas.map((l) => l.texto + l.valor).join()].join('|');
    if (chave === this.ultimoDesenho) return; this.ultimoDesenho = chave;
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, L, A);
    c.fillStyle = 'rgba(12,26,36,0.94)'; c.beginPath(); c.roundRect(0, 0, L, A, 36); c.fill();
    const txt = (s: string, x: number, y: number, tam: number, cor = '#e8f3f2', peso = 700, alinhar: CanvasTextAlign = 'left') => { c.font = `${peso} ${tam}px system-ui, sans-serif`; c.fillStyle = cor; c.textAlign = alinhar; c.fillText(s, x, y); c.textAlign = 'left'; };
    if (!e.config) { quebrar(c, T.semProjeto, 40, 100, L - 80, 44, 6, '700 36px system-ui, sans-serif', '#e8f3f2'); this.textura.needsUpdate = true; return; }
    // cabeçalho de cada tela
    let y = 70;
    const titulo = this.tela.nome === 'inicio' ? tx(e.config.nome) : this.tela.nome === 'acao' ? tx(e.acao?.nome) : this.tela.nome === 'prep' ? T.biblioteca : this.tela.nome === 'gesto' ? tx(g?.nome) : T.vrTestando;
    txt(titulo, 40, y, 46, this.tela.nome === 'teste' ? '#ffe066' : '#4fd6d0', 900); y += 20;
    if (this.tela.nome === 'acao' && e.acao) y = this.cabecalhoAcao(c, e.acao, y);
    if (this.tela.nome === 'gesto' && g) y = this.cabecalhoGesto(c, g, y);
    if (this.tela.nome === 'teste') y = this.cabecalhoTeste(c, y);
    // contagem e gravação por cima de tudo
    if (e.ocupado) {
      c.fillStyle = 'rgba(12,26,36,0.97)'; c.fillRect(0, 300, L, 420);
      if (e.estado === 'contagem') { txt(T.contagem, L / 2, 400, 46, '#ffe066', 800, 'center'); txt(String(Math.max(1, Math.ceil(e.falta))), L / 2, 600, 200, '#ffe066', 900, 'center'); }
      else { txt(T.gravando, L / 2, 440, 64, '#ff6b5b', 900, 'center'); c.fillStyle = '#2a3d48'; c.fillRect(80, 500, L - 160, 26); c.fillStyle = '#ff6b5b'; c.fillRect(80, 500, (L - 160) * Math.max(0, Math.min(1, e.falta / (g?.ajustes.duracao ?? 1))), 26); }
      txt(T.cancelarY, L / 2, 690, 28, '#9fb3bd', 600, 'center');
      this.textura.needsUpdate = true; return;
    }
    // linhas (com rolagem)
    const alt = 58, cabem = Math.floor((A - y - 90) / alt);
    if (this.cursor < this.topo) this.topo = this.cursor;
    if (this.cursor >= this.topo + cabem) this.topo = this.cursor - cabem + 1;
    this.linhas.slice(this.topo, this.topo + cabem).forEach((l, i) => {
      const yy = y + 10 + i * alt, sel = this.topo + i === this.cursor;
      if (sel) { c.fillStyle = 'rgba(79,214,208,0.22)'; c.beginPath(); c.roundRect(20, yy, L - 40, alt - 6, 12); c.fill(); }
      txt(l.texto.slice(0, 44), l.recuo ? 70 : 40, yy + 39, 32, sel ? '#ffe066' : l.cor ?? '#e8f3f2', sel ? 800 : 700);
      if (l.valor) txt(l.valor, L - 40, yy + 39, 30, sel ? '#ffe066' : '#9fb3bd', 700, 'right');
    });
    if (this.linhas.length > cabem) txt(`${this.cursor + 1}/${this.linhas.length}`, L - 40, A - 70, 24, '#9fb3bd', 600, 'right');
    if (e.aviso) txt((T.avisos[e.aviso.chave] ?? '') + (e.aviso.valor ? ' ' + e.aviso.valor : ''), 40, A - 70, 28, '#ffe066', 800);
    txt(T.vrAjuda, 40, A - 28, 24, '#9fb3bd', 600);
    this.textura.needsUpdate = true;
  }

  private cabecalhoAcao(c: CanvasRenderingContext2D, a: Acao, y: number): number {
    const partes = [T.tipos[a.tipo]];
    if (a.carga) partes.push(`${T.carga}: ${a.carga.minimo}–${a.carga.maximo}`);
    quebrar(c, partes.join(' · '), 40, y + 30, L - 80, 34, 1, '600 28px system-ui, sans-serif', '#9fb3bd');
    if (a.condicoes) { quebrar(c, tx(a.condicoes), 40, y + 70, L - 80, 32, 2, '600 26px system-ui, sans-serif', '#c58fff'); return y + 140; }
    return y + 50;
  }
  private cabecalhoGesto(c: CanvasRenderingContext2D, g: Gesto, y: number): number {
    const e = this.e, sug = e.modo === 'pc' ? g.sugestao_pc ?? g.sugestao : g.sugestao;
    quebrar(c, tx(sug) || '—', 40, y + 34, L - 80, 36, 3, '600 30px system-ui, sans-serif', '#e8f3f2');
    const n = e.tentativas(g.id).length;
    for (let i = 0; i < e.repeticoes; i++) { c.beginPath(); c.arc(60 + i * 50, y + 150, 18, 0, Math.PI * 2); c.fillStyle = i < n ? '#8fd651' : '#2a3d48'; c.fill(); }
    const usos = e.usosDoGesto(g.id).length;
    c.font = '600 26px system-ui, sans-serif'; c.fillStyle = '#9fb3bd'; c.fillText(`${n}/${e.repeticoes}` + (usos > 1 ? ` · ${T.usadoEm} ${usos} ${T.acoesN}` : ''), 60 + e.repeticoes * 50, y + 160);
    return y + 185;
  }
  private cabecalhoTeste(c: CanvasRenderingContext2D, y: number): number {
    const e = this.e, cfg = e.config!;
    if (!e.reconhecedor?.prontas) { quebrar(c, T.faltaGravar, 40, y + 40, L - 80, 36, 2, '700 30px system-ui, sans-serif', '#e8f3f2'); return y + 90; }
    this.reconhecidos.slice(-3).reverse().forEach((r, i) => { c.font = `800 ${i === 0 ? 42 : 30}px system-ui, sans-serif`; c.fillStyle = i === 0 ? '#ffe066' : '#9fb3bd'; c.fillText((r.final ? '★ ' : '· ') + r.nome, 40, y + 46 + i * 44); });
    const eng = e.reconhecedor.engatilhadas();
    let yy = y + 46 + 3 * 44;
    for (const x of eng.slice(0, 2)) {
      const a = e.acoes.find((z) => z.id === x.acao); if (!a) continue;
      const n = a.carga ? nivelDaCarga(a.carga, x.ciclos) : null;
      c.font = '700 28px system-ui, sans-serif'; c.fillStyle = efeitoDe(a, null).cor;
      c.fillText(`${T.engatilhado}: ${tx(a.nome)} → ${tx(a.passos[x.proximo]?.nome)}${a.carga ? ` · ${T.carga} ${x.ciclos}${n?.nome ? ' (' + tx(n.nome) + ')' : ''}` : ''}`, 40, yy); yy += 38;
    }
    c.font = '600 22px system-ui, sans-serif'; c.fillStyle = '#9fb3bd'; c.fillText(T.medidorAjuda, 40, yy + 4);
    void cfg;
    return yy + 14;
  }
}

/** Escreve um texto quebrando as linhas (no máximo `max` linhas). */
export function quebrar(g: CanvasRenderingContext2D, s: string, x: number, y: number, largura: number, alt: number, max: number, fonte: string, cor: string): void {
  g.font = fonte; g.fillStyle = cor;
  const palavras = s.split(/\s+/); let linha = '', n = 0;
  for (const p of palavras) {
    const t = linha ? linha + ' ' + p : p;
    if (g.measureText(t).width > largura && linha) { g.fillText(n === max - 1 ? linha + '…' : linha, x, y + n * alt); n++; linha = p; if (n >= max) return; }
    else linha = t;
  }
  if (linha && n < max) g.fillText(linha, x, y + n * alt);
}
