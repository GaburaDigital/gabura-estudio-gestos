// A página do Estúdio (fora do VR): lista das ações à esquerda, o boneco no meio e os detalhes da ação à direita
// (dica, condições, partes, gravações, observações, tolerância e exportar). Só monta HTML a partir do estado do
// Estúdio; as ações dos botões chamam o Estúdio.

import type { Estudio } from '../nucleo/estudio';
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
      const pontos = a.partes.map((p) => { const n = e.tentativas(a.id, p.id).length; return `<span class="ponto ${n >= e.repeticoes ? 'cheio' : ''}" title="${esc(tx(p.nome))}">${n}/${e.repeticoes}</span>`; }).join('');
      html += `<button class="item ${a.id === ativa ? 'ativo' : ''}" data-acao="${a.id}"><div class="nome">${esc(tx(a.nome))}</div>
        <div class="info">${pontos}${a.opcional ? `<span class="etiqueta">${T.opcional}</span>` : ''}</div></button>`;
    }
  }
  el.innerHTML = html;
  el.querySelectorAll<HTMLButtonElement>('[data-acao]').forEach((b) => b.addEventListener('click', () => e.escolherPorId(b.dataset.acao!)));
}

export function desenharDetalhe(e: Estudio, el: HTMLElement, acoes: AcoesPagina, podeVR: boolean, persistente: boolean): void {
  if (!e.config || !e.acao || !e.parte) { el.innerHTML = `<div id="vazio">${T.semProjeto}</div>`; return; }
  const a = e.acao, p = e.parte, notas = e.notas[a.id] ?? { observacoes: '', tolerancia: 1 };
  const ts = e.tentativas(a.id, p.id);
  const ocupado = e.estado === 'contagem' || e.estado === 'gravando';
  const sugestao = e.modo === 'pc' ? p.sugestao_pc ?? p.sugestao : p.sugestao;
  el.innerHTML = `
    <h2>${esc(tx(a.nome))}</h2>
    <div class="etiquetas"><span class="etiqueta">${T.tipos[a.tipo]}</span><span class="etiqueta">${T.maos[a.maos]}</span>${a.opcional ? `<span class="etiqueta">${T.opcional}</span>` : ''}</div>
    ${a.partes.length > 1 ? `<div class="abas">${a.partes.map((x, i) => `<button data-parte="${i}" class="${i === e.parteIdx ? 'ativo' : ''}">${i + 1}. ${esc(tx(x.nome))}</button>`).join('')}</div>` : ''}
    <div class="caixa"><b>${T.sugestao} · ${esc(tx(p.nome))} · ${T.duracao} ${p.duracao}s</b>${esc(tx(sugestao)) || '—'}</div>
    ${a.condicoes ? `<div class="caixa"><b>${T.condicoes}</b>${esc(tx(a.condicoes))}</div>` : ''}
    <div class="caixa"><b>${T.tentativas} (${ts.length}/${e.repeticoes})</b>
      ${ts.map((g) => `<div class="tentativa"><span>#${g.n} · ${g.data.slice(0, 16).replace('T', ' ')}</span>${g.modo === 'vr' ? `<button data-rever="${g.n}">${T.rever}</button>` : ''}<button class="perigo" data-apagar="${g.n}">${T.apagar}</button></div>`).join('') || '<span class="suave">—</span>'}
      <div class="linha" style="margin-top:8px">
        ${e.modo === 'pc' ? `<button class="principal" id="btGravar" ${ocupado || e.estado === 'testando' ? 'disabled' : ''}>${ocupado ? T.gravando : T.gravar}</button>` : ''}
        <button id="btTestar" ${ocupado ? 'disabled' : ''}>${e.estado === 'testando' ? T.pararTeste : T.testar}</button>
      </div>
      ${e.modo === 'pc' ? `<p class="suave">${T.pcAjuda}</p>` : podeVR ? '' : `<p class="suave">${T.semVR}</p>`}
    </div>
    <div class="caixa"><b>${T.observacoes}</b><textarea id="txObs">${esc(notas.observacoes)}</textarea></div>
    <div class="caixa"><b>${T.tolerancia}: <span id="valTol">${notas.tolerancia.toFixed(2)}</span>×</b><input type="range" id="rgTol" min="0.5" max="2" step="0.05" value="${notas.tolerancia}"></div>
    <div class="linha"><button id="btExpAcao">${T.exportarAcao}</button><button id="btExpBloco">${T.exportarBloco}</button><button id="btExpTudo">${T.exportarTudo}</button></div>
    <p class="${persistente ? 'suave' : 'erro'}">${persistente ? T.salvoNoNavegador : T.soMemoria}</p>`;
  el.querySelectorAll<HTMLButtonElement>('[data-parte]').forEach((b) => b.addEventListener('click', () => e.escolher(e.acaoIdx, Number(b.dataset.parte))));
  el.querySelectorAll<HTMLButtonElement>('[data-rever]').forEach((b) => b.addEventListener('click', () => { const g = ts.find((x) => x.n === Number(b.dataset.rever)); if (g) acoes.rever(g); }));
  el.querySelectorAll<HTMLButtonElement>('[data-apagar]').forEach((b) => b.addEventListener('click', () => { const g = ts.find((x) => x.n === Number(b.dataset.apagar)); if (g) void e.apagar(g); }));
  el.querySelector('#btGravar')?.addEventListener('click', () => acoes.gravar());
  el.querySelector('#btTestar')?.addEventListener('click', () => acoes.testar());
  let espera = 0;
  el.querySelector<HTMLTextAreaElement>('#txObs')!.addEventListener('input', (ev) => {
    clearTimeout(espera); const v = (ev.target as HTMLTextAreaElement).value;
    espera = window.setTimeout(() => void e.salvarNotas(a.id, { observacoes: v.slice(0, 2000) }), 400);
  });
  const rg = el.querySelector<HTMLInputElement>('#rgTol')!;
  rg.addEventListener('input', () => { el.querySelector('#valTol')!.textContent = Number(rg.value).toFixed(2); });
  rg.addEventListener('change', () => void e.salvarNotas(a.id, { tolerancia: Number(rg.value) }));
  el.querySelector('#btExpAcao')!.addEventListener('click', () => acoes.exportar('acao'));
  el.querySelector('#btExpBloco')!.addEventListener('click', () => acoes.exportar('bloco'));
  el.querySelector('#btExpTudo')!.addEventListener('click', () => acoes.exportar('tudo'));
}
