// Exportar e importar o trabalho do Estúdio num arquivo .zip (uma ação, um bloco ou tudo).
// O zip é o que vai para o projeto do jogo: a configuração de trabalho (com as preparações e os ajustes), as
// observações de cada ação e as gravações de cada gesto. Formato em CONFIGURACAO.md ("O que vem no zip").
// Zips da versão 1 (gravações por ação e parte) também são lidos.

import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { conferirConfig, gestosDaAcao, todasAcoes, ErroConfig, type Acao, type Configuracao } from './config';
import { TAMANHO_QUADRO, migrarGravacao, type EventoPC, type Gravacao } from './gravacao';
import type { NotasAcao } from './armazem';

export const VERSAO_PACOTE = 2;
export type Conteudo = { tipo: 'acao'; acao: string } | { tipo: 'bloco'; bloco: string } | { tipo: 'tudo' };

const json = (v: unknown) => strToU8(JSON.stringify(v, null, 1));

export function nomeDoPacote(config: Configuracao, conteudo: Conteudo): string {
  const qual = conteudo.tipo === 'acao' ? conteudo.acao : conteudo.tipo === 'bloco' ? 'bloco_' + conteudo.bloco : 'tudo';
  return `gestos_${config.projeto}_${qual}.zip`;
}

export function exportar(config: Configuracao, notas: Record<string, NotasAcao>, gravacoes: Gravacao[], conteudo: Conteudo): Uint8Array {
  const acoes: Acao[] = conteudo.tipo === 'acao' ? todasAcoes(config).filter((a) => a.id === conteudo.acao)
    : conteudo.tipo === 'bloco' ? config.blocos.find((b) => b.id === conteudo.bloco)?.acoes ?? [] : todasAcoes(config);
  const gestos = new Set(conteudo.tipo === 'tudo' ? config.gestos.map((g) => g.id) : acoes.flatMap(gestosDaAcao));
  const arquivos: Zippable = {};
  arquivos['estudio_gestos.json'] = json({
    versao_formato: VERSAO_PACOTE, ferramenta: 'gabura-estudio-gestos', projeto: config.projeto,
    exportado: new Date().toISOString(), conteudo, acoes: acoes.map((a) => a.id), gestos: [...gestos],
  });
  arquivos['configuracao.json'] = json(config);
  arquivos['LEIA.txt'] = strToU8(
    'Gestos gravados no Estúdio de Gestos Gabura (gabura-estudio-gestos).\n' +
    'Gestures recorded in the Gabura Gesture Studio.\n\n' +
    'configuracao.json                 ações, passos, gestos e ajustes (com as preparações criadas no Estúdio)\n' +
    'acoes/<acao>/acao.json            observações da ação\n' +
    'gestos/<gesto>/vr/<n>.json        gravações do Meta Quest (cabeça, mãos, gatilho, grip, botões A e X)\n' +
    'gestos/<gesto>/pc/<n>.json        gravações do PC (teclado e mouse)\n' +
    'Formato: CONFIGURACAO.md no repositório gabura-estudio-gestos.\n');
  for (const a of acoes) {
    arquivos[`acoes/${a.id}/acao.json`] = json({ acao: a.id, nome: a.nome, tipo: a.tipo, observacoes: notas[a.id]?.observacoes ?? '', gestos: gestosDaAcao(a) });
  }
  for (const g of gravacoes) if (gestos.has(g.gesto)) arquivos[`gestos/${g.gesto}/${g.modo}/${g.n}.json`] = json(g);
  return zipSync(arquivos, { level: 6 });
}

export interface Importado { config: Configuracao; notas: Record<string, NotasAcao>; gravacoes: Gravacao[] }

export function importar(dados: Uint8Array): Importado {
  let arquivos: Record<string, Uint8Array>;
  try { arquivos = unzipSync(dados); } catch { throw new ErroConfig('o arquivo não é um zip válido'); }
  const ler = (n: string) => { const f = arquivos[n]; if (!f) return null; try { return JSON.parse(strFromU8(f)); } catch { return null; } };
  const cab = ler('estudio_gestos.json');
  if (!cab || cab.ferramenta !== 'gabura-estudio-gestos' || (cab.versao_formato !== 1 && cab.versao_formato !== 2)) throw new ErroConfig('este zip não foi exportado pelo Estúdio de Gestos');
  const config = conferirConfig(ler('configuracao.json'));
  const gestos = new Set(config.gestos.map((g) => g.id)), acoes = new Set(todasAcoes(config).map((a) => a.id));
  const notas: Record<string, NotasAcao> = {}, gravacoes: Gravacao[] = [];
  for (const nome of Object.keys(arquivos)) {
    const o = /\.json$/.test(nome) ? ler(nome) : null; if (!o || typeof o !== 'object') continue;
    let m = /^acoes\/([a-z0-9_]+)\/acao\.json$/.exec(nome);
    if (m && acoes.has(m[1])) { notas[m[1]] = { observacoes: typeof o.observacoes === 'string' ? o.observacoes.slice(0, 2000) : '' }; continue; }
    m = /^gestos\/([a-z0-9_]+)\/(vr|pc)\/(\d+)\.json$/.exec(nome);
    // versão 1: acoes/<acao>/<modo>/<parte>_<n>.json
    const v1 = /^acoes\/([a-z0-9_]+)\/(vr|pc)\/([a-z0-9_]+)_(\d+)\.json$/.exec(nome);
    const g = m ? conferirGravacao(o, m[1], m[2] as 'vr' | 'pc', Number(m[3])) : v1 ? conferirGravacao(o, `${v1[1]}_${v1[3]}`.slice(0, 40), v1[2] as 'vr' | 'pc', Number(v1[4])) : null;
    if (g && gestos.has(g.gesto)) gravacoes.push(g);
  }
  return { config, notas, gravacoes };
}

function conferirGravacao(bruto: Record<string, unknown>, gesto: string, modo: 'vr' | 'pc', n: number): Gravacao | null {
  const o = migrarGravacao(bruto) as unknown as Record<string, unknown> | null;
  if (!o || o.gesto !== gesto || o.modo !== modo || o.n !== n || n < 1 || n > 10) return null;
  const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
  const g: Gravacao = { versao_formato: 2, modo, gesto, n, data: typeof o.data === 'string' ? o.data.slice(0, 40) : '', duracao: num(o.duracao, 0, 30) ? (o.duracao as number) : 0 };
  if (modo === 'vr') {
    if (!Array.isArray(o.quadros) || o.quadros.length > 3000) return null;
    if (!o.quadros.every((q: unknown) => Array.isArray(q) && q.length === TAMANHO_QUADRO && q.every((v) => num(v, -1000, 1000)))) return null;
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
