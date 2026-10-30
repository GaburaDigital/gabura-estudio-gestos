// Reconhecedor do modo testar: compara o que a pessoa está fazendo agora com as gravações de cada ação.
//
// VR: cada gravação vira uma sequência curta de "fotos" do corpo (as duas mãos e a cabeça em relação a onde a
// cabeça estava no começo, virada para a frente de quem gravou e no tamanho de quem gravou), mais gatilho, grip e
// botões. A comparação usa DTW (alinhamento dinâmico no tempo): o mesmo gesto feito mais rápido ou mais devagar
// ainda combina. Funciona como comparar duas animações quadro a quadro deixando uma "esticar" para alinhar com a outra.
// O limite de cada parte sai das próprias gravações (o quanto as 5 tentativas diferem entre si) vezes a tolerância.
//
// PC: cada gravação vira uma sequência de "fichas" (teclas, botões do mouse, roda e direção do mouse); combina
// quando as últimas fichas são as mesmas, dentro de um tempo parecido.
//
// Ações com várias partes (engatilhar e liberar): a parte seguinte só conta depois da anterior e dentro do
// tempo máximo da ação.

import type { Acao, Configuracao, Modo } from './config';
import { todasAcoes } from './config';
import { amostraNoTempo, type Amostra, type EventoPC, type Gravacao } from './gravacao';

export interface Ajuste { tolerancia: number }
export type EventoReconhecido =
  | { tipo: 'parte'; acao: string; parte: string; indice: number; total: number; distancia: number; limite: number }
  | { tipo: 'disparou'; acao: string }
  | { tipo: 'expirou'; acao: string };

const N = 20;          // fotos por sequência
const FAIXA = 5;       // quanto o alinhamento pode "esticar" (quadros)
const PESOS = { mao: 1, cabeca: 0.7, olhar: 0.5, dedos: 0.35, botao: 0.4 };
const QUADROS_POR_CICLO = 8; // as partes são comparadas em 8 quadros seguidos (um pedaço por quadro), para nenhum quadro do Quest pesar

type Seq = Float32Array[]; // N vetores de características

// ---------------- características (VR) ----------------
function yawDe(q: { x: number; y: number; z: number; w: number }): number {
  // para onde a frente (−z) aponta no chão
  const fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
  return Math.atan2(-fx, -fz);
}
function frenteDe(q: { x: number; y: number; z: number; w: number }): [number, number, number] {
  return [-2 * (q.x * q.z + q.w * q.y), -2 * (q.y * q.z - q.w * q.x), -(1 - 2 * (q.x * q.x + q.y * q.y))];
}

/** Sequência de características de um trecho de amostras (já no tempo certo), N fotos espaçadas por igual. */
function sequenciaVR(amostras: Amostra[], altura: number, espelhar = false): Seq {
  const a0 = amostras[0], yaw = yawDe(a0.cabeca.q), c = Math.cos(-yaw), s = Math.sin(-yaw), k = 1 / Math.max(0.8, altura);
  const hx = a0.cabeca.p.x, hz = a0.cabeca.p.z;
  // gira para "de frente para −z" e põe no tamanho de quem gravou (olhos = 1)
  const rel = (x: number, y: number, z: number): [number, number, number] => { const dx = x - hx, dz = z - hz; return [(dx * c + dz * s) * k, y * k, (-dx * s + dz * c) * k]; };
  const seq: Seq = [];
  for (let i = 0; i < N; i++) {
    const a = amostras[Math.round((i / (N - 1)) * (amostras.length - 1))];
    const ma = espelhar ? a.dir : a.esq, mb = espelhar ? a.esq : a.dir, sx = espelhar ? -1 : 1;
    const e = rel(ma.p.x, ma.p.y, ma.p.z), d = rel(mb.p.x, mb.p.y, mb.p.z), h = rel(a.cabeca.p.x, a.cabeca.p.y, a.cabeca.p.z);
    const f = frenteDe(a.cabeca.q), fr: [number, number, number] = [f[0] * c + f[2] * s, f[1], -f[0] * s + f[2] * c];
    const b = a.botoes;
    seq.push(Float32Array.from([
      e[0] * sx * PESOS.mao, e[1] * PESOS.mao, e[2] * PESOS.mao, d[0] * sx * PESOS.mao, d[1] * PESOS.mao, d[2] * PESOS.mao,
      h[0] * sx * PESOS.cabeca, (h[1] - 1) * PESOS.cabeca, h[2] * PESOS.cabeca,
      fr[0] * sx * PESOS.olhar, fr[1] * PESOS.olhar, fr[2] * PESOS.olhar,
      ma.gatilho * PESOS.dedos, ma.grip * PESOS.dedos, mb.gatilho * PESOS.dedos, mb.grip * PESOS.dedos,
      // botões: A/B da direita e X/Y da esquerda trocam de lugar no espelho
      ((b >> (espelhar ? 2 : 0)) & 1) * PESOS.botao, ((b >> (espelhar ? 3 : 1)) & 1) * PESOS.botao,
      ((b >> (espelhar ? 0 : 2)) & 1) * PESOS.botao, ((b >> (espelhar ? 1 : 3)) & 1) * PESOS.botao,
    ]));
  }
  return seq;
}

