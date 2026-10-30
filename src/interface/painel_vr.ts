// Painel do Estúdio dentro do VR: um quadro flutuando à esquerda de quem grava, com a ação escolhida, a dica,
// as gravações feitas, a contagem e o que foi reconhecido no modo testar. É desenhado num canvas (textura).

import * as THREE from 'three';
import type { Estudio } from '../nucleo/estudio';
import { T, tx } from '../textos';

const L = 1024, A = 700;

export class PainelVR {
  readonly malha: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private textura: THREE.CanvasTexture;
  private ultimoDesenho = '';
  /** Últimos reconhecimentos (modo testar). */
  reconhecidos: { nome: string; t: number; final: boolean }[] = [];

  constructor() {
    this.canvas.width = L; this.canvas.height = A;
    this.textura = new THREE.CanvasTexture(this.canvas); this.textura.colorSpace = THREE.SRGBColorSpace;
    this.malha = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 * A / L), new THREE.MeshBasicMaterial({ map: this.textura, transparent: true }));
    // à esquerda e um pouco à frente de quem grava, virado para ele
    this.malha.position.set(-0.85, 1.3, -1.0); this.malha.rotation.y = 0.65;
  }

  desenhar(e: Estudio, agora: number): void {
    const a = e.acao, p = e.parte;
    const chave = [e.estado, e.modo, a?.id, p?.id, Math.ceil(e.falta * 10), e.aviso?.chave, e.aviso?.valor, e.gravacoes.length, this.reconhecidos.length, e.reconhecedor?.engatilhadas().join()].join('|');
    if (chave === this.ultimoDesenho) return; this.ultimoDesenho = chave;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, L, A);
    g.fillStyle = 'rgba(12,26,36,0.93)'; g.beginPath(); g.roundRect(0, 0, L, A, 36); g.fill();
    g.textBaseline = 'alphabetic';
    const txt = (s: string, x: number, y: number, tam: number, cor = '#e8f3f2', peso = 700) => { g.font = `${peso} ${tam}px system-ui, sans-serif`; g.fillStyle = cor; g.fillText(s, x, y); };
    if (!a || !p) { txt(T.semProjeto.slice(0, 60), 40, 100, 34); return; }
    const testando = e.estado === 'testando';
    txt(testando ? T.vrTestando : `${T.gravar.toUpperCase()} · ${e.acaoIdx + 1}/${e.acoes.length}`, 40, 64, 32, testando ? '#ffe066' : '#4fd6d0', 800);
    if (testando) {
      const eng = e.reconhecedor?.engatilhadas() ?? [];
      if (!e.reconhecedor?.prontas) txt(T.faltaGravar, 40, 140, 34);
      this.reconhecidos.slice(-5).reverse().forEach((r, i) => txt((r.final ? '★ ' : '· ') + r.nome, 40, 150 + i * 62, i === 0 ? 50 : 36, i === 0 ? '#ffe066' : '#9fb3bd', 800));
      if (eng.length) txt(`${T.engatilhado}: ${eng.map((id) => tx(e.acoes.find((x) => x.id === id)?.nome)).join(', ')}`, 40, 500, 30, '#c58fff');
    } else {
      txt(tx(a.nome), 40, 130, 54, '#ffffff', 900);
      txt(`${T.parte} ${e.parteIdx + 1}/${a.partes.length}: ${tx(p.nome)}  ·  ${T.tipos[a.tipo]}`, 40, 180, 30, '#9fb3bd');
      quebrar(g, tx(e.modo === 'pc' ? p.sugestao_pc ?? p.sugestao : p.sugestao), 40, 232, L - 80, 38, 3, '600 32px system-ui, sans-serif', '#e8f3f2');
      // bolinhas das gravações
      const n = e.tentativas(a.id, p.id).length;
      for (let i = 0; i < e.repeticoes; i++) { g.beginPath(); g.arc(60 + i * 56, 400, 20, 0, Math.PI * 2); g.fillStyle = i < n ? '#8fd651' : '#2a3d48'; g.fill(); }
      txt(`${n}/${e.repeticoes}`, 60 + e.repeticoes * 56, 412, 34);
      if (e.estado === 'contagem') { txt(T.contagem, 600, 380, 36, '#ffe066'); txt(String(Math.max(1, Math.ceil(e.falta))), 820, 440, 140, '#ffe066', 900); }
      if (e.estado === 'gravando') {
        txt(T.gravando, 600, 410, 44, '#ff6b5b', 900);
        g.fillStyle = '#2a3d48'; g.fillRect(40, 450, L - 80, 18); g.fillStyle = '#ff6b5b'; g.fillRect(40, 450, (L - 80) * Math.max(0, Math.min(1, e.falta / p.duracao)), 18);
      }
      if (e.aviso && e.estado === 'parado') txt((T.avisos[e.aviso.chave] ?? '') + (e.aviso.valor ? ' ' + e.aviso.valor : ''), 40, 500, 34, '#ffe066', 800);
    }
    T.vrAjuda.forEach((l, i) => txt(l, 40, 580 + i * 40, 28, '#9fb3bd', 600));
    void agora;
    this.textura.needsUpdate = true;
  }
}

/** Escreve um texto quebrando as linhas (no máximo `max` linhas). */
export function quebrar(g: CanvasRenderingContext2D, s: string, x: number, y: number, largura: number, alt: number, max: number, fonte: string, cor: string): void {
  g.font = fonte; g.fillStyle = cor;
  const palavras = s.split(/\s+/); let linha = '', n = 0;
  for (const p of palavras) {
    const t = linha ? linha + ' ' + p : p;
    if (g.measureText(t).width > largura && linha) { g.fillText(linha, x, y + n * alt); n++; linha = p; if (n >= max) return; }
    else linha = t;
  }
  if (linha && n < max) g.fillText(linha, x, y + n * alt);
}
