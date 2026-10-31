// Reconhecedor do modo testar: compara o que a pessoa está fazendo agora com as gravações de cada gesto.
//
// VR: cada gravação vira uma sequência curta de "fotos" do corpo (mãos e cabeça em relação a onde a cabeça estava
// no começo, viradas para a frente de quem gravou e no tamanho de quem gravou), mais gatilho, grip e os botões
// A e X. Só conta o que o gesto pede (só a mão direita, as duas mãos, mão e cabeça…): o resto é ignorado.
// A comparação usa DTW (alinhamento no tempo): o mesmo gesto mais rápido ou mais devagar ainda combina.
// Para não disparar com pouco movimento (C35), o gesto de agora também precisa ter o TAMANHO parecido com o das
// gravações (um soco pequeno não vale por um soco com o braço esticado), e, quando o gesto pede, segurar a pose.
// Com "espelhado", vale feito com a outra mão.
//
// PC: cada gravação vira uma sequência de "fichas" (teclas, botões do mouse, roda e direção do mouse); combina
// quando as últimas fichas são as mesmas, dentro de um tempo parecido.
//
// Ações: uma sequência de passos (engatilhar, preparar, liberar). O passo seguinte só conta depois do anterior e
// dentro do tempo máximo. Um passo pode ter alternativas (qualquer uma vale). Carga: o gesto do passo de carga é
// repetido, e cada repetição soma um ciclo, até o máximo.

import type { Acao, Alternativa, Conta, Configuracao, Gesto, Modo } from './config';
import { gestosDaAcao, nivelDaCarga, todasAcoes } from './config';
import { amostraNoTempo, type Amostra, type EventoPC, type Gravacao } from './gravacao';

export type Lado = 'esq' | 'dir';
export type EventoReconhecido =
  | { tipo: 'passo'; acao: string; passo: string; alternativa: string; indice: number; total: number; lado: Lado }
  | { tipo: 'carga'; acao: string; ciclos: number; nivel: string | null; lado: Lado }
  | { tipo: 'disparou'; acao: string; alternativa: string; ciclos: number; nivel: string | null; lado: Lado }
  | { tipo: 'expirou'; acao: string };

const N = 20;              // fotos por sequência
const FAIXA = 5;           // quanto o alinhamento pode "esticar" (fotos)
const QUADROS_POR_CICLO = 8; // os gestos são comparados em 8 quadros seguidos (um pedaço por quadro)
const TAMANHO_MINIMO = 0.7;  // o gesto de agora precisa ter pelo menos 70% do tamanho das gravações
const PARADO = 0.08;         // m: o quanto a mão pode mexer enquanto segura a pose

type Seq = Float32Array[];
// grupos de características: 0-2 mão esq, 3-5 mão dir, 6-8 cabeça, 9-11 olhar, 12-13 dedos esq, 14-15 dedos dir,
// 16 X, 17 A, 18-23 giro da mão esq (para onde aponta e para onde fica o polegar), 24-29 giro da mão dir.
// O giro da mão conta para gestos como girar o pulso (furadeira), apontar (agulhas) e a guarda.
const GRUPOS = { esq: [0, 1, 2, 12, 13, 16, 18, 19, 20, 21, 22, 23], dir: [3, 4, 5, 14, 15, 17, 24, 25, 26, 27, 28, 29], cabeca: [6, 7, 8, 9, 10, 11] };
const PESO = [1, 1, 1, 1, 1, 1, 0.7, 0.7, 0.7, 0.5, 0.5, 0.5, 0.35, 0.35, 0.35, 0.35, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4];

/** Pesos do que conta (os outros ficam zero). `espelho` troca as mãos. */
function mascara(conta: Conta, espelho: boolean): Float32Array {
  const m = new Float32Array(PESO.length);
  const dir = espelho ? GRUPOS.esq : GRUPOS.dir, esq = espelho ? GRUPOS.dir : GRUPOS.esq;
  const usar = (g: number[]) => { for (const i of g) m[i] = PESO[i]; };
  if (conta === 'mao_dir' || conta === 'mao_cabeca' || conta === 'duas_maos' || conta === 'corpo') usar(dir);
  if (conta === 'mao_esq') usar(esq);
  if (conta === 'duas_maos' || conta === 'corpo') usar(esq);
  if (conta === 'mao_cabeca' || conta === 'cabeca' || conta === 'corpo') usar(GRUPOS.cabeca);
  return m;
}

