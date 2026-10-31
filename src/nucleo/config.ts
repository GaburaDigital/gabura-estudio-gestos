// Arquivo de ações (configuração) de um projeto: o que gravar, como cada gesto é reconhecido e o que o poder faz
// no modo testar. O formato está explicado em CONFIGURACAO.md.
//
// Versão 2 (C35): os gestos ficam numa biblioteca e as ações usam os gestos pelo nome. Assim a mesma preparação
// (ex.: cotovelo levantado) ou o mesmo engatilhar serve para várias ações e é gravado uma vez só.
// Uma ação é uma sequência de passos (engatilhar, preparar, liberar…); um passo pode ter alternativas (ex.: a
// furadeira libera de três jeitos). A versão 1 continua aceita: é convertida ao abrir.
//
// O arquivo vem de fora: tudo é conferido numa lista fechada de campos e valores. Nada vira código executado.

export type Modo = 'vr' | 'pc';
export type Lingua = 'pt' | 'en';
export interface Texto { pt: string; en: string }

export const TIPOS_ACAO = ['ataque', 'modo', 'combo', 'gesto'] as const;
export type TipoAcao = typeof TIPOS_ACAO[number];
export const TIPOS_GESTO = ['parte', 'preparacao'] as const;
export type TipoGesto = typeof TIPOS_GESTO[number];
/** O que conta no reconhecimento: o resto do corpo é ignorado. */
export const CONTA = ['mao_dir', 'mao_esq', 'duas_maos', 'mao_cabeca', 'cabeca', 'corpo'] as const;
export type Conta = typeof CONTA[number];
export const FORMAS_EFEITO = ['broca', 'tornado', 'raio', 'onda', 'aura', 'projetil', 'explosao', 'brilho', 'lamina'] as const;
export type FormaEfeito = typeof FORMAS_EFEITO[number];
/** De onde o poder sai. "mao" = a mão que fez o gesto (direita ou esquerda, se valeu espelhado). */
export const ORIGENS_EFEITO = ['mao', 'mao_dir', 'mao_esq', 'maos', 'boca', 'corpo', 'chao'] as const;
export type OrigemEfeito = typeof ORIGENS_EFEITO[number];
/** Para onde o poder vai: pulso (para onde o punho aponta), apontar (a mão esticada), cabeça (para onde olha,
 *  um pouco abaixo dos olhos), movimento (a direção do golpe no disparo), frente (frente do corpo), cima, baixo. */
export const DIRECOES = ['pulso', 'apontar', 'cabeca', 'movimento', 'frente', 'cima', 'baixo'] as const;
export type Direcao = typeof DIRECOES[number];
export const ACESSORIOS = ['orelhas_redondas', 'orelhas_pontudas', 'focinho', 'oculos', 'cauda', 'mochila', 'antenas', 'chifres', 'barriga'] as const;
export type Acessorio = typeof ACESSORIOS[number];