/** DTW com faixa: custo médio do melhor alinhamento entre duas sequências do mesmo tamanho. */
export function dtw(a: Seq, b: Seq): number {
  const n = a.length, m = b.length, INF = 1e9;
  const D = new Float64Array((n + 1) * (m + 1)).fill(INF); D[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - FAIXA); j <= Math.min(m, i + FAIXA); j++) {
      const x = a[i - 1], y = b[j - 1]; let s = 0;
      for (let k = 0; k < x.length; k++) { const d = x[k] - y[k]; s += d * d; }
      const custo = Math.sqrt(s);
      D[i * (m + 1) + j] = custo + Math.min(D[(i - 1) * (m + 1) + j], D[i * (m + 1) + j - 1], D[(i - 1) * (m + 1) + j - 1]);
    }
  }
  return D[n * (m + 1) + m] / n; // custo médio por foto
}

/** Trecho de uma gravação VR (só a parte com movimento), reamostrado no tempo. */
function amostrasDoTrecho(g: Gravacao): Amostra[] {
  const q = g.quadros ?? [], t0 = g.inicio ?? 0, t1 = g.fim ?? (q.length ? q[q.length - 1][0] : 0);
  const n = 40, r: Amostra[] = [];
  for (let i = 0; i < n; i++) r.push(amostraNoTempo(q, t0 + ((t1 - t0) * i) / (n - 1)));
  return r;
}

// ---------------- fichas (PC) ----------------
interface Ficha { t: number; f: string }
/** Transforma eventos do PC em fichas: tecla ou botão apertado, roda, e a direção de movimentos grandes do mouse. */
export function fichasPC(eventos: EventoPC[]): Ficha[] {
  const r: Ficha[] = [];
  let acX = 0, acY = 0, desde = -1;
  const soltarMovimento = (t: number) => {
    if (Math.hypot(acX, acY) >= 60) {
      const f = Math.abs(acX) > Math.abs(acY) ? (acX > 0 ? 'MouseDireita' : 'MouseEsquerda') : (acY > 0 ? 'MouseBaixo' : 'MouseCima');
      if (r[r.length - 1]?.f !== f) r.push({ t, f });
    }
    acX = 0; acY = 0; desde = -1;
  };
  for (const e of eventos) {
    if (e.tipo === 'mover') {
      // um movimento termina quando para (0,25 s) ou quando o mouse vira para o lado contrário (vai e volta = duas fichas)
      const contra = (acX * (e.dx ?? 0) + acY * (e.dy ?? 0)) < 0 && Math.hypot(acX, acY) >= 60;
      if (desde >= 0 && (e.t - desde > 0.25 || contra)) soltarMovimento(e.t);
      if (desde < 0) desde = e.t;
      acX += e.dx ?? 0; acY += e.dy ?? 0;
      continue;
    }
    if (desde >= 0) soltarMovimento(e.t);
    if (e.tipo === 'baixo') r.push({ t: e.t, f: e.codigo });
    if (e.tipo === 'roda') r.push({ t: e.t, f: (e.dy ?? 0) < 0 ? 'RodaCima' : 'RodaBaixo' });
  }
  if (desde >= 0) soltarMovimento(eventos[eventos.length - 1]?.t ?? 0);
  return r;
}

// ---------------- reconhecedor ----------------
interface ModeloParte {
  acao: Acao; indice: number; parteId: string;
  // VR
  seqs: Seq[]; espelhos: Seq[]; duracao: number; limite: number; altura: number;
  // PC
  fichas: { lista: string[]; tempo: number }[];
}

