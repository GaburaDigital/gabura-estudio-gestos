// Onde o Estúdio guarda o trabalho no próprio navegador (IndexedDB), para não perder as gravações ao fechar a
// página ou sair do VR. Nada vai para a internet. Para levar para outro aparelho ou para o projeto, use Exportar.
//
// Cada projeto (o "projeto" do arquivo de configuração) guarda: a configuração, as observações e ajustes de cada
// ação, e as gravações (uma por registro, para salvar uma tentativa não regravar todas).

import type { Configuracao, Modo } from './config';
import type { Gravacao } from './gravacao';

export interface NotasAcao { observacoes: string; tolerancia: number }
export interface Projeto { projeto: string; config: Configuracao; notas: Record<string, NotasAcao>; atualizado: string }

const BANCO = 'gabura-estudio-gestos', VERSAO = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, VERSAO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('projetos')) db.createObjectStore('projetos', { keyPath: 'projeto' });
      if (!db.objectStoreNames.contains('gravacoes')) {
        const g = db.createObjectStore('gravacoes', { keyPath: 'chave' });
        g.createIndex('projeto', 'projeto');
      }
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

function pedido<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
}

export const chaveGravacao = (projeto: string, g: Pick<Gravacao, 'modo' | 'acao' | 'parte' | 'n'>) => `${projeto}|${g.modo}|${g.acao}|${g.parte}|${g.n}`;

/** Armazém do navegador. Se o IndexedDB não funcionar (janela anônima, por exemplo), guarda só na memória. */
export class Armazem {
  private db: IDBDatabase | null = null;
  private memoria = { projetos: new Map<string, Projeto>(), gravacoes: new Map<string, Gravacao & { chave: string; projeto: string }>() };
  /** Falso quando está guardando só na memória (a tela avisa). */
  persistente = false;

  async iniciar(): Promise<void> {
    try { this.db = await abrir(); this.persistente = true; } catch { this.db = null; this.persistente = false; }
  }

  async projetos(): Promise<Projeto[]> {
    if (!this.db) return [...this.memoria.projetos.values()];
    return pedido(this.db.transaction('projetos').objectStore('projetos').getAll() as IDBRequest<Projeto[]>);
  }
  async lerProjeto(projeto: string): Promise<Projeto | null> {
    if (!this.db) return this.memoria.projetos.get(projeto) ?? null;
    return (await pedido(this.db.transaction('projetos').objectStore('projetos').get(projeto) as IDBRequest<Projeto | undefined>)) ?? null;
  }
  async salvarProjeto(p: Projeto): Promise<void> {
    p.atualizado = new Date().toISOString();
    if (!this.db) { this.memoria.projetos.set(p.projeto, structuredClone(p)); return; }
    await pedido(this.db.transaction('projetos', 'readwrite').objectStore('projetos').put(p));
  }

  async gravacoes(projeto: string, modo?: Modo): Promise<Gravacao[]> {
    let todas: (Gravacao & { projeto: string })[];
    if (!this.db) todas = [...this.memoria.gravacoes.values()].filter((g) => g.projeto === projeto);
    else todas = await pedido(this.db.transaction('gravacoes').objectStore('gravacoes').index('projeto').getAll(projeto) as IDBRequest<(Gravacao & { projeto: string })[]>);
    return todas.filter((g) => !modo || g.modo === modo).map((g) => { const c = { ...g } as Partial<Gravacao & { chave: string; projeto: string }>; delete c.chave; delete c.projeto; return c as Gravacao; });
  }
  async salvarGravacao(projeto: string, g: Gravacao): Promise<void> {
    const r = { ...g, chave: chaveGravacao(projeto, g), projeto };
    if (!this.db) { this.memoria.gravacoes.set(r.chave, r); return; }
    await pedido(this.db.transaction('gravacoes', 'readwrite').objectStore('gravacoes').put(r));
  }
  async apagarGravacao(projeto: string, g: Pick<Gravacao, 'modo' | 'acao' | 'parte' | 'n'>): Promise<void> {
    const chave = chaveGravacao(projeto, g);
    if (!this.db) { this.memoria.gravacoes.delete(chave); return; }
    await pedido(this.db.transaction('gravacoes', 'readwrite').objectStore('gravacoes').delete(chave));
  }
}