export interface AjustesGesto {
  conta: Conta;
  /** Vale feito com a outra mão (espelhado). */
  espelhado: boolean;
  /** Segundos de gravação. */
  duracao: number;
  /** Segundos que a pose final precisa ser segurada (0 = basta passar por ela). */
  segurar: number;
  /** Multiplica o limite do reconhecimento (maior = mais fácil). */
  tolerancia: number;
}
/** `editado`: os ajustes ou o nome foram mudados no Estúdio (continuam quando o arquivo de ações é importado de novo). */
export interface Gesto { id: string; nome: Texto; tipo: TipoGesto; sugestao: Texto; sugestao_pc: Texto | null; ajustes: AjustesGesto; editado?: boolean }
export interface Efeito { forma: FormaEfeito; cor: string; origem: OrigemEfeito; direcao: Direcao; duracao: number }
export interface Alternativa { id: string; nome: Texto; gesto: string; efeito: Efeito | null }
export interface Passo { id: string; nome: Texto; alternativas: Alternativa[] }
/** Carga por ciclos: o gesto do passo é repetido; cada repetição aumenta a carga (até o máximo). */
export interface Carga { passo: string; minimo: number; maximo: number; niveis: { ciclos: number; nome: Texto }[] }
export interface Acao {
  id: string; nome: Texto; tipo: TipoAcao;
  passos: Passo[];
  condicoes: Texto | null;
  opcional: boolean;
  plataformas: Modo[];
  efeito: Efeito;
  /** Segundos que a ação fica engatilhada esperando o próximo passo (contados do último passo ou ciclo). */
  tempo_maximo: number;
  carga: Carga | null;
}
export interface Bloco { id: string; nome: Texto; acoes: Acao[] }
export interface Aparencia {
  altura: number;
  proporcoes: { cabeca: number; ombros: number; bracos: number; pernas: number; tronco: number };
  cores: { corpo: string; frente: string; detalhe: string; maos: string };
  acessorios: Acessorio[];
  maos: 'maos' | 'patas';
}
export interface Configuracao {
  versao_formato: 2;
  projeto: string;
  nome: Texto;
  personagem: { id: string; nome: Texto; aparencia: Aparencia };
  gravacao: { repeticoes: number; contagem: number; duracao_padrao: number };
  gestos: Gesto[];
  blocos: Bloco[];
}

export const APARENCIA_CINZA: Aparencia = {
  altura: 1.7,
  proporcoes: { cabeca: 1, ombros: 1, bracos: 1, pernas: 1, tronco: 1 },
  cores: { corpo: '#9aa3ab', frente: '#b9c0c6', detalhe: '#5d666e', maos: '#868f97' },
  acessorios: [],
  maos: 'maos',
};
export const AJUSTES_PADRAO: AjustesGesto = { conta: 'corpo', espelhado: false, duracao: 2.5, segurar: 0, tolerancia: 1 };
export const LIMITES = { duracao: [0.5, 8], segurar: [0, 2], tolerancia: [0.5, 2] } as const;

// ---------------- conferência ----------------
const ID = /^[a-z0-9_]{1,40}$/;
const COR = /^#[0-9a-fA-F]{6}$/;
const LIMITE_TEXTO = 400;

export class ErroConfig extends Error {}

function objeto(v: unknown, onde: string): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroConfig(`${onde}: esperava um objeto`);
  return v as Record<string, unknown>;
}
function lista(v: unknown, onde: string, max: number): unknown[] {
  if (!Array.isArray(v)) throw new ErroConfig(`${onde}: esperava uma lista`);
  if (v.length > max) throw new ErroConfig(`${onde}: no máximo ${max} itens`);
  return v;
}
export function idValido(v: unknown): v is string { return typeof v === 'string' && ID.test(v); }
function id(v: unknown, onde: string): string {
  if (!idValido(v)) throw new ErroConfig(`${onde}: id inválido (use letras minúsculas, números e _, sem acentos)`);
  return v;
}
function numero(v: unknown, onde: string, min: number, max: number, padrao?: number): number {
  if (v === undefined && padrao !== undefined) return padrao;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new ErroConfig(`${onde}: número entre ${min} e ${max}`);
  return v;
}
function cor(v: unknown, onde: string, padrao: string): string {
  if (v === undefined) return padrao;
  if (typeof v !== 'string' || !COR.test(v)) throw new ErroConfig(`${onde}: cor no formato #rrggbb`);
  return v.toLowerCase();
}
function escolha<X extends string>(v: unknown, opcoes: readonly X[], onde: string, padrao?: X): X {
  if (v === undefined && padrao !== undefined) return padrao;
  if (typeof v !== 'string' || !(opcoes as readonly string[]).includes(v)) throw new ErroConfig(`${onde}: use um de ${opcoes.join(', ')}`);
  return v as X;
}
function texto(v: unknown, onde: string, opcional = false): Texto | null {
  if (v === undefined || v === null) { if (opcional) return null; throw new ErroConfig(`${onde}: falta o texto`); }
  const limpo = (s: unknown, l: string) => {
    if (typeof s !== 'string') throw new ErroConfig(`${onde}.${l}: esperava texto`);
    return s.slice(0, LIMITE_TEXTO);
  };
  if (typeof v === 'string') { const s = limpo(v, 'pt'); return { pt: s, en: s }; }
  const o = objeto(v, onde);
  const pt = limpo(o.pt ?? o.en, 'pt');
  return { pt, en: limpo(o.en ?? pt, 'en') };
}

