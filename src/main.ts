// Estúdio de Gestos Gabura: página, cena 3D, VR e teclado/mouse.
// - Gravar para VR: no Quest, entre no VR e use o menu à esquerda (analógico escolhe e muda, A confirma, B volta,
//   segurar Y volta ao começo). O boneco à frente imita você e repete cada gravação.
// - Gravar para PC: clique em Gravar e faça a sequência de teclas e mouse depois da contagem.
// Tudo fica guardado no navegador; Exportar gera o .zip que vai para o projeto do jogo.

import './estilo.css';
import * as THREE from 'three';
import { conferirConfig, efeitoDe, APARENCIA_CINZA, ErroConfig, type Acao, type Efeito } from './nucleo/config';
import { Armazem } from './nucleo/armazem';
import { Estudio } from './nucleo/estudio';
import { amostraNoTempo, bitsDosBotoes, quadroParaAmostra, type Amostra, type Gravacao } from './nucleo/gravacao';
import { exportar, importar, nomeDoPacote, type Conteudo } from './nucleo/pacote';
import type { EventoReconhecido, Lado } from './nucleo/reconhecedor';
import { Boneco, type PoseBoneco } from './boneco/boneco';
import { Efeitos } from './boneco/efeitos';
import { poseDaAmostra, referenciaDe, type Referencia } from './boneco/pose';
import { MenuVR } from './interface/painel_vr';
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
  const painel = new MenuVR(estudio, { rever: () => reverGesto(), testar: () => testar(), gravar: () => { if (estudio.gravar(relogio())) vibrar('dir', 0.3, 40); } });
  painel.malha.visible = false; rig.add(painel.malha);
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
  /** Revê as gravações do gesto escolhido, uma de cada vez. */
  function reverGesto(): void {
    const g = estudio.gesto; if (!g) return;
    const ts = estudio.tentativas(g.id); if (!ts.length) return;
    const i = reprise ? (ts.findIndex((x) => x === reprise!.g) + 1) % ts.length : 0; comecarReprise(ts[i]);
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
    if (ev.tipo === 'passo' && ev.indice + 1 >= ev.total) return; // o "disparou" logo depois mostra o efeito
    const final = ev.tipo === 'disparou';
    let nome = tx(a.nome);
    if (ev.tipo === 'passo') nome += ` · ${tx(a.passos[ev.indice].nome)}`;
    if (ev.tipo === 'carga') nome += ` · ${T.carga} ${ev.ciclos}${ev.nivel ? ' (' + ev.nivel + ')' : ''}`;
    const alt = final ? a.passos[a.passos.length - 1].alternativas.find((x) => x.id === ev.alternativa) ?? null : null;
    if (final && alt && a.passos[a.passos.length - 1].alternativas.length > 1) nome += ` · ${tx(alt.nome)}`;
    if (final && ev.ciclos) nome += ` · ${T.carga} ${ev.ciclos}${ev.nivel ? ' (' + ev.nivel + ')' : ''}`;
    painel.reconhecidos.push({ nome, t: relogio(), final }); if (painel.reconhecidos.length > 20) painel.reconhecidos.shift();
    avisar(`${T.reconheceu}: ${nome}`, 2);
    vibrar(ev.lado, final ? 0.9 : 0.4, final ? 120 : 50);
    // no PC (sem imitar ao vivo), o boneco repete a gravação de VR desse gesto, se houver
    if (entrada.modo !== 'vr' && ev.tipo !== 'carga') {
      const gesto = final ? alt?.gesto : a.passos[ev.indice].alternativas.find((x) => x.id === ev.alternativa)?.gesto;
      const g = estudio.gravacoes.find((x) => x.modo === 'vr' && x.gesto === gesto && x.quadros?.length);
      if (g) comecarReprise(g);
    }
    if (final) soltarEfeito(efeitoDe(a, alt), ev.lado);
  }

  // ---------------- direção dos poderes (C35) ----------------
  // caminho recente das mãos (de verdade e do boneco), para a direção "movimento"
  const rastro: Record<string, THREE.Vector3[]> = { esq: [], dir: [], b_esq: [], b_dir: [] };
  function anotarRastro(chave: string, p: THREE.Vector3): void { const r = rastro[chave]; r.push(p.clone()); if (r.length > 8) r.shift(); }
  function movimento(chave: string): THREE.Vector3 { const r = rastro[chave]; return r.length > 1 ? r[r.length - 1].clone().sub(r[0]) : new THREE.Vector3(0, 0, -1); }
  /** Origem e direção de um poder para quem usa: as mãos e a cabeça de verdade (VR) ou o boneco. */
  function origemEDirecao(e: Efeito, lado: Lado, boneco_: boolean): { o: THREE.Vector3; d: THREE.Vector3 } {
    // no boneco com espelho, a mão de quem testa aparece trocada
    const lb = (l: Lado): Lado => (boneco_ && espelho ? (l === 'esq' ? 'dir' : 'esq') : l);
    const ladoMao: Lado = e.origem === 'mao_dir' ? 'dir' : e.origem === 'mao_esq' ? 'esq' : lado;
    const mao = (l: Lado) => boneco_ ? boneco.maoMundo(lb(l)) : entrada.maos[l].pose.getWorldPosition(new THREE.Vector3());
    const apontar = (l: Lado) => boneco_ ? boneco.apontarMundo(lb(l)) : new THREE.Vector3(0, 0, -1).applyQuaternion(entrada.maos[l].pose.getWorldQuaternion(new THREE.Quaternion()));
    const cabecaP = boneco_ ? boneco.bocaMundo() : camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.08, 0));
    const olhar = boneco_ ? boneco.olharMundo() : new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    const corpo = boneco_ ? boneco.corpoMundo() : camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.5, 0));
    let o: THREE.Vector3;
    switch (e.origem) {
      case 'boca': o = cabecaP; break;
      case 'corpo': o = corpo; break;
      case 'chao': o = corpo.clone().setY(0.05); break;
      case 'maos': o = mao('esq').add(mao('dir')).multiplyScalar(0.5); break;
      default: o = mao(ladoMao);
    }
    let d: THREE.Vector3;
    switch (e.direcao) {
      case 'pulso': case 'apontar': d = apontar(ladoMao); break;
      case 'cabeca': d = olhar.clone(); d.y -= 0.14; break; // um pouco abaixo da linha dos olhos
      case 'movimento': d = movimento((boneco_ ? 'b_' : '') + lb(ladoMao)); break;
      case 'cima': d = new THREE.Vector3(0, 1, 0); break;
      case 'baixo': d = new THREE.Vector3(0, -1, 0); break;
      default: d = olhar.clone(); d.y = 0;
    }
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1);
    return { o, d: d.normalize() };
  }
  function soltarEfeito(e: Efeito, lado: Lado): void {
    const b = origemEDirecao(e, lado, true);
    efeitos.soltar(e.forma, e.cor, b.o, b.d, boneco.altura, e.duracao);
    // no VR, o poder sai também das mãos (ou da cabeça) de verdade de quem está testando
    if (entrada.modo === 'vr') { const r = origemEDirecao(e, lado, false); efeitos.soltar(e.forma, e.cor, r.o, r.d, alturaOlhos * 0.6, e.duracao); }
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
  let seguraY = 0;
  let ultimoQuadro = relogio();
  function amostraVR(agora: number): Amostra {
    const cp = camera.getWorldPosition(new THREE.Vector3()), cq = camera.getWorldQuaternion(new THREE.Quaternion());
    const mao = (l: 'esq' | 'dir') => {
      const m = entrada.maos[l], p = m.pose.getWorldPosition(new THREE.Vector3()), q = m.pose.getWorldQuaternion(new THREE.Quaternion());
      return { p: { x: p.x, y: p.y, z: p.z }, q: { x: q.x, y: q.y, z: q.z, w: q.w }, gatilho: m.gatilhoValor, grip: m.gripValor };
    };
    return { t: agora, cabeca: { p: { x: cp.x, y: cp.y, z: cp.z }, q: { x: cq.x, y: cq.y, z: cq.z, w: cq.w } }, esq: mao('esq'), dir: mao('dir'), botoes: bitsDosBotoes(entrada.botoesVivos) };
  }
  /** Controles do menu do VR: analógico direito escolhe e muda, A confirma, B volta, segurar Y 1 s volta ao começo.
   *  Durante a contagem e a gravação, só o Y (cancelar) funciona: os outros botões fazem parte do gesto. */
  function comandosVR(dt: number): void {
    if (entrada.botoesVivos.has('Y')) { seguraY += dt; if (seguraY >= 1 && seguraY - dt < 1) { painel.inicio(); vibrar('esq', 0.5, 60); } } else seguraY = 0;
    if (estudio.ocupado) return;
    const a = entrada.maos.dir.analogico;
    if (Math.abs(a.y) < 0.3) armado.y = true;
    if (Math.abs(a.x) < 0.3) armado.x = true;
    if (armado.y && Math.abs(a.y) > 0.7) { armado.y = false; painel.comando(a.y > 0 ? 'baixo' : 'cima'); }
    if (armado.x && Math.abs(a.x) > 0.7) { armado.x = false; painel.comando(a.x > 0 ? 'dir' : 'esq'); }
    if (entrada.apertou.has('A')) painel.comando('A');
    if (entrada.apertou.has('B')) painel.comando('B');
  }
  let ultimoSegundo = -1;
  function quadro(): void {
    const agora = relogio(), dt = Math.min(0.1, agora - ultimoQuadro); ultimoQuadro = agora;
    let viva: Amostra | null = null;
    if (entrada.modo === 'vr') {
      lerVR();
      if (medirEm > 0 && --medirEm === 0) alturaOlhos = Math.max(0.9, camera.getWorldPosition(new THREE.Vector3()).y);
      viva = amostraVR(agora);
      comandosVR(dt);
      estudio.quadroVR(viva, agora);
      // tique na contagem e no começo da gravação
      const s = Math.ceil(estudio.falta);
      if (estudio.estado === 'contagem' && s !== ultimoSegundo) { ultimoSegundo = s; vibrar('esq', 0.25, 30); vibrar('dir', 0.25, 30); }
      if (estudio.estado === 'gravando' && ultimoSegundo !== -2) { ultimoSegundo = -2; vibrar('esq', 0.7, 80); vibrar('dir', 0.7, 80); }
      if (estudio.estado === 'parado') ultimoSegundo = -1;
      painel.desenhar();
      for (const l of ['esq', 'dir'] as const) anotarRastro(l, entrada.maos[l].pose.getWorldPosition(new THREE.Vector3()));
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
    for (const l of ['esq', 'dir'] as const) anotarRastro('b_' + l, boneco.maoMundo(l));
    // carga: brilho na mão que engatilhou (no boneco e na mão de verdade), maior com mais ciclos
    const eng = estudio.estado === 'testando' ? estudio.reconhecedor?.engatilhadas() ?? [] : [];
    for (const l of ['esq', 'dir'] as const) {
      const x = eng.find((y) => y.lado === l), a = x ? acaoPorId(x.acao) : undefined;
      const lb: Lado = espelho ? (l === 'esq' ? 'dir' : 'esq') : l;
      efeitos.carga('boneco_' + l, a ? a.efeito.cor : null, a ? boneco.maoMundo(lb) : null, boneco.altura * 0.6, agora, x?.ciclos ?? 0);
      efeitos.carga('real_' + l, a && entrada.modo === 'vr' ? a.efeito.cor : null, a ? entrada.maos[l].pose.getWorldPosition(new THREE.Vector3()) : null, 0.6, agora, x?.ciclos ?? 0);
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
    THREE, estudio, entrada, camera, rig, efeitos, armazem, painel, origemEDirecao, anotarRastro, get espelho() { return espelho; },
    get boneco() { return boneco; }, get reprise() { return reprise; },
    exportar: (c: Conteudo) => exportar(estudio.config!, estudio.notas, estudio.gravacoes, c),
    importar: async (dados: number[]) => { const r = importar(new Uint8Array(dados)); await estudio.abrirProjeto(r.config, r.notas, r.gravacoes); trocarBoneco(); },
    abrirConfig, trocarAparencia: (sim: boolean) => { usarAparencia = sim; $<HTMLInputElement>('#opAparencia').checked = sim; trocarBoneco(); },
  };
}

void iniciar();
