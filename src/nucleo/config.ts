// Arquivo de configuração de um projeto (o "arquivo de ações" que o autor importa no Estúdio).
// Ele diz quais ações gravar, em quantas partes (ex.: engatilhar e liberar), dicas de como fazer, condições,
// o efeito que aparece no modo testar e a aparência do boneco. O formato está explicado em CONFIGURACAO.md.
//
// O arquivo vem de fora (outro projeto, outra pessoa): tudo é conferido numa lista fechada de campos e valores.
// Nada do arquivo vira código executado; textos são só mostrados.

export type Modo = 'vr' | 'pc';
export type Lingua = 'pt' | 'en';
export interface Texto { pt: string; en: string }

export const TIPOS_ACAO = ['ataque', 'modo', 'combo', 'gesto'] as const;
export type TipoAcao = typeof TIPOS_ACAO[number];
export const MAOS = ['uma', 'duas', 'qualquer'] as const;
export type Maos = typeof MAOS[number];
export const FORMAS_EFEITO = ['tornado', 'raio', 'onda', 'aura', 'projetil', 'explosao', 'brilho', 'lamina'] as const;
export type FormaEfeito = typeof FORMAS_EFEITO[number];
export const ORIGENS_EFEITO = ['mao_dir', 'mao_esq', 'maos', 'boca', 'corpo', 'chao'] as const;
export type OrigemEfeito = typeof ORIGENS_EFEITO[number];
export const ACESSORIOS = ['orelhas_redondas', 'orelhas_pontudas', 'focinho', 'oculos', 'cauda', 'mochila', 'antenas', 'chifres', 'barriga'] as const;
export type Acessorio = typeof ACESSORIOS[number];

export interface Parte {
  id: string;
  nome: Texto;
  /** Como fazer (sugestão do projeto; quem grava decide o gesto de verdade). */
  sugestao: Texto;
  /** Sugestão para o modo PC (teclas e mouse), se for diferente. */
  sugestao_pc: Texto | null;
  /** Segundos de gravação depois da contagem. */
  duracao: number;
}
export interface Acao {
  id: string;
  nome: Texto;
  tipo: TipoAcao;
  maos: Maos;
  partes: Parte[];
  condicoes: Texto | null;
  opcional: boolean;
  plataformas: Modo[];
  efeito: { forma: FormaEfeito; cor: string; origem: OrigemEfeito };
  /** Ataque engatilhado: tempo máximo (s) entre a última parte engatilhada e a liberação. */
  tempo_maximo: number;
}
export interface Bloco { id: string; nome: Texto; acoes: Acao[] }
export interface Aparencia {
  /** Altura do personagem em metros (o boneco é desenhado nesse tamanho). */
  altura: number;
  proporcoes: { cabeca: number; ombros: number; bracos: number; pernas: number; tronco: number };
  cores: { corpo: string; frente: string; detalhe: string; maos: string };
  acessorios: Acessorio[];
  maos: 'maos' | 'patas';
}
export interface Configuracao {
  versao_formato: 1;
  projeto: string;
  nome: Texto;
  personagem: { id: string; nome: Texto; aparencia: Aparencia };
  gravacao: { repeticoes: number; contagem: number; duracao_padrao: number };
  blocos: Bloco[];
}