// ---------------- características (VR) ----------------
export function yawDe(q: { x: number; y: number; z: number; w: number }): number {
  const fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
  return Math.atan2(-fx, -fz);
}
function frenteDe(q: { x: number; y: number; z: number; w: number }): [number, number, number] {
  return [-2 * (q.x * q.z + q.w * q.y), -2 * (q.y * q.z - q.w * q.x), -(1 - 2 * (q.x * q.x + q.y * q.y))];
}
/** Para onde o +y (o polegar, no controle) aponta. */
function cimaDe(q: { x: number; y: number; z: number; w: number }): [number, number, number] {
  return [2 * (q.x * q.y - q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z), 2 * (q.y * q.z + q.w * q.x)];
}

/** Sequência de características (sem pesos) de um trecho de amostras, N fotos espaçadas por igual.
 *  Com `espelhar`, troca as mãos e inverte o lado (um gesto da mão esquerda vira o da direita). */
function sequenciaVR(amostras: Amostra[], altura: number, espelhar = false): Seq {
  const a0 = amostras[0], yaw = yawDe(a0.cabeca.q), c = Math.cos(-yaw), s = Math.sin(-yaw), k = 1 / Math.max(0.8, altura);
  const hx = a0.cabeca.p.x, hz = a0.cabeca.p.z;
  const rel = (x: number, y: number, z: number): [number, number, number] => { const dx = x - hx, dz = z - hz; return [(dx * c + dz * s) * k, y * k, (-dx * s + dz * c) * k]; };
  const seq: Seq = [];
  for (let i = 0; i < N; i++) {
    const a = amostras[Math.round((i / (N - 1)) * (amostras.length - 1))];
    const me = espelhar ? a.dir : a.esq, md = espelhar ? a.esq : a.dir, sx = espelhar ? -1 : 1;
    const e = rel(me.p.x, me.p.y, me.p.z), d = rel(md.p.x, md.p.y, md.p.z), h = rel(a.cabeca.p.x, a.cabeca.p.y, a.cabeca.p.z);
    const girar = (v: [number, number, number]) => [(v[0] * c + v[2] * s) * sx, v[1], -v[0] * s + v[2] * c];
    const fr = girar(frenteDe(a.cabeca.q));
    const bA = (a.botoes & 1) ? 1 : 0, bX = (a.botoes & 4) ? 1 : 0;
    seq.push(Float32Array.from([
      e[0] * sx, e[1], e[2], d[0] * sx, d[1], d[2], h[0] * sx, h[1] - 1, h[2], fr[0], fr[1], fr[2],
      me.gatilho, me.grip, md.gatilho, md.grip, espelhar ? bA : bX, espelhar ? bX : bA,
      ...girar(frenteDe(me.q)), ...girar(cimaDe(me.q)), ...girar(frenteDe(md.q)), ...girar(cimaDe(md.q)),
    ]));
  }
  return seq;
}

/** DTW com faixa: custo médio por foto do melhor alinhamento, contando só o que a máscara pede. */
export function dtw(a: Seq, b: Seq, w: Float32Array): number {
  const n = a.length, m = b.length, INF = 1e9;
  const D = new Float64Array((n + 1) * (m + 1)).fill(INF); D[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - FAIXA); j <= Math.min(m, i + FAIXA); j++) {
      const x = a[i - 1], y = b[j - 1]; let s = 0;
      for (let k = 0; k < x.length; k++) { if (!w[k]) continue; const d = (x[k] - y[k]) * w[k]; s += d * d; }
      D[i * (m + 1) + j] = Math.sqrt(s) + Math.min(D[(i - 1) * (m + 1) + j], D[i * (m + 1) + j - 1], D[(i - 1) * (m + 1) + j - 1]);
    }
  }
  return D[n * (m + 1) + m] / n;
}

/** Distância só entre as últimas fotos (a pose em que o gesto termina). */
function distanciaFinal(a: Seq, b: Seq, w: Float32Array): number {
  const x = a[a.length - 1], y = b[b.length - 1]; let s = 0;
  for (let k = 0; k < x.length; k++) { if (!w[k]) continue; const d = (x[k] - y[k]) * w[k]; s += d * d; }
  return Math.sqrt(s);
}

/** Tamanho do gesto: o caminho percorrido pelo que conta (posições das mãos e da cabeça, olhar e dedos). */
function tamanho(s: Seq, w: Float32Array): number {
  let t = 0;
  for (let i = 1; i < s.length; i++) { let q = 0; for (let k = 0; k < 12; k++) { if (!w[k]) continue; const d = (s[i][k] - s[i - 1][k]) * w[k]; q += d * d; } t += Math.sqrt(q); }
  return t;
}

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
interface Modelo {
  gesto: Gesto;
  // VR
  seqs: Seq[]; normal: Float32Array; espelho: Float32Array | null; duracao: number; limite: number; tamanho: number;
  // PC
  fichas: { lista: string[]; tempo: number }[];
}
/** Um lugar onde um gesto vale: ação, passo e alternativa. */
interface Uso { acao: Acao; indice: number; alt: Alternativa }
interface Progresso { proximo: number; ate: number; ciclos: number; lado: Lado }