export class Reconhecedor {
  private partes: ModeloParte[] = [];
  private buffer: Amostra[] = [];
  private fichasVivas: Ficha[] = [];
  private eventosVivos: EventoPC[] = [];
  private ciclo = { i: 0, melhor: null as { m: ModeloParte; d: number } | null };
  private progresso = new Map<string, { indice: number; ate: number }>();
  private ultima = new Map<string, number>();
  /** Última distância de cada parte (para a tela mostrar o quanto está perto). */
  readonly medidas = new Map<string, { distancia: number; limite: number }>();

  constructor(readonly config: Configuracao, readonly modo: Modo, gravacoes: Gravacao[], ajustes: Record<string, Ajuste> = {}) {
    for (const acao of todasAcoes(config)) {
      if (!acao.plataformas.includes(modo)) continue;
      acao.partes.forEach((parte, indice) => {
        const gs = gravacoes.filter((g) => g.acao === acao.id && g.parte === parte.id && g.modo === modo);
        if (!gs.length) return;
        const tol = ajustes[acao.id]?.tolerancia ?? 1;
        const m: ModeloParte = { acao, indice, parteId: parte.id, seqs: [], espelhos: [], duracao: 0, limite: 0, altura: 1.6, fichas: [] };
        if (modo === 'vr') {
          const ok = gs.filter((g) => (g.quadros?.length ?? 0) >= 3);
          if (!ok.length) return;
          for (const g of ok) {
            const am = amostrasDoTrecho(g), h = g.altura_olhos ?? 1.6;
            m.seqs.push(sequenciaVR(am, h));
            if (acao.maos !== 'duas') m.espelhos.push(sequenciaVR(am, h, true));
          }
          const durs = ok.map((g) => (g.fim ?? 0) - (g.inicio ?? 0)).sort((a, b) => a - b);
          m.duracao = Math.max(0.25, durs[Math.floor(durs.length / 2)]);
          m.altura = ok.reduce((s, g) => s + (g.altura_olhos ?? 1.6), 0) / ok.length;
          // limite: o quanto as tentativas diferem entre si (com uma tentativa só, um valor padrão)
          const pares: number[] = [];
          for (let i = 0; i < m.seqs.length; i++) for (let j = i + 1; j < m.seqs.length; j++) pares.push(dtw(m.seqs[i], m.seqs[j]));
          // mediana (uma tentativa ruim não afrouxa tudo) e um teto, para o reconhecimento não ficar solto demais
          pares.sort((x, y) => x - y);
          const mediana = pares.length ? pares[Math.floor(pares.length / 2)] : 0.12;
          m.limite = Math.min(0.35, Math.max(0.1, mediana * 1.7)) * tol;
        } else {
          for (const g of gs) {
            const f = fichasPC(g.eventos ?? []);
            if (f.length) m.fichas.push({ lista: f.map((x) => x.f), tempo: f[f.length - 1].t - f[0].t });
          }
          if (!m.fichas.length) return;
          m.limite = tol;
        }
        this.partes.push(m);
      });
    }
  }

  /** Quantas partes têm gravação (o que dá para testar). */
  get prontas(): number { return this.partes.length; }

  /** VR: mais uma amostra ao vivo. Devolve o que foi reconhecido agora. */
  amostra(a: Amostra, alturaAgora: number): EventoReconhecido[] {
    this.buffer.push(a);
    while (this.buffer.length > 2 && a.t - this.buffer[0].t > 8) this.buffer.shift();
    const saida = this.expirar(a.t);
    if (!this.partes.length) return saida;
    const cache = new Map<number, Seq>();
    const seqAgora = (dur: number): Seq | null => {
      const chave = Math.round(dur * 20);
      if (cache.has(chave)) return cache.get(chave)!;
      const ini = a.t - chave / 20;
      if (this.buffer[0].t > ini + 0.05) { cache.set(chave, null as unknown as Seq); return null; }
      const am: Amostra[] = [];
      for (let i = 0; i < 40; i++) am.push(this.amostraViva(ini + ((a.t - ini) * i) / 39));
      const s = sequenciaVR(am, alturaAgora); cache.set(chave, s); return s;
    };
    const passo = Math.ceil(this.partes.length / QUADROS_POR_CICLO), ini = this.ciclo.i;
    for (const m of this.partes.slice(ini, ini + passo)) {
      if (!this.podeAgora(m, a.t)) continue;
      let d = Infinity;
      for (const f of [0.8, 1, 1.25]) {
        const s = seqAgora(m.duracao * f); if (!s) continue;
        for (const t of m.seqs) d = Math.min(d, dtw(s, t));
        for (const t of m.espelhos) d = Math.min(d, dtw(s, t));
      }
      this.medidas.set(m.acao.id + '/' + m.parteId, { distancia: d, limite: m.limite });
      const c = this.ciclo;
      if (d < m.limite && (!c.melhor || d / m.limite < c.melhor.d / c.melhor.m.limite)) c.melhor = { m, d };
    }
    // fim do ciclo: a parte que combinou melhor (em proporção ao limite dela) vence
    this.ciclo.i = ini + passo;
    if (this.ciclo.i >= this.partes.length) {
      const melhor = this.ciclo.melhor; this.ciclo = { i: 0, melhor: null };
      if (melhor && this.podeAgora(melhor.m, a.t)) saida.push(...this.avancar(melhor.m, melhor.d, a.t));
    }
    return saida;
  }