export const APARENCIA_CINZA: Aparencia = {
  altura: 1.7,
  proporcoes: { cabeca: 1, ombros: 1, bracos: 1, pernas: 1, tronco: 1 },
  cores: { corpo: '#9aa3ab', frente: '#b9c0c6', detalhe: '#5d666e', maos: '#868f97' },
  acessorios: [],
  maos: 'maos',
};

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
function id(v: unknown, onde: string): string {
  if (typeof v !== 'string' || !ID.test(v)) throw new ErroConfig(`${onde}: id inválido (use letras minúsculas, números e _, sem acentos)`);
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
/** Texto em PT e EN. Aceita uma string só (vale para as duas línguas). */
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

/** Confere o arquivo de configuração e devolve a versão limpa (com os valores padrão preenchidos). */
export function conferirConfig(bruto: unknown): Configuracao {
  const o = objeto(bruto, 'arquivo');
  if (o.versao_formato !== 1) throw new ErroConfig('versao_formato: este Estúdio lê a versão 1');
  const g = o.gravacao === undefined ? {} : objeto(o.gravacao, 'gravacao');
  const gravacao = {
    repeticoes: Math.round(numero(g.repeticoes, 'gravacao.repeticoes', 1, 10, 5)),
    contagem: Math.round(numero(g.contagem, 'gravacao.contagem', 0, 5, 3)),
    duracao_padrao: numero(g.duracao_padrao, 'gravacao.duracao_padrao', 0.5, 8, 2.5),
  };
  const p = objeto(o.personagem ?? { id: 'boneco', nome: 'Boneco' }, 'personagem');
  const ids = new Set<string>();
  const blocos = lista(o.blocos, 'blocos', 30).map((b, i) => {
    const bo = objeto(b, `blocos[${i}]`);
    const bid = id(bo.id, `blocos[${i}].id`);
    return {
      id: bid, nome: texto(bo.nome, `blocos[${i}].nome`)!,
      acoes: lista(bo.acoes, `blocos[${i}].acoes`, 60).map((a, j) => conferirAcao(a, `${bid}.acoes[${j}]`, gravacao.duracao_padrao, ids)),
    };
  });
  if (!blocos.some((b) => b.acoes.length)) throw new ErroConfig('blocos: nenhuma ação para gravar');
  return {
    versao_formato: 1,
    projeto: id(o.projeto, 'projeto'),
    nome: texto(o.nome ?? o.projeto, 'nome')!,
    personagem: { id: id(p.id ?? 'boneco', 'personagem.id'), nome: texto(p.nome ?? 'Boneco', 'personagem.nome')!, aparencia: conferirAparencia(p.aparencia) },
    gravacao, blocos,
  };
}

function conferirAcao(a: unknown, onde: string, duracaoPadrao: number, ids: Set<string>): Acao {
  const o = objeto(a, onde);
  const aid = id(o.id, onde + '.id');
  if (ids.has(aid)) throw new ErroConfig(`${onde}.id: "${aid}" repetido`);
  ids.add(aid);
  const partesBrutas = o.partes === undefined ? [{ id: 'gesto', nome: { pt: 'Gesto', en: 'Gesture' }, sugestao: o.sugestao ?? '' }] : lista(o.partes, onde + '.partes', 4);
  if (!partesBrutas.length) throw new ErroConfig(onde + '.partes: pelo menos uma parte');
  const pids = new Set<string>();
  const partes = partesBrutas.map((pb, k) => {
    const po = objeto(pb, `${onde}.partes[${k}]`);
    const pid = id(po.id, `${onde}.partes[${k}].id`);
    if (pids.has(pid)) throw new ErroConfig(`${onde}.partes: "${pid}" repetido`); pids.add(pid);
    return {
      id: pid, nome: texto(po.nome ?? pid, `${onde}.partes[${k}].nome`)!,
      sugestao: texto(po.sugestao ?? '', `${onde}.partes[${k}].sugestao`)!,
      sugestao_pc: texto(po.sugestao_pc, `${onde}.partes[${k}].sugestao_pc`, true),
      duracao: numero(po.duracao, `${onde}.partes[${k}].duracao`, 0.5, 8, duracaoPadrao),
    };
  });
  const ef = o.efeito === undefined ? {} : objeto(o.efeito, onde + '.efeito');
  const plataformas: Modo[] = o.plataformas === undefined ? ['vr', 'pc'] : lista(o.plataformas, onde + '.plataformas', 2).map((x) => escolha(x, ['vr', 'pc'] as const, onde + '.plataformas'));
  return {
    id: aid, nome: texto(o.nome, onde + '.nome')!,
    tipo: escolha(o.tipo, TIPOS_ACAO, onde + '.tipo', partes.length > 1 ? 'ataque' : 'gesto'),
    maos: escolha(o.maos, MAOS, onde + '.maos', 'qualquer'),
    partes,
    condicoes: texto(o.condicoes, onde + '.condicoes', true),
    opcional: o.opcional === true,
    plataformas: [...new Set(plataformas)],
    efeito: { forma: escolha(ef.forma, FORMAS_EFEITO, onde + '.efeito.forma', 'brilho'), cor: cor(ef.cor, onde + '.efeito.cor', '#4fd6d0'), origem: escolha(ef.origem, ORIGENS_EFEITO, onde + '.efeito.origem', 'maos') },
    tempo_maximo: numero(o.tempo_maximo, onde + '.tempo_maximo', 0.5, 30, 5),
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

/** Todas as ações, na ordem dos blocos. */
export function todasAcoes(c: Configuracao): Acao[] { return c.blocos.flatMap((b) => b.acoes); }
