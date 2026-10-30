// Estúdio de Gestos Gabura: página, cena 3D, VR e teclado/mouse.
// - Gravar para VR: no Quest, entre no VR e use o painel à esquerda (analógico escolhe, A grava, B apaga, X revê,
//   Y testa). O boneco à frente imita você e repete cada gravação.
// - Gravar para PC: clique em Gravar e faça a sequência de teclas e mouse depois da contagem.
// Tudo fica guardado no navegador; Exportar gera o .zip que vai para o projeto do jogo.

import './estilo.css';
import * as THREE from 'three';
import { conferirConfig, APARENCIA_CINZA, ErroConfig, type Acao } from './nucleo/config';
import { Armazem } from './nucleo/armazem';
import { Estudio } from './nucleo/estudio';
import { amostraNoTempo, bitsDosBotoes, quadroParaAmostra, type Amostra, type Gravacao } from './nucleo/gravacao';
import { exportar, importar, nomeDoPacote, type Conteudo } from './nucleo/pacote';
import type { EventoReconhecido } from './nucleo/reconhecedor';
import { Boneco, type PoseBoneco } from './boneco/boneco';
import { Efeitos } from './boneco/efeitos';
import { poseDaAmostra, referenciaDe, type Referencia } from './boneco/pose';
import { PainelVR } from './interface/painel_vr';
import { desenharDetalhe, desenharLista, montarEsqueleto } from './interface/pagina';
import { entrada, ligarControlesVR, lerVR, vibrar } from './xr/entrada';
import { T, tx } from './textos';

const DISTANCIA_BONECO = 2.2; // m à frente de quem grava

