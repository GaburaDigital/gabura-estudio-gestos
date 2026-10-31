// Efeitos do modo testar: quando um gesto dispara, o poder aparece com uma forma simples (broca, tornado, raio,
// onda, aura, projétil, explosão, brilho ou lâmina) na cor do arquivo de ações, e SEMPRE com uma seta mostrando a
// direção do poder (C35: no teste o importante é a direção; a arte de verdade de cada poder fica no jogo).
// Low-poly e barato para o Quest.

import * as THREE from 'three';
import type { FormaEfeito } from '../nucleo/config';

interface Vivo { obj: THREE.Object3D; idade: number; vida: number; atualizar: (k: number, dt: number) => void }

export class Efeitos {
  readonly grupo = new THREE.Group();
  private vivos: Vivo[] = [];
  private cargas = new Map<string, THREE.Mesh>();

  /** Solta um poder em `origem`, indo para `direcao`, do tamanho `escala` (altura do personagem), por `duracao` s. */
  soltar(forma: FormaEfeito, cor: string, origem: THREE.Vector3, direcao: THREE.Vector3, escala: number, duracao = 1): void {
    const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const d = direcao.lengthSq() > 1e-6 ? direcao.clone().normalize() : new THREE.Vector3(0, 0, -1), e = escala, o = origem.clone();
    const virarY = (x: THREE.Object3D) => x.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    let obj: THREE.Object3D, atualizar: Vivo['atualizar'];
    const vida = Math.max(0.4, duracao);
    switch (forma) {
      case 'broca': { // vento em espiral saindo da mão, como uma broca de furadeira
        const g = new THREE.Group();
        for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.05 * e * (1 - i * 0.15), 0.01 * e, 4, 8), mat); t.position.y = i * 0.12 * e; t.rotation.x = Math.PI / 2; g.add(t); }
        obj = g; virarY(g);
        atualizar = (k) => { g.position.copy(o).addScaledVector(d, k * 1.2 * e); g.children.forEach((c, i) => { c.rotation.z += 0.5; c.scale.setScalar(1 + k * (2 - i * 0.3)); }); };
        break;
      }
      case 'tornado': { // em volta de quem usa (para cima)
        const g = new THREE.Group();
        for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.12 * e * (0.6 + i * 0.25), 0.012 * e, 4, 10), mat); t.rotation.x = Math.PI / 2; t.position.y = i * 0.15 * e; g.add(t); }
        obj = g;
        atualizar = (k) => { g.position.copy(o); g.rotation.y += 0.35; g.scale.setScalar(0.6 + Math.min(1, k * 3) * 0.6); };
        break;
      }
      case 'raio': case 'lamina': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(forma === 'raio' ? 0.04 * e : 0.008 * e, 0.04 * e, 1, 6), mat);
        obj = m; virarY(m);
        const comp = forma === 'raio' ? 3 * e : 0.5 * e;
        atualizar = (k) => { const l = Math.min(1, k * 6) * comp; m.scale.set(forma === 'raio' ? 1 + Math.sin(k * 60) * 0.25 : 1, l, 1); m.position.copy(o).addScaledVector(d, l / 2); };
        break;
      }
      case 'onda': {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.1 * e, 0.14 * e, 12), mat);
        obj = m; m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
        atualizar = (k) => { m.position.copy(o).addScaledVector(d, k * 1.5 * e); m.scale.setScalar(1 + k * 6); };
        break;
      }
      case 'aura': {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 * e, 1), mat);
        obj = m;
        atualizar = (k) => { m.position.copy(o); m.scale.setScalar(1 + Math.sin(k * 18) * 0.06); };
        break;
      }
      case 'projetil': {
        const g = new THREE.Group();
        for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.012 * e, 0.07 * e, 4), mat); p.position.set((i % 3 - 1) * 0.05 * e, 0, Math.floor(i / 3) * 0.05 * e); g.add(p); }
        obj = g; virarY(g);
        atualizar = (k) => g.position.copy(o).addScaledVector(d, k * 3 * e);
        break;
      }
      case 'explosao': {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 * e, 0), mat);
        obj = m;
        atualizar = (k) => { m.position.copy(o); m.scale.setScalar(1 + k * 8); };
        break;
      }
      default: {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08 * e, 0), mat);
        obj = m;
        atualizar = (k) => { m.position.copy(o); m.rotation.y += 0.2; m.scale.setScalar(1 + k * 2.5); };
      }
    }
    this.adicionar(obj, vida, atualizar);
    this.seta(cor, o, d, e, Math.max(1.2, vida));
  }

  /** Seta da direção do poder: uma linha com ponta, saindo da origem. */
  seta(cor: string, origem: THREE.Vector3, direcao: THREE.Vector3, escala: number, vida = 1.2): void {
    const comp = 1.4 * escala, d = direcao.clone().normalize();
    const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.9, depthWrite: false });
    const g = new THREE.Group();
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * escala, 0.008 * escala, comp, 5), mat); haste.position.y = comp / 2; g.add(haste);
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.03 * escala, 0.09 * escala, 6), mat); ponta.position.y = comp; g.add(ponta);
    g.position.copy(origem); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    this.adicionar(g, vida, () => {});
  }

  private adicionar(obj: THREE.Object3D, vida: number, atualizar: Vivo['atualizar']): void {
    this.grupo.add(obj);
    this.vivos.push({ obj, idade: 0, vida, atualizar });
    atualizar(0, 0);
  }

  /** Brilho de carga numa mão (ação engatilhada); `ciclos` aumenta o tamanho. */
  carga(chave: string, cor: string | null, onde: THREE.Vector3 | null, escala: number, t: number, ciclos = 0): void {
    let m = this.cargas.get(chave);
    if (!cor || !onde) { if (m) m.visible = false; return; }
    if (!m) { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.6, depthWrite: false })); this.cargas.set(chave, m); this.grupo.add(m); }
    (m.material as THREE.MeshBasicMaterial).color.set(cor);
    m.visible = true; m.position.copy(onde); m.scale.setScalar(escala * (1 + Math.min(10, ciclos) * 0.12) * (1 + Math.sin(t * 12) * 0.25)); m.rotation.y = t * 3;
  }

  atualizar(dt: number): void {
    for (const v of [...this.vivos]) {
      v.idade += dt; const k = v.idade / v.vida;
      if (k >= 1) {
        this.grupo.remove(v.obj);
        v.obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
        this.vivos = this.vivos.filter((x) => x !== v); continue;
      }
      v.atualizar(k, dt);
      v.obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k * k * k); });
    }
  }

  get quantos(): number { return this.vivos.length; }
}