export function conferirAjustes(v: unknown, onde: string, padrao: AjustesGesto): AjustesGesto {
  const o = v === undefined ? {} : objeto(v, onde);
  return {
    conta: escolha(o.conta, CONTA, onde + '.conta', padrao.conta),
    espelhado: o.espelhado === undefined ? padrao.espelhado : o.espelhado === true,
    duracao: numero(o.duracao, onde + '.duracao', LIMITES.duracao[0], LIMITES.duracao[1], padrao.duracao),
    segurar: numero(o.segurar, onde + '.segurar', LIMITES.segurar[0], LIMITES.segurar[1], padrao.segurar),
    tolerancia: numero(o.tolerancia, onde + '.tolerancia', LIMITES.tolerancia[0], LIMITES.tolerancia[1], padrao.tolerancia),
  };
}

function conferirEfeito(v: unknown, onde: string, padrao?: Efeito): Efeito {
  const o = v === undefined ? {} : objeto(v, onde);
  const p = padrao ?? { forma: 'brilho', cor: '#4fd6d0', origem: 'maos', direcao: 'frente', duracao: 1 };
  return {
    forma: escolha(o.forma, FORMAS_EFEITO, onde + '.forma', p.forma),
    cor: cor(o.cor, onde + '.cor', p.cor),
    origem: escolha(o.origem, ORIGENS_EFEITO, onde + '.origem', p.origem),
    direcao: escolha(o.direcao, DIRECOES, onde + '.direcao', p.direcao),
    duracao: numero(o.duracao, onde + '.duracao', 0.3, 6, p.duracao),
  };
}

/** Confere o arquivo de ações (versão 1 ou 2) e devolve a versão 2 limpa, com os valores padrão preenchidos. */
export function conferirConfig(bruto: unknown): Configuracao {
  const o = objeto(bruto, 'arquivo');
  if (o.versao_formato !== 1 && o.versao_formato !== 2) throw new ErroConfig('versao_formato: este Estúdio lê as versões 1 e 2');
  const g = o.gravacao === undefined ? {} : objeto(o.gravacao, 'gravacao');
  const gravacao = {
    repeticoes: Math.round(numero(g.repeticoes, 'gravacao.repeticoes', 1, 10, 5)),
    contagem: Math.round(numero(g.contagem, 'gravacao.contagem', 0, 5, 3)),
    duracao_padrao: numero(g.duracao_padrao, 'gravacao.duracao_padrao', 0.5, 8, 2.5),
  };
  const p = objeto(o.personagem ?? { id: 'boneco', nome: 'Boneco' }, 'personagem');
  const gestos = new Map<string, Gesto>();
  const padraoGesto = { ...AJUSTES_PADRAO, duracao: gravacao.duracao_padrao };
  if (o.versao_formato === 2 && o.gestos !== undefined) {
    lista(o.gestos, 'gestos', 300).forEach((x, i) => {
      const go = objeto(x, `gestos[${i}]`), gid = id(go.id, `gestos[${i}].id`);
      if (gestos.has(gid)) throw new ErroConfig(`gestos: "${gid}" repetido`);
      gestos.set(gid, {
        id: gid, nome: texto(go.nome ?? gid, `gestos[${i}].nome`)!, tipo: escolha(go.tipo, TIPOS_GESTO, `gestos[${i}].tipo`, 'parte'),
        sugestao: texto(go.sugestao ?? '', `gestos[${i}].sugestao`)!, sugestao_pc: texto(go.sugestao_pc, `gestos[${i}].sugestao_pc`, true),
        ajustes: conferirAjustes(go.ajustes, `gestos[${i}].ajustes`, padraoGesto),
        ...(go.editado === true ? { editado: true } : {}),
      });
    });
  }
  const ids = new Set<string>();
  const blocos = lista(o.blocos, 'blocos', 30).map((b, i) => {
    const bo = objeto(b, `blocos[${i}]`);
    const bid = id(bo.id, `blocos[${i}].id`);
    return {
      id: bid, nome: texto(bo.nome, `blocos[${i}].nome`)!,
      acoes: lista(bo.acoes, `blocos[${i}].acoes`, 60).map((a, j) => o.versao_formato === 1
        ? acaoDaVersao1(a, `${bid}.acoes[${j}]`, padraoGesto, ids, gestos)
        : conferirAcao(a, `${bid}.acoes[${j}]`, ids, gestos)),
    };
  });
  if (!blocos.some((b) => b.acoes.length)) throw new ErroConfig('blocos: nenhuma ação para gravar');
  return {
    versao_formato: 2, projeto: id(o.projeto, 'projeto'), nome: texto(o.nome ?? o.projeto, 'nome')!,
    personagem: { id: id(p.id ?? 'boneco', 'personagem.id'), nome: texto(p.nome ?? 'Boneco', 'personagem.nome')!, aparencia: conferirAparencia(p.aparencia) },
    gravacao, gestos: [...gestos.values()], blocos,
  };
}