export class Reconhecedor {
  private modelos: Modelo[] = [];
  private usos = new Map<string, Uso[]>();
  private buffer: Amostra[] = [];
  private eventosVivos: EventoPC[] = [];
  private fichasVivas: Ficha[] = [];
  private ciclo = { i: 0, passaram: [] as { m: Modelo; d: number; lado: Lado }[] };
  private progresso = new Map<string, Progresso>();
  private ultimaVez = new Map<string, number>();
  /** Última medida de cada gesto (para o medidor): distância e limite (perto de disparar quando distancia < limite). */
  readonly medidas = new Map<string, { distancia: number; limite: number; tamanhoOk: boolean; t: number }>();

  constructor(readonly config: Configuracao, readonly modo: Modo, gravacoes: Gravacao[]) {
    const usados = new Set<string>();
    for (const acao of todasAcoes(config)) {
      if (!acao.plataformas.includes(modo)) continue;
      acao.passos.forEach((p, indice) => p.alternativas.forEach((alt) => {
        const l = this.usos.get(alt.gesto) ?? []; l.push({ acao, indice, alt }); this.usos.set(alt.gesto, l); usados.add(alt.gesto);
      }));
    }
    for (const gesto of config.gestos) {
      if (!usados.has(gesto.id)) continue;
      const gs = gravacoes.filter((g) => g.gesto === gesto.id && g.modo === modo);
      const A = gesto.ajustes;
      const m: Modelo = { gesto, seqs: [], normal: mascara(A.conta, false), espelho: A.espelhado && A.conta !== 'cabeca' ? mascara(A.conta, true) : null, duracao: 0, limite: 0, tamanho: 0, fichas: [] };
      if (modo === 'vr') {
        const ok = gs.filter((g) => (g.quadros?.length ?? 0) >= 3);
        if (!ok.length) continue;
        for (const g of ok) m.seqs.push(sequenciaVR(amostrasDoTrecho(g), g.altura_olhos ?? 1.6));
        const mediana = (v: number[]) => { const o = [...v].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; };
        m.duracao = Math.max(0.25, mediana(ok.map((g) => (g.fim ?? 0) - (g.inicio ?? 0))));
        m.tamanho = mediana(m.seqs.map((s) => tamanho(s, m.normal)));
        // limite: o quanto as tentativas diferem entre si (mediana), com chão e teto, vezes a tolerância
        const pares: number[] = [];
        for (let i = 0; i < m.seqs.length; i++) for (let j = i + 1; j < m.seqs.length; j++) pares.push(dtw(m.seqs[i], m.seqs[j], m.normal));
        m.limite = Math.min(0.22, Math.max(0.08, (pares.length ? mediana(pares) : 0.1) * 1.5)) * A.tolerancia;
      } else {
        for (const g of gs) {
          const f = fichasPC(g.eventos ?? []);
          if (f.length) m.fichas.push({ lista: f.map((x) => x.f), tempo: f[f.length - 1].t - f[0].t });
        }
        if (!m.fichas.length) continue;
        m.limite = A.tolerancia;
      }
      this.modelos.push(m);
    }
  }

  /** Quantos gestos têm gravação (o que dá para testar). */
  get prontas(): number { return this.modelos.length; }

