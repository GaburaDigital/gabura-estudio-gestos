// Exportar e importar o trabalho do Estúdio num arquivo .zip (um gesto, um bloco ou tudo).
// O zip é o que vai para o projeto do jogo: lá, o reconhecedor do jogo lê as gravações e as observações.
// O formato está explicado em CONFIGURACAO.md (seção "O que vem no zip").

import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { conferirConfig, todasAcoes, ErroConfig, type Configuracao } from './config';
import { TAMANHO_QUADRO, VERSAO_GRAVACAO, type EventoPC, type Gravacao } from './gravacao';
import type { NotasAcao } from './armazem';

export const VERSAO_PACOTE = 1;
export type Conteudo = { tipo: 'acao'; acao: string } | { tipo: 'bloco'; bloco: string } | { tipo: 'tudo' };

const json = (v: unknown) => strToU8(JSON.stringify(v, null, 1));

/** Nome sugerido para o arquivo (sem acentos). */
export function nomeDoPacote(config: Configuracao, conteudo: Conteudo): string {
  const qual = conteudo.tipo === 'acao' ? conteudo.acao : conteudo.tipo === 'bloco' ? 'bloco_' + conteudo.bloco : 'tudo';
  return `gestos_${config.projeto}_${qual}.zip`;
}

export function exportar(config: Configuracao, notas: Record<string, NotasAcao>, gravacoes: Gravacao[], conteudo: Conteudo): Uint8Array {
  const acoes = conteudo.tipo === 'acao' ? todasAcoes(config).filter((a) => a.id === conteudo.acao)
    : conteudo.tipo === 'bloco' ? config.blocos.find((b) => b.id === conteudo.bloco)?.acoes ?? [] : todasAcoes(config);
  const arquivos: Zippable = {};
  arquivos['estudio_gestos.json'] = json({
    versao_formato: VERSAO_PACOTE, ferramenta: 'gabura-estudio-gestos', projeto: config.projeto,
    exportado: new Date().toISOString(), conteudo, acoes: acoes.map((a) => a.id),
  });
  arquivos['configuracao.json'] = json(config);
  arquivos['LEIA.txt'] = strToU8(
    'Gestos gravados no Estúdio de Gestos Gabura (gabura-estudio-gestos).\n' +
    'Gestures recorded in the Gabura Gesture Studio.\n\n' +
    'acoes/<acao>/acao.json      observações, tolerância e quantas gravações cada parte tem\n' +
    'acoes/<acao>/vr/<parte>_<n>.json   gravações do Meta Quest (cabeça, mãos, gatilho, grip, botões)\n' +
    'acoes/<acao>/pc/<parte>_<n>.json   gravações do PC (teclado e mouse)\n' +
    'Formato: CONFIGURACAO.md no repositório gabura-estudio-gestos.\n');
  for (const a of acoes) {
    const gs = gravacoes.filter((g) => g.acao === a.id);
    const n = notas[a.id] ?? { observacoes: '', tolerancia: 1 };
    arquivos[`acoes/${a.id}/acao.json`] = json({
      acao: a.id, nome: a.nome, tipo: a.tipo, observacoes: n.observacoes, tolerancia: n.tolerancia,
      partes: a.partes.map((p) => ({ id: p.id, vr: gs.filter((g) => g.parte === p.id && g.modo === 'vr').length, pc: gs.filter((g) => g.parte === p.id && g.modo === 'pc').length })),
    });
    for (const g of gs) arquivos[`acoes/${a.id}/${g.modo}/${g.parte}_${g.n}.json`] = json(g);
  }
  return zipSync(arquivos, { level: 6 });
}

export interface Importado { config: Configuracao; notas: Record<string, NotasAcao>; gravacoes: Gravacao[] }

/** Lê um zip exportado pelo Estúdio. Tudo é conferido: gravações estranhas são ignoradas, não executadas. */
export function importar(dados: Uint8Array): Importado {
  let arquivos: Record<string, Uint8Array>;
  try { arquivos = unzipSync(dados); } catch { throw new ErroConfig('o arquivo não é um zip válido'); }
  const ler = (n: string) => { const f = arquivos[n]; if (!f) return null; try { return JSON.parse(strFromU8(f)); } catch { return null; } };
  const cab = ler('estudio_gestos.json');
  if (!cab || cab.ferramenta !== 'gabura-estudio-gestos' || cab.versao_formato !== VERSAO_PACOTE) throw new ErroConfig('este zip não foi exportado pelo Estúdio de Gestos (versão 1)');
  const config = conferirConfig(ler('configuracao.json'));
  const ids = new Set(todasAcoes(config).map((a) => a.id));
  const notas: Record<string, NotasAcao> = {}, gravacoes: Gravacao[] = [];
  for (const nome of Object.keys(arquivos)) {
    const m = /^acoes\/([a-z0-9_]+)\/(?:acao\.json|(vr|pc)\/([a-z0-9_]+)_(\d+)\.json)$/.exec(nome);
    if (!m || !ids.has(m[1])) continue;
    const o = ler(nome); if (!o || typeof o !== 'object') continue;
    if (!m[2]) {
      notas[m[1]] = { observacoes: typeof o.observacoes === 'string' ? o.observacoes.slice(0, 2000) : '', tolerancia: typeof o.tolerancia === 'number' && o.tolerancia >= 0.3 && o.tolerancia <= 3 ? o.tolerancia : 1 };
      continue;
    }
    const g = conferirGravacao(o, m[1], m[3], m[2] as 'vr' | 'pc', Number(m[4]));
    if (g) gravacoes.push(g);
  }
  return { config, notas, gravacoes };
}

function conferirGravacao(o: Record<string, unknown>, acao: string, parte: string, modo: 'vr' | 'pc', n: number): Gravacao | null {
  if (o.versao_formato !== VERSAO_GRAVACAO || o.acao !== acao || o.parte !== parte || o.modo !== modo || o.n !== n || n < 1 || n > 10) return null;
  const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const g: Gravacao = { versao_formato: 1, modo, acao, parte, n, data: typeof o.data === 'string' ? o.data.slice(0, 40) : '', duracao: num(o.duracao, 0, 30) ? (o.duracao as number) : 0 };
  if (modo === 'vr') {
    if (!Array.isArray(o.quadros) || o.quadros.length > 3000) return null;
    const ok = o.quadros.every((q: unknown) => Array.isArray(q) && q.length === TAMANHO_QUADRO && q.every((v) => num(v, -1000, 1000)));
    if (!ok) return null;
    g.quadros = o.quadros as number[][];
    if (num(o.altura_olhos, 0.5, 3)) g.altura_olhos = o.altura_olhos as number;
    if (num(o.inicio, 0, 30) && num(o.fim, 0, 30)) { g.inicio = o.inicio as number; g.fim = o.fim as number; }
  } else {
    if (!Array.isArray(o.eventos) || o.eventos.length > 5000) return null;
    const ok = o.eventos.every((e: Record<string, unknown>) => e && num(e.t, 0, 30) && ['baixo', 'cima', 'roda', 'mover'].includes(e.tipo as string) && typeof e.codigo === 'string' && (e.codigo as string).length <= 30);
    if (!ok) return null;
    g.eventos = (o.eventos as EventoPC[]).map((e) => ({ t: e.t, tipo: e.tipo, codigo: e.codigo, ...(typeof e.dx === 'number' ? { dx: e.dx } : {}), ...(typeof e.dy === 'number' ? { dy: e.dy } : {}) }));
  }
  return g;
}