function plataformasDe(v: unknown, onde: string): Modo[] {
  return v === undefined ? ['vr', 'pc'] : [...new Set(lista(v, onde, 2).map((x) => escolha(x, ['vr', 'pc'] as const, onde)))];
}

function conferirAcao(a: unknown, onde: string, ids: Set<string>, gestos: Map<string, Gesto>): Acao {
  const o = objeto(a, onde), aid = id(o.id, onde + '.id');
  if (ids.has(aid)) throw new ErroConfig(`${onde}.id: "${aid}" repetido`); ids.add(aid);
  const efeito = conferirEfeito(o.efeito, onde + '.efeito');
  const pids = new Set<string>();
  const passos = lista(o.passos, onde + '.passos', 6).map((pb, k): Passo => {
    const po = objeto(pb, `${onde}.passos[${k}]`), pid = id(po.id, `${onde}.passos[${k}].id`);
    if (pids.has(pid)) throw new ErroConfig(`${onde}.passos: "${pid}" repetido`); pids.add(pid);
    // um passo usa um gesto ("gesto") ou tem alternativas (qualquer uma vale)
    const alts = po.alternativas === undefined ? [{ id: pid, nome: po.nome ?? pid, gesto: po.gesto }] : lista(po.alternativas, `${onde}.passos[${k}].alternativas`, 6);
    if (!alts.length) throw new ErroConfig(`${onde}.passos[${k}]: sem gesto`);
    const aids = new Set<string>();
    return {
      id: pid, nome: texto(po.nome ?? pid, `${onde}.passos[${k}].nome`)!,
      alternativas: alts.map((x, m) => {
        const xo = objeto(x, `${onde}.passos[${k}].alternativas[${m}]`), xid = id(xo.id, `${onde}.passos[${k}].alternativas[${m}].id`);
        if (aids.has(xid)) throw new ErroConfig(`${onde}.passos[${k}]: alternativa "${xid}" repetida`); aids.add(xid);
        const gid = id(xo.gesto, `${onde}.passos[${k}].alternativas[${m}].gesto`);
        if (!gestos.has(gid)) throw new ErroConfig(`${onde}: o gesto "${gid}" não está na lista de gestos`);
        return { id: xid, nome: texto(xo.nome ?? xid, `${onde}.alternativas[${m}].nome`)!, gesto: gid, efeito: xo.efeito === undefined || xo.efeito === null ? null : conferirEfeito(xo.efeito, `${onde}.alternativas[${m}].efeito`, efeito) };
      }),
    };
  });
  if (!passos.length) throw new ErroConfig(onde + '.passos: pelo menos um passo');
  return {
    id: aid, nome: texto(o.nome, onde + '.nome')!,
    tipo: escolha(o.tipo, TIPOS_ACAO, onde + '.tipo', passos.length > 1 ? 'ataque' : 'gesto'),
    passos, condicoes: texto(o.condicoes, onde + '.condicoes', true), opcional: o.opcional === true,
    plataformas: plataformasDe(o.plataformas, onde + '.plataformas'), efeito,
    tempo_maximo: numero(o.tempo_maximo, onde + '.tempo_maximo', 0.5, 30, 5),
    carga: conferirCarga(o.carga, onde + '.carga', passos),
  };
}