  /** VR: mais uma amostra ao vivo. Devolve o que foi reconhecido agora. */
  amostra(a: Amostra, alturaAgora: number): EventoReconhecido[] {
    this.buffer.push(a);
    while (this.buffer.length > 2 && a.t - this.buffer[0].t > 10) this.buffer.shift();
    const saida = this.expirar(a.t);
    if (!this.modelos.length) return saida;
    const cache = new Map<string, Seq | null>();
    const seqAgora = (dur: number, fim: number, espelhar: boolean): Seq | null => {
      const chave = Math.round(dur * 20) + '|' + Math.round(fim * 20) + '|' + espelhar;
      if (cache.has(chave)) return cache.get(chave)!;
      const ini = a.t - fim - dur, ate = a.t - fim;
      if (this.buffer[0].t > ini + 0.05) { cache.set(chave, null); return null; }
      const am: Amostra[] = [];
      for (let i = 0; i < 40; i++) am.push(this.amostraViva(ini + ((ate - ini) * i) / 39));
      const s = sequenciaVR(am, alturaAgora, espelhar); cache.set(chave, s); return s;
    };
    const passo = Math.ceil(this.modelos.length / QUADROS_POR_CICLO), ini = this.ciclo.i;
    for (const m of this.modelos.slice(ini, ini + passo)) {
      if (!this.algumUsoAgora(m, a.t)) continue;
      const segurar = m.gesto.ajustes.segurar;
      let melhor = { d: Infinity, lado: 'dir' as Lado, tam: 0, fim: Infinity };
      for (const f of [0.8, 1, 1.25]) {
        for (const esp of m.espelho ? [false, true] : [false]) {
          const s = seqAgora(m.duracao * f, segurar, esp); if (!s) continue;
          let d = Infinity, fim = Infinity;
          for (const t of m.seqs) { const x = dtw(s, t, m.normal); if (x < d) { d = x; fim = distanciaFinal(s, t, m.normal); } }
          if (d < melhor.d) melhor = { d, lado: esp ? 'esq' : 'dir', tam: tamanho(s, m.normal), fim };
        }
      }
      // gestos de uma mão esquerda gravados com a esquerda: o lado "normal" é a esquerda
      if (m.gesto.ajustes.conta === 'mao_esq') melhor.lado = melhor.lado === 'dir' ? 'esq' : 'dir';
      const tamanhoOk = m.tamanho < 0.15 || melhor.tam >= m.tamanho * TAMANHO_MINIMO;
      this.medidas.set(m.gesto.id, { distancia: melhor.d, limite: m.limite, tamanhoOk, t: a.t });
      // e precisa TERMINAR na pose certa (a última foto perto da última foto da gravação)
      const fimOk = melhor.fim < m.limite * 2;
      if (melhor.d < m.limite && tamanhoOk && fimOk && (segurar <= 0 || this.segurou(m, segurar, melhor.lado)))
        this.ciclo.passaram.push({ m, d: melhor.d, lado: melhor.lado });
    }
    this.ciclo.i = ini + passo;
    if (this.ciclo.i >= this.modelos.length) {
      // fim do ciclo: o gesto que combinou melhor (em proporção ao limite dele) e que vale em algum lugar agora vence
      const lista = this.ciclo.passaram.sort((x, y) => x.d / x.m.limite - y.d / y.m.limite);
      this.ciclo = { i: 0, passaram: [] };
      for (const p of lista) {
        const ev = this.aplicar(p.m, p.lado, a.t);
        if (ev.length) { saida.push(...ev); this.buffer = this.buffer.slice(-1); break; }
      }
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
    const candidatos: { m: Modelo; n: number }[] = [];
    for (const m of this.modelos) {
      if (!this.algumUsoAgora(m, e.t)) continue;
      for (const f of m.fichas) {
        const n = f.lista.length; if (viva.length < n) continue;
        const fim = viva.slice(viva.length - n);
        if (fim.some((x, i) => x.f !== f.lista[i])) continue;
        if (fim[n - 1].t - fim[0].t > Math.max(0.4, f.tempo * 1.5) * m.limite + 0.3) continue;
        if (e.t - fim[n - 1].t > 0.3) continue;
        candidatos.push({ m, n });
      }
    }
    candidatos.sort((x, y) => y.n - x.n); // a sequência mais longa ganha (Q, Q, E vence só E)
    for (const c of candidatos) {
      const ev = this.aplicar(c.m, 'dir', e.t);
      if (ev.length) { this.eventosVivos = []; this.fichasVivas = []; return [...saida, ...ev]; }
    }
    return saida;
  }

  private amostraViva(t: number): Amostra {
    const b = this.buffer; let i = b.length - 1; while (i > 0 && b[i - 1].t > t) i--;
    const x = b[Math.max(0, i - 1)], y = b[i];
    return Math.abs(t - x.t) < Math.abs(t - y.t) ? x : y;
  }

  /** A pose foi segurada nos últimos `seg` segundos? (as mãos que contam quase não se mexeram em relação à cabeça) */
  private segurou(m: Modelo, seg: number, lado: Lado): boolean {
    const b = this.buffer, fim = b[b.length - 1].t; if (b[0].t > fim - seg + 0.02) return false;
    const conta = m.gesto.ajustes.conta;
    const maos: Lado[] = conta === 'duas_maos' || conta === 'corpo' ? ['esq', 'dir'] : conta === 'cabeca' ? [] : [conta === 'mao_esq' ? (lado === 'dir' ? 'esq' : 'dir') : lado];
    const ult = b[b.length - 1];
    for (let i = b.length - 1; i >= 0 && b[i].t >= fim - seg; i--) {
      for (const l of maos) {
        const p = b[i][l].p, q = ult[l].p, hp = b[i].cabeca.p, hq = ult.cabeca.p;
        if (Math.hypot(p.x - hp.x - (q.x - hq.x), p.y - hp.y - (q.y - hq.y), p.z - hp.z - (q.z - hq.z)) > PARADO) return false;
      }
    }
    return true;
  }

  /** Algum lugar (ação/passo) espera este gesto agora? */
  private algumUsoAgora(m: Modelo, t: number): boolean { return (this.usos.get(m.gesto.id) ?? []).some((u) => this.valeAgora(u, t)); }

  private valeAgora(u: Uso, t: number): boolean {
    if ((this.ultimaVez.get(u.acao.id) ?? -9) > t - 0.8) return false; // depois de disparar, a ação descansa um pouco
    const p = this.progresso.get(u.acao.id), carga = u.acao.carga;
    const passoDaCarga = carga ? u.acao.passos.findIndex((x) => x.id === carga.passo) : -1;
    if (!p) return u.indice === 0;
    // repetir o passo de carga soma um ciclo (até o máximo)
    if (u.indice === passoDaCarga && p.proximo === passoDaCarga + 1) return p.ciclos < carga!.maximo;
    if (u.indice !== p.proximo) return false;
    // o passo depois da carga só vale com o mínimo de ciclos
    return !(carga && p.proximo === passoDaCarga + 1 && p.ciclos < carga.minimo);
  }

  /** Aplica um gesto reconhecido em todas as ações que o esperam agora. */
  private aplicar(m: Modelo, lado: Lado, t: number): EventoReconhecido[] {
    const ev: EventoReconhecido[] = [];
    for (const u of this.usos.get(m.gesto.id) ?? []) {
      if (!this.valeAgora(u, t)) continue;
      const a = u.acao, total = a.passos.length, carga = a.carga;
      let p = this.progresso.get(a.id);
      const passoDaCarga = carga ? a.passos.findIndex((x) => x.id === carga.passo) : -1;
      if (p && u.indice === passoDaCarga && p.proximo === passoDaCarga + 1) {
        p.ciclos++; p.ate = t + a.tempo_maximo;
        const n = nivelDaCarga(carga!, p.ciclos);
        ev.push({ tipo: 'carga', acao: a.id, ciclos: p.ciclos, nivel: n.nome ? n.nome.pt : null, lado });
        continue;
      }
      ev.push({ tipo: 'passo', acao: a.id, passo: a.passos[u.indice].id, alternativa: u.alt.id, indice: u.indice, total, lado });
      if (!p) { p = { proximo: 0, ate: 0, ciclos: 0, lado }; this.progresso.set(a.id, p); }
      if (u.indice === passoDaCarga) { p.ciclos = 1; ev.push({ tipo: 'carga', acao: a.id, ciclos: 1, nivel: nivelDaCarga(carga!, 1).nome?.pt ?? null, lado }); }
      p.proximo = u.indice + 1; p.ate = t + a.tempo_maximo; p.lado = lado;
      if (p.proximo >= total) {
        const n = carga ? nivelDaCarga(carga, p.ciclos) : { ciclos: 0, nome: null };
        ev.push({ tipo: 'disparou', acao: a.id, alternativa: u.alt.id, ciclos: n.ciclos, nivel: n.nome ? n.nome.pt : null, lado });
        this.ultimaVez.set(a.id, t);
        // um poder por vez: as ações que dividem gestos com esta voltam ao começo
        const meus = new Set(gestosDaAcao(a));
        for (const [id] of [...this.progresso]) {
          const outra = todasAcoes(this.config).find((x) => x.id === id);
          if (id === a.id || (outra && gestosDaAcao(outra).some((g) => meus.has(g)))) this.progresso.delete(id);
        }
      }
    }
    return ev;
  }

  private expirar(t: number): EventoReconhecido[] {
    const r: EventoReconhecido[] = [];
    for (const [acao, p] of this.progresso) if (t > p.ate) { this.progresso.delete(acao); r.push({ tipo: 'expirou', acao }); }
    return r;
  }

  /** Ações engatilhadas agora, com a carga e o lado (para o painel e o boneco). */
  engatilhadas(): { acao: string; ciclos: number; lado: Lado; proximo: number }[] {
    return [...this.progresso].map(([acao, p]) => ({ acao, ciclos: p.ciclos, lado: p.lado, proximo: p.proximo }));
  }
}
