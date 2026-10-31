// Gravações do Estúdio: o que fica guardado de cada tentativa de um gesto.
//
// VR: um quadro por desenho do óculos (72 a 90 por segundo) com a cabeça e as duas mãos (posição e rotação),
// o quanto o gatilho e o grip estão apertados e os botões. As posições são as do mundo do WebXR ("local-floor":
// o chão é y = 0), em metros reais de quem gravou, e a gravação guarda a altura dos olhos dessa pessoa para o
// reconhecedor e o boneco ajustarem o tamanho.
// PC: a lista de eventos do teclado e do mouse, com o tempo de cada um.

import type { Modo } from './config';

export const VERSAO_GRAVACAO = 2;

/** Botões do Quest guardados num número (um bit cada). B e Y ficam para o menu (C35): nunca entram num gesto. */
export const BOTOES = ['A', 'B', 'X', 'Y', 'analogicoE', 'analogicoD'] as const;
export const BOTOES_DO_GESTO = ['A', 'X', 'analogicoE', 'analogicoD'] as const;
export const BIT_A = 1, BIT_X = 4;
export type Botao = typeof BOTOES[number];

export interface V3 { x: number; y: number; z: number }
export interface Q4 { x: number; y: number; z: number; w: number }
export interface MaoAmostra { p: V3; q: Q4; gatilho: number; grip: number }
/** Uma amostra do VR: tudo o que o Estúdio lê num quadro. */
export interface Amostra { t: number; cabeca: { p: V3; q: Q4 }; esq: MaoAmostra; dir: MaoAmostra; botoes: number }

/** Quadro guardado: [t, cabeça p(3) q(4), esq p(3) q(4) gatilho grip, dir p(3) q(4) gatilho grip, botões] = 27 números. */
export type Quadro = number[];
export const TAMANHO_QUADRO = 27;

export type TipoEventoPC = 'baixo' | 'cima' | 'roda' | 'mover';
/** Evento do PC: tecla ou botão do mouse (código), roda (dy) ou movimento do mouse (dx, dy somados em ~50 ms). */
export interface EventoPC { t: number; tipo: TipoEventoPC; codigo: string; dx?: number; dy?: number }