function conferirCarga(v: unknown, onde: string, passos: Passo[]): Carga | null {
  if (v === undefined || v === null) return null;
  const o = objeto(v, onde);
  const passo = id(o.passo ?? passos[0].id, onde + '.passo');
  if (!passos.some((p) => p.id === passo)) throw new ErroConfig(`${onde}.passo: "${passo}" não é um passo da ação`);
  const minimo = Math.round(numero(o.minimo, onde + '.minimo', 1, 30, 1)), maximo = Math.round(numero(o.maximo, onde + '.maximo', minimo, 30, minimo));
  const niveis = o.niveis === undefined ? [] : lista(o.niveis, onde + '.niveis', 10).map((n, i) => {
    const no = objeto(n, `${onde}.niveis[${i}]`);
    return { ciclos: Math.round(numero(no.ciclos, `${onde}.niveis[${i}].ciclos`, 1, 30)), nome: texto(no.nome, `${onde}.niveis[${i}].nome`)! };
  }).sort((a, b) => a.ciclos - b.ciclos);
  return { passo, minimo, maximo, niveis };
}

/** Versão 1: cada parte da ação vira um gesto da biblioteca (`<acao>_<parte>`) e um passo. */
function acaoDaVersao1(a: unknown, onde: string, padrao: AjustesGesto, ids: Set<string>, gestos: Map<string, Gesto>): Acao {
  const o = objeto(a, onde), aid = id(o.id, onde + '.id');
  if (ids.has(aid)) throw new ErroConfig(`${onde}.id: "${aid}" repetido`); ids.add(aid);
  const maos = escolha(o.maos, ['uma', 'duas', 'qualquer'] as const, onde + '.maos', 'qualquer');
  const conta: Conta = maos === 'uma' ? 'mao_dir' : maos === 'duas' ? 'duas_maos' : 'corpo';
  const partes = o.partes === undefined ? [{ id: 'gesto', nome: 'Gesto', sugestao: o.sugestao ?? '' }] : lista(o.partes, onde + '.partes', 4);
  const ef = o.efeito === undefined ? {} : objeto(o.efeito, onde + '.efeito');
  const origem = ef.origem === 'mao_dir' || ef.origem === 'mao_esq' ? 'mao' : ef.origem;
  const efeito = conferirEfeito({ ...ef, origem }, onde + '.efeito');
  const pids = new Set<string>();
  const passos: Passo[] = partes.map((pb, k) => {
    const po = objeto(pb, `${onde}.partes[${k}]`), pid = id(po.id, `${onde}.partes[${k}].id`);
    if (pids.has(pid)) throw new ErroConfig(`${onde}.partes: "${pid}" repetido`); pids.add(pid);
    const gid = `${aid}_${pid}`.slice(0, 40);
    gestos.set(gid, {
      id: gid, nome: texto(po.nome ?? pid, `${onde}.partes[${k}].nome`)!, tipo: 'parte',
      sugestao: texto(po.sugestao ?? '', `${onde}.partes[${k}].sugestao`)!, sugestao_pc: texto(po.sugestao_pc, `${onde}.partes[${k}].sugestao_pc`, true),
      ajustes: { ...padrao, conta, espelhado: maos !== 'duas', duracao: numero(po.duracao, `${onde}.partes[${k}].duracao`, 0.5, 8, padrao.duracao) },
    });
    return { id: pid, nome: texto(po.nome ?? pid, `${onde}.partes[${k}].nome`)!, alternativas: [{ id: pid, nome: texto(po.nome ?? pid, onde)!, gesto: gid, efeito: null }] };
  });
  return {
    id: aid, nome: texto(o.nome, onde + '.nome')!, tipo: escolha(o.tipo, TIPOS_ACAO, onde + '.tipo', passos.length > 1 ? 'ataque' : 'gesto'),
    passos, condicoes: texto(o.condicoes, onde + '.condicoes', true), opcional: o.opcional === true,
    plataformas: plataformasDe(o.plataformas, onde + '.plataformas'), efeito,
    tempo_maximo: numero(o.tempo_maximo, onde + '.tempo_maximo', 0.5, 30, 5), carga: null,
  };
}

