// A página do Estúdio (fora do VR): lista das ações à esquerda, o boneco no meio e os detalhes à direita:
// passos da ação (com alternativas e preparações), o gesto escolhido com as gravações e os ajustes (o que conta,
// outra mão, tempo, segurar, tolerância), a biblioteca de preparações, as observações e exportar.

import type { Estudio } from '../nucleo/estudio';
import { CONTA, LIMITES, efeitoDe, gestoPorId } from '../nucleo/config';
import type { Gravacao } from '../nucleo/gravacao';
import { T, tx } from '../textos';

export interface AcoesPagina {
  rever: (g: Gravacao) => void;
  gravar: () => void;
  testar: () => void;
  exportar: (tipo: 'acao' | 'bloco' | 'tudo') => void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function montarEsqueleto(raiz: HTMLElement): void {
  raiz.innerHTML = `
  <header>
    <h1>${T.titulo}</h1><span class="sub">${T.subtitulo}</span>
    <div class="modos">
      <label><input type="radio" name="modo" value="vr" checked> ${T.modoVR}</label>
      <label><input type="radio" name="modo" value="pc"> ${T.modoPC}</label>
    </div>
    <button id="btImportar">${T.importar}</button>
    <button id="btImportarZip">${T.importarZip}</button>
    <button id="btExemplo">${T.exemplo}</button>
    <button id="btVR" class="principal">${T.entrarVR}</button>
    <input type="file" id="arqJson" accept=".json,application/json" hidden>
    <input type="file" id="arqZip" accept=".zip,application/zip" hidden>
  </header>
  <main>
    <nav id="lista"></nav>
    <section id="palco">
      <div id="aviso3d"></div>
      <div id="opcoes3d">
        <label><input type="checkbox" id="opEspelho" checked> ${T.espelho}</label>
        <label><input type="checkbox" id="opAparencia"> ${T.aparencia}</label>
      </div>
    </section>
    <aside id="detalhe"></aside>
  </main>`;
}

export function desenharLista(e: Estudio, el: HTMLElement): void {
  if (!e.config) { el.innerHTML = ''; return; }
  const ativa = e.acao?.id;
  let html = `<div class="suave" style="margin:6px">${T.projeto}: <b>${esc(tx(e.config.nome))}</b> · ${T.personagem}: ${esc(tx(e.config.personagem.nome))}</div>`;
  for (const b of e.config.blocos) {
    const acoes = b.acoes.filter((a) => a.plataformas.includes(e.modo)); if (!acoes.length) continue;
    html += `<h3>${esc(tx(b.nome))}</h3>`;
    for (const a of acoes) {
      const p = e.progressoDaAcao(a);
      html += `<button class="item ${a.id === ativa ? 'ativo' : ''}" data-acao="${a.id}"><div class="nome">${esc(tx(a.nome))}</div>
        <div class="info"><span class="ponto ${p.feitos >= p.total ? 'cheio' : ''}">${p.feitos}/${p.total}</span>${a.opcional ? `<span class="etiqueta">${T.opcional}</span>` : ''}</div></button>`;
    }
  }
  el.innerHTML = html;
  el.querySelectorAll<HTMLButtonElement>('[data-acao]').forEach((b) => b.addEventListener('click', () => e.escolherPorId(b.dataset.acao!)));
}

export function desenharDetalhe(e: Estudio, el: HTMLElement, acoes: AcoesPagina, podeVR: boolean, persistente: boolean): void {
  const cfg = e.config;
  if (!cfg || !e.acao || !e.gesto) { el.innerHTML = `<div id="vazio">${T.semProjeto}</div>`; return; }
  const a = e.acao, g = e.gesto, aj = g.ajustes, notas = e.notas[a.id] ?? { observacoes: '' };
  const ts = e.tentativas(g.id), ocupado = e.ocupado;
  const sugestao = e.modo === 'pc' ? g.sugestao_pc ?? g.sugestao : g.sugestao;
  const usos = e.usosDoGesto(g.id);
  const passos = a.passos.map((p, k) => p.alternativas.map((alt) => {
    const gx = gestoPorId(cfg, alt.gesto)!, n = e.tentativas(gx.id).length, ef = efeitoDe(a, alt);
    const fim = k === a.passos.length - 1;
    return `<button data-gesto="${gx.id}" class="${gx.id === g.id ? 'ativo' : ''}">${k + 1}. ${esc(tx(p.nome))}${p.alternativas.length > 1 ? ' · ' + esc(tx(alt.nome)) : ''}${gx.tipo === 'preparacao' ? ' ⟲' : ''}
      <span class="ponto ${n >= e.repeticoes ? 'cheio' : ''}">${n}/${e.repeticoes}</span>${fim ? ` <span class="suave">→ ${T.direcoes[ef.direcao]}</span>` : ''}</button>`;
  }).join('')).join('');
  const carga = a.carga ? `<div class="suave">${T.carga}: ${a.carga.minimo}–${a.carga.maximo}${a.carga.niveis.length ? ' · ' + a.carga.niveis.map((n) => `${n.ciclos} = ${esc(tx(n.nome))}`).join(', ') : ''}</div>` : '';
  const passoPrep = g.tipo === 'preparacao' ? a.passos.find((p) => p.alternativas.some((x) => x.gesto === g.id)) : undefined;
  const opcoesPrep = e.preparacoes.map((p) => `<option value="${p.id}">${esc(tx(p.nome))} (${e.tentativas(p.id).length}/${e.repeticoes})</option>`).join('');
  const faixa = (id: string, v: number, [min, max]: readonly [number, number], passo: number, rotulo: string, un: string) =>
    `<label class="suave">${rotulo}: <b id="v_${id}">${v.toFixed(2)}</b>${un}<input type="range" id="${id}" min="${min}" max="${max}" step="${passo}" value="${v}"></label>`;
  el.innerHTML = `
    <h2>${esc(tx(a.nome))}</h2>
    <div class="etiquetas"><span class="etiqueta">${T.tipos[a.tipo]}</span>${a.opcional ? `<span class="etiqueta">${T.opcional}</span>` : ''}</div>
    ${a.condicoes ? `<div class="caixa"><b>${T.condicoes}</b>${esc(tx(a.condicoes))}</div>` : ''}
    <div class="caixa"><b>${T.passos}</b><div class="abas">${passos}</div>${carga}
      ${a.passos.length < 6 ? `<div class="linha" style="margin-top:8px"><select id="selPrep"><option value="">${T.usarPreparacao}…</option>${opcoesPrep}<option value="__nova">+ ${T.novaPreparacao}</option></select></div>` : ''}</div>
    <div class="caixa"><b>${esc(tx(g.nome))}${g.tipo === 'preparacao' ? ' · ' + T.preparacao : ''}${usos.length > 1 ? ` · ${T.usadoEm} ${usos.length} ${T.acoesN}` : ''}</b>
      ${esc(tx(sugestao)) || '—'}
      <div class="linha" style="margin-top:8px">${g.tipo === 'preparacao' ? `<button id="btRenomear">${T.renomear}</button>` : ''}${passoPrep ? `<button class="perigo" id="btTirar">${T.tirarDaAcao}</button>` : ''}</div>
    </div>
    <div class="caixa"><b>${T.tentativas} (${ts.length}/${e.repeticoes})</b>
      ${ts.map((x) => `<div class="tentativa"><span>#${x.n} · ${x.data.slice(0, 16).replace('T', ' ')}</span>${x.modo === 'vr' ? `<button data-rever="${x.n}">${T.rever}</button>` : ''}<button class="perigo" data-apagar="${x.n}">${T.apagar}</button></div>`).join('') || '<span class="suave">—</span>'}
      <div class="linha" style="margin-top:8px">
        ${e.modo === 'pc' ? `<button class="principal" id="btGravar" ${ocupado || e.estado === 'testando' ? 'disabled' : ''}>${ocupado ? T.gravando : T.gravar}</button>` : ''}
        <button id="btTestar" ${ocupado ? 'disabled' : ''}>${e.estado === 'testando' ? T.pararTeste : T.testar}</button>
      </div>
      ${e.modo === 'pc' ? `<p class="suave">${T.pcAjuda}</p>` : podeVR ? '' : `<p class="suave">${T.semVR}</p>`}
    </div>
    <div class="caixa"><b>${T.ajustes}</b>
      <label class="suave">${T.conta}: <select id="selConta">${CONTA.map((c) => `<option value="${c}" ${c === aj.conta ? 'selected' : ''}>${T.contas[c]}</option>`).join('')}</select></label>
      <label class="suave"><input type="checkbox" id="ckEspelhado" ${aj.espelhado ? 'checked' : ''}> ${T.espelhado}</label>
      ${faixa('rgDuracao', aj.duracao, LIMITES.duracao, 0.5, T.tempoGravacao, ' s')}
      ${faixa('rgSegurar', aj.segurar, LIMITES.segurar, 0.1, T.segurar, ' s')}
      ${faixa('rgTol', aj.tolerancia, LIMITES.tolerancia, 0.05, T.tolerancia, '×')}
    </div>
    <div class="caixa"><b>${T.observacoes}</b><textarea id="txObs">${esc(notas.observacoes)}</textarea></div>
    <div class="linha"><button id="btExpAcao">${T.exportarAcao}</button><button id="btExpBloco">${T.exportarBloco}</button><button id="btExpTudo">${T.exportarTudo}</button></div>
    <p class="${persistente ? 'suave' : 'erro'}">${persistente ? T.salvoNoNavegador : T.soMemoria}</p>`;
  const $ = <X extends HTMLElement>(s: string) => el.querySelector(s) as X | null;
  el.querySelectorAll<HTMLButtonElement>('[data-gesto]').forEach((b) => b.addEventListener('click', () => e.escolherGesto(b.dataset.gesto!)));
  el.querySelectorAll<HTMLButtonElement>('[data-rever]').forEach((b) => b.addEventListener('click', () => { const x = ts.find((y) => y.n === Number(b.dataset.rever)); if (x) acoes.rever(x); }));
  el.querySelectorAll<HTMLButtonElement>('[data-apagar]').forEach((b) => b.addEventListener('click', () => { const x = ts.find((y) => y.n === Number(b.dataset.apagar)); if (x) void e.apagar(x); }));
  $('#btGravar')?.addEventListener('click', () => acoes.gravar());
  $('#btTestar')?.addEventListener('click', () => acoes.testar());
  $<HTMLSelectElement>('#selPrep')?.addEventListener('change', async (ev) => {
    const v = (ev.target as HTMLSelectElement).value; if (!v) return;
    const id = v === '__nova' ? await e.criarPreparacao(prompt(T.preparacao + '?', `${T.preparacao} ${e.preparacoes.length + 1}`) || `${T.preparacao} ${e.preparacoes.length + 1}`) : v;
    if (id) await e.adicionarPreparacao(a.id, id);
  });
  $('#btRenomear')?.addEventListener('click', () => { const n = prompt(T.renomear, tx(g.nome)); if (n) void e.renomearGesto(g.id, n); });
  $('#btTirar')?.addEventListener('click', () => { if (passoPrep) void e.removerPreparacao(a.id, passoPrep.id); });
  $<HTMLSelectElement>('#selConta')!.addEventListener('change', (ev) => void e.ajustar(g.id, { conta: (ev.target as HTMLSelectElement).value as typeof aj.conta }));
  $<HTMLInputElement>('#ckEspelhado')!.addEventListener('change', (ev) => void e.ajustar(g.id, { espelhado: (ev.target as HTMLInputElement).checked }));
  for (const [id, k] of [['rgDuracao', 'duracao'], ['rgSegurar', 'segurar'], ['rgTol', 'tolerancia']] as const) {
    const r = $<HTMLInputElement>('#' + id)!;
    r.addEventListener('input', () => { $('#v_' + id)!.textContent = Number(r.value).toFixed(2); });
    r.addEventListener('change', () => void e.ajustar(g.id, { [k]: Number(r.value) }));
  }
  let espera = 0;
  $<HTMLTextAreaElement>('#txObs')!.addEventListener('input', (ev) => {
    clearTimeout(espera); const v = (ev.target as HTMLTextAreaElement).value;
    espera = window.setTimeout(() => void e.salvarNotas(a.id, { observacoes: v.slice(0, 2000) }), 400);
  });
  $('#btExpAcao')!.addEventListener('click', () => acoes.exportar('acao'));
  $('#btExpBloco')!.addEventListener('click', () => acoes.exportar('bloco'));
  $('#btExpTudo')!.addEventListener('click', () => acoes.exportar('tudo'));
}