export interface Gravacao {
  versao_formato: 2;
  modo: Modo;
  /** Gesto da biblioteca (versão 2). Gravações da versão 1 tinham ação e parte: viram o gesto `<acao>_<parte>`. */
  gesto: string;
  /** Número da tentativa (1, 2, 3…). */
  n: number;
  data: string;
  duracao: number;
  /** VR: altura dos olhos de quem gravou (m), de pé. */
  altura_olhos?: number;
  quadros?: Quadro[];
  eventos?: EventoPC[];
  /** VR: trecho com movimento (s), achado sozinho; o reconhecedor usa só ele. */
  inicio?: number;
  fim?: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function amostraParaQuadro(a: Amostra, t0: number): Quadro {
  const m = (x: MaoAmostra) => [x.p.x, x.p.y, x.p.z, x.q.x, x.q.y, x.q.z, x.q.w, x.gatilho, x.grip];
  const c = a.cabeca;
  return [a.t - t0, c.p.x, c.p.y, c.p.z, c.q.x, c.q.y, c.q.z, c.q.w, ...m(a.esq), ...m(a.dir), a.botoes].map((v, i) => (i === 26 ? v : r3(v)));
}

export function quadroParaAmostra(q: Quadro): Amostra {
  const m = (i: number): MaoAmostra => ({ p: { x: q[i], y: q[i + 1], z: q[i + 2] }, q: { x: q[i + 3], y: q[i + 4], z: q[i + 5], w: q[i + 6] }, gatilho: q[i + 7], grip: q[i + 8] });
  return { t: q[0], cabeca: { p: { x: q[1], y: q[2], z: q[3] }, q: { x: q[4], y: q[5], z: q[6], w: q[7] } }, esq: m(8), dir: m(17), botoes: q[26] };
}

/** Amostra no tempo t (entre dois quadros), para o boneco repetir a gravação suave em qualquer taxa de quadros. */
export function amostraNoTempo(quadros: Quadro[], t: number): Amostra {
  if (!quadros.length) throw new Error('gravação vazia');
  let i = 0; while (i < quadros.length - 2 && quadros[i + 1][0] < t) i++;
  const a = quadros[i], b = quadros[Math.min(i + 1, quadros.length - 1)];
  const k = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  const q = a.map((v, j) => (j === 26 ? (k < 0.5 ? a[j] : b[j]) : v + (b[j] - v) * k));
  // rotações: interpolar componente a componente e normalizar é o bastante entre dois quadros vizinhos
  for (const s of [4, 11, 20]) {
    if (a[s] * b[s] + a[s + 1] * b[s + 1] + a[s + 2] * b[s + 2] + a[s + 3] * b[s + 3] < 0) for (let j = 0; j < 4; j++) q[s + j] = a[s + j] - (b[s + j] + a[s + j]) * k;
    const n = Math.hypot(q[s], q[s + 1], q[s + 2], q[s + 3]) || 1; for (let j = 0; j < 4; j++) q[s + j] /= n;
  }
  return quadroParaAmostra(q);
}

/** Acha o trecho com movimento: mãos andando em relação à cabeça, cabeça girando ou gatilho/grip/botões mudando.
 *  Assim a contagem e o fim parado não atrapalham o reconhecimento. Gestos parados (uma pose) usam o caminho até a pose. */
export function acharTrecho(quadros: Quadro[]): { inicio: number; fim: number } {
  if (quadros.length < 3) return { inicio: 0, fim: quadros.length ? quadros[quadros.length - 1][0] : 0 };
  // compara com o quadro de ~0,1 s antes (e não com o vizinho): o tremido natural da mão não conta como movimento
  const ativo: boolean[] = [false];
  for (let i = 1; i < quadros.length; i++) {
    let j = i - 1; while (j > 0 && quadros[i][0] - quadros[j][0] < 0.1) j--;
    const a = quadros[j], b = quadros[i], dt = Math.max(1 / 120, b[0] - a[0]);
    const rel = (q: Quadro, k: number, e: number) => q[k + e] - q[1 + e];
    let vel = 0;
    for (const k of [8, 17]) vel = Math.max(vel, Math.hypot(rel(b, k, 0) - rel(a, k, 0), rel(b, k, 1) - rel(a, k, 1), rel(b, k, 2) - rel(a, k, 2)) / dt);
    const giro = (1 - Math.min(1, Math.abs(a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7]))) / dt; // ~ quanto a cabeça girou
    const dedos = Math.abs(b[15] - a[15]) + Math.abs(b[16] - a[16]) + Math.abs(b[24] - a[24]) + Math.abs(b[25] - a[25]) > 0.05 || a[26] !== b[26];
    ativo.push(vel > 0.3 || giro > 0.02 || dedos);
  }
  let i0 = ativo.indexOf(true), i1 = ativo.lastIndexOf(true);
  if (i0 < 0) return { inicio: 0, fim: quadros[quadros.length - 1][0] };
  const t0 = Math.max(0, quadros[i0][0] - 0.15), t1 = Math.min(quadros[quadros.length - 1][0], quadros[i1][0] + 0.15);
  return { inicio: r3(t0), fim: r3(Math.max(t1, t0 + 0.2)) };
}

/** Altura dos olhos de pé: a maior altura da cabeça nos primeiros quadros (antes do gesto começar). */
export function alturaDosOlhos(quadros: Quadro[]): number {
  let h = 0; for (const q of quadros.slice(0, 20)) h = Math.max(h, q[2]);
  return h > 0.5 ? r3(h) : 1.6;
}

/** Bits dos botões a partir de uma lista de nomes (só os que podem fazer parte de um gesto). */
export function bitsDosBotoes(nomes: Iterable<string>): number {
  let b = 0; for (const n of nomes) { if (!(BOTOES_DO_GESTO as readonly string[]).includes(n)) continue; const i = (BOTOES as readonly string[]).indexOf(n); if (i >= 0) b |= 1 << i; }
  return b;
}

/** Gravação de uma versão antiga (acao + parte) para a versão 2 (gesto). */
export function migrarGravacao(g: Record<string, unknown>): Gravacao | null {
  if (g.versao_formato === 2 && typeof g.gesto === 'string') return g as unknown as Gravacao;
  if (g.versao_formato === 1 && typeof g.acao === 'string' && typeof g.parte === 'string') {
    const c = { ...g, versao_formato: 2, gesto: `${g.acao}_${g.parte}`.slice(0, 40) } as Record<string, unknown>;
    delete c.acao; delete c.parte; return c as unknown as Gravacao;
  }
  return null;
}