function conferirAparencia(v: unknown): Aparencia {
  if (v === undefined) return structuredClone(APARENCIA_CINZA);
  const o = objeto(v, 'personagem.aparencia');
  const pr = o.proporcoes === undefined ? {} : objeto(o.proporcoes, 'aparencia.proporcoes');
  const c = o.cores === undefined ? {} : objeto(o.cores, 'aparencia.cores');
  const P = APARENCIA_CINZA.proporcoes, C = APARENCIA_CINZA.cores;
  const prop = (k: keyof Aparencia['proporcoes']) => numero(pr[k], 'aparencia.proporcoes.' + k, 0.5, 2, P[k]);
  return {
    altura: numero(o.altura, 'aparencia.altura', 0.3, 6, APARENCIA_CINZA.altura),
    proporcoes: { cabeca: prop('cabeca'), ombros: prop('ombros'), bracos: prop('bracos'), pernas: prop('pernas'), tronco: prop('tronco') },
    cores: { corpo: cor(c.corpo, 'aparencia.cores.corpo', C.corpo), frente: cor(c.frente, 'aparencia.cores.frente', C.frente), detalhe: cor(c.detalhe, 'aparencia.cores.detalhe', C.detalhe), maos: cor(c.maos, 'aparencia.cores.maos', C.maos) },
    acessorios: o.acessorios === undefined ? [] : [...new Set(lista(o.acessorios, 'aparencia.acessorios', ACESSORIOS.length).map((x) => escolha(x, ACESSORIOS, 'aparencia.acessorios')))],
    maos: escolha(o.maos, ['maos', 'patas'] as const, 'aparencia.maos', 'maos'),
  };
}

// ---------------- consultas ----------------
export function todasAcoes(c: Configuracao): Acao[] { return c.blocos.flatMap((b) => b.acoes); }
export function gestoPorId(c: Configuracao, id: string): Gesto | undefined { return c.gestos.find((g) => g.id === id); }
/** Gestos que uma ação usa (sem repetir). */
export function gestosDaAcao(a: Acao): string[] { return [...new Set(a.passos.flatMap((p) => p.alternativas.map((x) => x.gesto)))]; }
/** Ações que usam um gesto. */
export function acoesDoGesto(c: Configuracao, gesto: string): Acao[] { return todasAcoes(c).filter((a) => gestosDaAcao(a).includes(gesto)); }
/** Efeito de uma alternativa (o próprio ou o da ação). */
export function efeitoDe(a: Acao, alt: Alternativa | null): Efeito { return alt?.efeito ?? a.efeito; }
/** Nível de carga pelo número de ciclos (sem níveis, o próprio número). */
export function nivelDaCarga(c: Carga, ciclos: number): { ciclos: number; nome: Texto | null } {
  const n = Math.min(c.maximo, ciclos);
  if (!c.niveis.length) return { ciclos: n, nome: null };
  let nivel: Carga['niveis'][number] | null = null;
  for (const x of c.niveis) if (n >= x.ciclos) nivel = x;
  return { ciclos: nivel?.ciclos ?? n, nome: nivel?.nome ?? null };
}