async function iniciar(): Promise<void> {
  const raiz = document.getElementById('app')!;
  montarEsqueleto(raiz);
  const $ = <E extends HTMLElement>(s: string) => raiz.querySelector(s) as E;
  const armazem = new Armazem(); await armazem.iniciar();
  const estudio = new Estudio(armazem);

  // ---------------- cena ----------------
  const palco = $('#palco');
  const render = new THREE.WebGLRenderer({ antialias: true });
  render.setPixelRatio(Math.min(2, devicePixelRatio)); render.xr.enabled = true;
  palco.appendChild(render.domElement);
  const cena = new THREE.Scene(); cena.background = new THREE.Color('#0c1a24');
  cena.add(new THREE.HemisphereLight('#dfefff', '#26343c', 2.2));
  const sol = new THREE.DirectionalLight('#ffffff', 1.6); sol.position.set(2, 5, 3); cena.add(sol);
  const chao = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshStandardMaterial({ color: '#183240', roughness: 1 }));
  chao.rotation.x = -Math.PI / 2; cena.add(chao);
  const grade = new THREE.GridHelper(8, 16, '#2a4a5a', '#21404e'); grade.position.y = 0.002; cena.add(grade);
  const rig = new THREE.Group(); cena.add(rig);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60); rig.add(camera);
  const lugarBoneco = new THREE.Group(); lugarBoneco.position.set(0, 0, -DISTANCIA_BONECO); lugarBoneco.rotation.y = Math.PI; cena.add(lugarBoneco);
  const efeitos = new Efeitos(); cena.add(efeitos.grupo);
  const painel = new PainelVR(); painel.malha.visible = false; rig.add(painel.malha);
  ligarControlesVR(render, rig);
  for (const m of Object.values(entrada.maos)) rig.add(m.pose); // até conectar, as mãos ficam no rig (testes simulados)

  let boneco = new Boneco(APARENCIA_CINZA); lugarBoneco.add(boneco.grupo);
  let usarAparencia = false, espelho = true;
  function trocarBoneco(): void {
    boneco.descartar();
    boneco = new Boneco(usarAparencia && estudio.config ? estudio.config.personagem.aparencia : APARENCIA_CINZA);
    lugarBoneco.add(boneco.grupo);
    posicionarCameraPC();
  }
  function posicionarCameraPC(): void {
    if (entrada.modo === 'vr') return;
    const H = boneco.altura;
    camera.position.set(0.0, H * 0.6, -DISTANCIA_BONECO + 0.6 + H * 1.3);
    camera.lookAt(0, H * 0.47, -DISTANCIA_BONECO);
  }
  function redimensionar(): void {
    const r = palco.getBoundingClientRect(), w = Math.max(50, r.width), h = Math.max(50, r.height);
    render.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionar).observe(palco); redimensionar(); posicionarCameraPC();

  // ---------------- página ----------------
  let podeVR = false;
  const relogio = () => performance.now() / 1000;
  const aviso3d = $('#aviso3d');
  let avisoAte = 0;
  function avisar(s: string, segundos = 2.5): void { aviso3d.textContent = s; avisoAte = relogio() + segundos; }
  function redesenhar(): void {
    desenharLista(estudio, $('#lista'));
    desenharDetalhe(estudio, $('#detalhe'), { rever: comecarReprise, gravar: () => estudio.gravar(relogio()), testar, exportar: exportarPacote }, podeVR, armazem.persistente);
    $<HTMLButtonElement>('#btVR').hidden = estudio.modo !== 'vr';
    $<HTMLButtonElement>('#btVR').disabled = !podeVR;
    $<HTMLButtonElement>('#btVR').title = podeVR ? '' : T.semVR;
  }
  estudio.aoMudar = () => {
    redesenhar();
    if (estudio.ultimaGravada) { const g = estudio.ultimaGravada; estudio.ultimaGravada = null; if (g.modo === 'vr') comecarReprise(g); }
    if (estudio.aviso && estudio.estado === 'parado') avisar((T.avisos[estudio.aviso.chave] ?? '') + (estudio.aviso.valor ? ' ' + estudio.aviso.valor : ''));
  };
  estudio.aoReconhecer = reconheceu;

  raiz.querySelectorAll<HTMLInputElement>('input[name=modo]').forEach((r) => r.addEventListener('change', () => { if (r.checked) estudio.trocarModo(r.value as 'vr' | 'pc'); }));
  $<HTMLInputElement>('#opEspelho').addEventListener('change', (ev) => { espelho = (ev.target as HTMLInputElement).checked; });
  $<HTMLInputElement>('#opAparencia').addEventListener('change', (ev) => { usarAparencia = (ev.target as HTMLInputElement).checked; trocarBoneco(); });
  $('#btImportar').addEventListener('click', () => $<HTMLInputElement>('#arqJson').click());
  $('#btImportarZip').addEventListener('click', () => $<HTMLInputElement>('#arqZip').click());
  $<HTMLInputElement>('#arqJson').addEventListener('change', async (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ''; if (!f) return;
    try { await abrirConfig(JSON.parse(await f.text())); } catch (e) { mostrarErro(e); }
  });
  $<HTMLInputElement>('#arqZip').addEventListener('change', async (ev) => {
    const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ''; if (!f) return;
    try { const r = importar(new Uint8Array(await f.arrayBuffer())); await estudio.abrirProjeto(r.config, r.notas, r.gravacoes); trocarBoneco(); }
    catch (e) { mostrarErro(e); }
  });
  $('#btExemplo').addEventListener('click', async () => {
    try { await abrirConfig(await (await fetch('configs/exemplo_basico.json')).json()); } catch (e) { mostrarErro(e); }
  });
  async function abrirConfig(bruto: unknown): Promise<void> { await estudio.abrirProjeto(conferirConfig(bruto)); trocarBoneco(); }
  function mostrarErro(e: unknown): void {
    const msg = e instanceof ErroConfig || e instanceof SyntaxError ? e.message : String(e);
    $('#detalhe').insertAdjacentHTML('afterbegin', `<p class="erro">${T.erroArquivo}: ${msg.replace(/</g, '&lt;')}</p>`);
  }
  function exportarPacote(tipo: 'acao' | 'bloco' | 'tudo'): void {
    const c = estudio.config, a = estudio.acao; if (!c || !a) return;
    const bloco = c.blocos.find((b) => b.acoes.some((x) => x.id === a.id))!;
    const conteudo: Conteudo = tipo === 'acao' ? { tipo, acao: a.id } : tipo === 'bloco' ? { tipo, bloco: bloco.id } : { tipo: 'tudo' };
    const dados = exportar(c, estudio.notas, estudio.gravacoes, conteudo);
    const url = URL.createObjectURL(new Blob([dados], { type: 'application/zip' }));
    const link = document.createElement('a'); link.href = url; link.download = nomeDoPacote(c, conteudo); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------------- VR ----------------
  podeVR = !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr').catch(() => false));
  $('#btVR').addEventListener('click', async () => {
    try { await render.xr.setSession(await navigator.xr!.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })); }
    catch (e) { avisar(String((e as Error).message)); }
  });
  let medirEm = 0, alturaOlhos = 1.6;
  render.xr.addEventListener('sessionstart', () => { entrada.modo = 'vr'; camera.position.set(0, 0, 0); camera.quaternion.identity(); painel.malha.visible = true; medirEm = 30; refViva = null; });
  render.xr.addEventListener('sessionend', () => { entrada.modo = 'pc'; painel.malha.visible = false; posicionarCameraPC(); });

  // ---------------- boneco: repetir gravações e imitar ao vivo ----------------
  let reprise: { g: Gravacao; inicio: number; ref: Referencia } | null = null;
  let refViva: Referencia | null = null;
  function comecarReprise(g: Gravacao): void {
    if (!g.quadros?.length) return;
    reprise = { g, inicio: relogio(), ref: referenciaDe(quadroParaAmostra(g.quadros[0])) };
  }
  function poseAgora(agora: number, viva: Amostra | null): PoseBoneco {
    if (reprise) {
      const q = reprise.g.quadros!, dur = q[q.length - 1][0], t = agora - reprise.inicio;
      if (t <= dur * 2 + 0.3) {
        const a = amostraNoTempo(q, Math.min(dur, t % (dur + 0.15)));
        return poseDaAmostra(a, reprise.ref, boneco.olhos / (reprise.g.altura_olhos ?? 1.6), espelho);
      }
      reprise = null;
    }
    if (viva) { refViva ??= referenciaDe(viva); return poseDaAmostra(viva, refViva, boneco.olhos / alturaOlhos, espelho); }
    const p = boneco.poseDeDescanso(); p.cabeca.p.y += Math.sin(agora * 2) * 0.004 * boneco.altura; return p;
  }

  // ---------------- testar ----------------
  function testar(): void {
    estudio.alternarTeste(alturaOlhos);
    refViva = null; painel.reconhecidos = [];
    if (estudio.estado === 'testando' && !estudio.reconhecedor?.prontas) avisar(T.faltaGravar);
  }
  function acaoPorId(id: string): Acao | undefined { return estudio.acoes.find((a) => a.id === id); }
  function reconheceu(ev: EventoReconhecido): void {
    if (ev.tipo === 'expirou') return;
    const a = acaoPorId(ev.acao); if (!a) return;
    const final = ev.tipo === 'disparou';
    if (ev.tipo === 'parte' && ev.indice + 1 >= ev.total) return; // o "disparou" logo depois mostra o efeito
    const nome = tx(a.nome) + (final ? '' : ` · ${tx(a.partes[ev.tipo === 'parte' ? ev.indice : 0].nome)}`);
    painel.reconhecidos.push({ nome, t: relogio(), final }); if (painel.reconhecidos.length > 20) painel.reconhecidos.shift();
    avisar(`${T.reconheceu}: ${nome}`, 2);
    vibrar('dir', final ? 0.9 : 0.4, final ? 120 : 50); vibrar('esq', final ? 0.9 : 0.4, final ? 120 : 50);
    // no PC (sem imitar ao vivo), o boneco repete a gravação de VR dessa parte, se houver
    if (entrada.modo !== 'vr') {
      const parte = ev.tipo === 'parte' ? a.partes[ev.indice].id : a.partes[a.partes.length - 1].id;
      const g = estudio.gravacoes.find((x) => x.modo === 'vr' && x.acao === a.id && x.parte === parte && x.quadros?.length);
      if (g) comecarReprise(g);
    }
    if (final) soltarEfeito(a);
  }
  function soltarEfeito(a: Acao): void {
    const e = a.efeito, H = boneco.altura;
    const lado = (l: 'esq' | 'dir') => (espelho ? (l === 'esq' ? 'dir' : 'esq') : l); // no espelho a mão aparece trocada
    let origem: THREE.Vector3, dir = boneco.olharMundo();
    switch (e.origem) {
      case 'mao_dir': origem = boneco.maoMundo(lado('dir')); dir = boneco.apontarMundo(lado('dir')); break;
      case 'mao_esq': origem = boneco.maoMundo(lado('esq')); dir = boneco.apontarMundo(lado('esq')); break;
      case 'boca': origem = boneco.bocaMundo(); break;
      case 'corpo': origem = boneco.corpoMundo(); break;
      case 'chao': origem = boneco.corpoMundo().setY(0.05); dir = new THREE.Vector3(0, 1, 0); break;
      default: origem = boneco.maoMundo('esq').add(boneco.maoMundo('dir')).multiplyScalar(0.5);
    }
    efeitos.soltar(e.forma, e.cor, origem, dir, H);
    // no VR, o poder sai também das mãos de verdade de quem está testando
    if (entrada.modo === 'vr') {
      const l = e.origem === 'mao_esq' ? 'esq' : 'dir', m = entrada.maos[l].pose;
      const o = e.origem === 'boca' ? camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.1, 0)) : m.getWorldPosition(new THREE.Vector3());
      const d = new THREE.Vector3(0, 0, -1).applyQuaternion(e.origem === 'boca' ? camera.getWorldQuaternion(new THREE.Quaternion()) : m.getWorldQuaternion(new THREE.Quaternion()));
      efeitos.soltar(e.forma, e.cor, o, d, alturaOlhos * 0.6);
    }
  }

  // ---------------- teclado e mouse (modo PC) ----------------
  const digitando = (ev: Event) => { const t = ev.target as HTMLElement; return t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT'; };
  const capturando = () => estudio.modo === 'pc' && (estudio.estado === 'gravando' || estudio.estado === 'contagem' || estudio.estado === 'testando');
  let moverX = 0, moverY = 0;
  addEventListener('keydown', (ev) => {
    if (digitando(ev) || ev.repeat || estudio.modo !== 'pc') return;
    if (capturando()) ev.preventDefault();
    estudio.eventoPC({ tipo: 'baixo', codigo: ev.code }, relogio());
  });
  addEventListener('keyup', (ev) => { if (digitando(ev) || estudio.modo !== 'pc') return; if (capturando()) ev.preventDefault(); estudio.eventoPC({ tipo: 'cima', codigo: ev.code }, relogio()); });
  const tela = render.domElement;
  tela.addEventListener('mousedown', (ev) => { if (estudio.modo === 'pc') estudio.eventoPC({ tipo: 'baixo', codigo: 'Mouse' + ev.button }, relogio()); if (capturando()) ev.preventDefault(); });
  tela.addEventListener('mouseup', (ev) => { if (estudio.modo === 'pc') estudio.eventoPC({ tipo: 'cima', codigo: 'Mouse' + ev.button }, relogio()); });
  tela.addEventListener('contextmenu', (ev) => ev.preventDefault());
  tela.addEventListener('wheel', (ev) => { if (estudio.modo !== 'pc') return; if (capturando()) ev.preventDefault(); estudio.eventoPC({ tipo: 'roda', codigo: 'Roda', dy: Math.sign(ev.deltaY) }, relogio()); }, { passive: false });
  tela.addEventListener('mousemove', (ev) => { moverX += ev.movementX; moverY += ev.movementY; });
  let proximoMover = 0;

  // ---------------- quadro a quadro ----------------
  const armado = { y: true, x: true };
  let ultimoQuadro = relogio();
  function amostraVR(agora: number): Amostra {
    const cp = camera.getWorldPosition(new THREE.Vector3()), cq = camera.getWorldQuaternion(new THREE.Quaternion());
    const mao = (l: 'esq' | 'dir') => {
      const m = entrada.maos[l], p = m.pose.getWorldPosition(new THREE.Vector3()), q = m.pose.getWorldQuaternion(new THREE.Quaternion());
      return { p: { x: p.x, y: p.y, z: p.z }, q: { x: q.x, y: q.y, z: q.z, w: q.w }, gatilho: m.gatilhoValor, grip: m.gripValor };
    };
    return { t: agora, cabeca: { p: { x: cp.x, y: cp.y, z: cp.z }, q: { x: cq.x, y: cq.y, z: cq.z, w: cq.w } }, esq: mao('esq'), dir: mao('dir'), botoes: bitsDosBotoes(entrada.botoesVivos) };
  }
  function comandosVR(agora: number): void {
    const ocupado = estudio.estado === 'contagem' || estudio.estado === 'gravando';
    if (ocupado) return; // durante a gravação, os botões fazem parte do gesto
    const a = entrada.maos.dir.analogico;
    if (Math.abs(a.y) < 0.3) armado.y = true;
    if (Math.abs(a.x) < 0.3) armado.x = true;
    if (estudio.estado !== 'testando') {
      if (armado.y && Math.abs(a.y) > 0.7) { armado.y = false; estudio.escolher(estudio.acaoIdx + (a.y > 0 ? 1 : -1)); }
      if (armado.x && Math.abs(a.x) > 0.7) { armado.x = false; estudio.escolher(estudio.acaoIdx, estudio.parteIdx + (a.x > 0 ? 1 : -1)); }
      if (entrada.apertou.has('A')) { if (estudio.gravar(agora)) vibrar('dir', 0.3, 40); }
      if (entrada.apertou.has('B')) void estudio.apagarUltima();
      if (entrada.apertou.has('X')) {
        const ts = estudio.acao && estudio.parte ? estudio.tentativas(estudio.acao.id, estudio.parte.id) : [];
        if (ts.length) { const i = reprise ? (ts.findIndex((g) => g === reprise!.g) + 1) % ts.length : 0; comecarReprise(ts[i]); }
      }
    }
    if (entrada.apertou.has('Y')) testar();
  }
  let ultimoSegundo = -1;
  function quadro(): void {
    const agora = relogio(), dt = Math.min(0.1, agora - ultimoQuadro); ultimoQuadro = agora;
    let viva: Amostra | null = null;
    if (entrada.modo === 'vr') {
      lerVR();
      if (medirEm > 0 && --medirEm === 0) alturaOlhos = Math.max(0.9, camera.getWorldPosition(new THREE.Vector3()).y);
      viva = amostraVR(agora);
      comandosVR(agora);
      estudio.quadroVR(viva, agora);
      // tique na contagem e no começo da gravação
      const s = Math.ceil(estudio.falta);
      if (estudio.estado === 'contagem' && s !== ultimoSegundo) { ultimoSegundo = s; vibrar('esq', 0.25, 30); vibrar('dir', 0.25, 30); }
      if (estudio.estado === 'gravando' && ultimoSegundo !== -2) { ultimoSegundo = -2; vibrar('esq', 0.7, 80); vibrar('dir', 0.7, 80); }
      if (estudio.estado === 'parado') ultimoSegundo = -1;
      painel.desenhar(estudio, agora);
    } else {
      estudio.tempo(agora);
      if (agora >= proximoMover) {
        proximoMover = agora + 0.05;
        if ((moverX || moverY) && estudio.modo === 'pc') estudio.eventoPC({ tipo: 'mover', codigo: 'Mouse', dx: moverX, dy: moverY }, agora);
        moverX = 0; moverY = 0;
      }
      if (estudio.estado === 'contagem' || estudio.estado === 'gravando') aviso3d.textContent = estudio.estado === 'contagem' ? `${T.contagem}… ${Math.max(1, Math.ceil(estudio.falta))}` : `${T.gravando} ${estudio.falta.toFixed(1)}s`;
      else if (agora > avisoAte && aviso3d.textContent) aviso3d.textContent = '';
    }
    // reconhecimento ao vivo no VR: o boneco imita; carga nas mãos de quem está engatilhado
    boneco.aplicar(poseAgora(agora, viva)); // a gravação que está sendo revista vem antes da imitação ao vivo
    const eng = estudio.reconhecedor?.engatilhadas() ?? [];
    for (const l of ['esq', 'dir'] as const) {
      const a = eng.length ? acaoPorId(eng[0]) : undefined;
      efeitos.carga('boneco_' + l, a ? a.efeito.cor : null, a ? boneco.maoMundo(l) : null, boneco.altura * 0.6, agora);
    }
    efeitos.atualizar(dt);
    render.render(cena, camera);
  }
  render.setAnimationLoop(quadro);

  // ---------------- abrir o último projeto ----------------
  const projetos = (await armazem.projetos()).sort((a, b) => b.atualizado.localeCompare(a.atualizado));
  if (projetos[0]) { try { await estudio.abrirProjeto(conferirConfig(projetos[0].config)); trocarBoneco(); } catch { /* projeto antigo inválido: começa vazio */ } }
  redesenhar();

  // offline: guarda os arquivos depois da primeira visita (só no site publicado)
  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=' + __VERSAO__).catch(() => {});

  // ganchos para os testes automáticos (simulam o Quest sem óculos)
  (window as unknown as { __teste: unknown }).__teste = {
    THREE, estudio, entrada, camera, rig, efeitos, armazem, painel,
    get boneco() { return boneco; }, get reprise() { return reprise; },
    exportar: (c: Conteudo) => exportar(estudio.config!, estudio.notas, estudio.gravacoes, c),
    importar: async (dados: number[]) => { const r = importar(new Uint8Array(dados)); await estudio.abrirProjeto(r.config, r.notas, r.gravacoes); trocarBoneco(); },
    abrirConfig, trocarAparencia: (sim: boolean) => { usarAparencia = sim; $<HTMLInputElement>('#opAparencia').checked = sim; trocarBoneco(); },
  };
}

void iniciar();