  /** PC: mais um evento do teclado ou do mouse. */
  evento(e: EventoPC): EventoReconhecido[] {
    this.eventosVivos.push(e);
    while (this.eventosVivos.length > 1 && e.t - this.eventosVivos[0].t > 10) this.eventosVivos.shift();
    const saida = this.expirar(e.t);
    if (e.tipo === 'cima') return saida;
    const antes = this.fichasVivas.length;
    this.fichasVivas = fichasPC(this.eventosVivos);
    if (e.tipo === 'mover' && this.fichasVivas.length === antes) return saida;
    const viva = this.fichasVivas;
    let melhor: ModeloParte | null = null, melhorTam = 0;
    for (const m of this.partes) {
      if (!this.podeAgora(m, e.t)) continue;
      for (const f of m.fichas) {
        const n = f.lista.length; if (viva.length < n) continue;
        const fim = viva.slice(viva.length - n);
        if (fim.some((x, i) => x.f !== f.lista[i])) continue;
        const tempo = fim[n - 1].t - fim[0].t;
        if (tempo > Math.max(0.4, f.tempo * 1.5) * m.limite + 0.3) continue;
        if (e.t - fim[n - 1].t > 0.3) continue; // só quando a última ficha acabou de acontecer
        if (n > melhorTam) { melhor = m; melhorTam = n; } // a sequência mais longa ganha (Q, Q, E vence só E)
      }
    }
    if (melhor) { this.eventosVivos = []; return [...saida, ...this.avancar(melhor, 0, e.t)]; }
    return saida;
  }

  private amostraViva(t: number): Amostra {
    const b = this.buffer; let i = b.length - 1; while (i > 0 && b[i - 1].t > t) i--;
    const x = b[Math.max(0, i - 1)], y = b[i];
    return Math.abs(t - x.t) < Math.abs(t - y.t) ? x : y;
  }

  /** A parte pode ser reconhecida agora? Parte 1 sempre; as seguintes, só se a ação está nesse ponto. */
  private podeAgora(m: ModeloParte, t: number): boolean {
    // depois de reconhecer, a mesma ação descansa um pouco (um aceno longo não conta duas vezes)
    if ((this.ultima.get(m.acao.id) ?? -9) > t - Math.max(0.6, m.duracao)) return false;
    const p = this.progresso.get(m.acao.id);
    return m.indice === 0 ? !p || p.indice === 0 : !!p && p.indice === m.indice;
  }

  private avancar(m: ModeloParte, d: number, t: number): EventoReconhecido[] {
    const total = m.acao.partes.length;
    if (m.indice + 1 >= total) this.ultima.set(m.acao.id, t);
    const ev: EventoReconhecido[] = [{ tipo: 'parte', acao: m.acao.id, parte: m.parteId, indice: m.indice, total, distancia: d, limite: m.limite }];
    if (m.indice + 1 >= total) { this.progresso.delete(m.acao.id); ev.push({ tipo: 'disparou', acao: m.acao.id }); }
    else this.progresso.set(m.acao.id, { indice: m.indice + 1, ate: t + m.acao.tempo_maximo });
    // depois de reconhecer, recomeça a janela (o mesmo movimento não conta duas vezes)
    this.buffer = this.buffer.slice(-1);
    return ev;
  }

  private expirar(t: number): EventoReconhecido[] {
    const r: EventoReconhecido[] = [];
    for (const [acao, p] of this.progresso) if (t > p.ate) { this.progresso.delete(acao); r.push({ tipo: 'expirou', acao }); }
    return r;
  }

  /** Ações engatilhadas agora (para o boneco mostrar a carga). */
  engatilhadas(): string[] { return [...this.progresso.keys()]; }
}
