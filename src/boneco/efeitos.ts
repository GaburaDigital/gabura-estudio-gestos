// Efeitos do modo testar: quando um gesto é reconhecido, o boneco "usa o poder" com uma forma simples
// (tornado, raio, onda, aura, projétil, explosão, brilho ou lâmina) na cor do arquivo de configuração.
// São marcadores de teste, low-poly e baratos para o Quest; a arte de verdade de cada poder fica no jogo.

import * as THREE from 'three';
import type { FormaEfeito } from '../nucleo/config';

interface Vivo { obj: THREE.Object3D; idade: number; vida: number; atualizar: (k: number, dt: number) => void }

export class Efeitos {
  readonly grupo = new THREE.Group();
  private vivos: Vivo[] = [];
  private cargas = new Map<string, THREE.Mesh>();

  /** Solta um efeito em `origem`, apontando para `direcao`, com o tamanho `escala` (altura do personagem). */
  soltar(forma: FormaEfeito, cor: string, origem: THREE.Vector3, direcao: THREE.Vector3, escala: number): void {
    const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const d = direcao.clone().normalize(), e = escala;
    let obj: THREE.Object3D, vida = 1.0, atualizar: Vivo['atualizar'];
    const virar = (o: THREE.Object3D) => o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    switch (forma) {
      case 'tornado': {
        const g = new THREE.Group();
        for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.06 * e * (1 + i * 0.5), 0.012 * e, 4, 8), mat); t.rotation.x = Math.PI / 2; t.position.y = i * 0.06 * e; g.add(t); }
        obj = g; virar(g); vida = 1.2;
        atualizar = (k) => { g.rotation.y += 0.4; g.position.copy(origem).addScaledVector(d, k * 0.8 * e); g.scale.setScalar(1 + k); };
        break;
      }
      case 'raio': case 'lamina': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(forma === 'raio' ? 0.03 * e : 0.008 * e, 0.03 * e, 1, 5), mat);
        obj = m; virar(m); vida = forma === 'raio' ? 0.9 : 1.4;
        const comp = forma === 'raio' ? 2.5 * e : 0.5 * e;
        atualizar = (k) => { const l = Math.min(1, k * 4) * comp; m.scale.set(forma === 'raio' ? 1 + Math.sin(k * 40) * 0.3 : 1, l, 1); m.position.copy(origem).addScaledVector(d, l / 2); };
        break;
      }
      case 'onda': {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.1 * e, 0.14 * e, 12), mat);
        obj = m; m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); vida = 0.9;
        atualizar = (k) => { m.position.copy(origem).addScaledVector(d, k * 1.5 * e); m.scale.setScalar(1 + k * 6); };
        break;
      }
      case 'aura': {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 * e, 1), mat);
        obj = m; vida = 1.6;
        atualizar = (k) => { m.position.copy(origem); m.scale.setScalar(1 + Math.sin(k * 18) * 0.06); };
        break;
      }
      case 'projetil': {
        const g = new THREE.Group();
        for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.012 * e, 0.07 * e, 4), mat); p.position.set((i % 3 - 1) * 0.05 * e, Math.floor(i / 3) * 0.05 * e, 0); p.rotation.x = -Math.PI / 2; g.add(p); }
        obj = g; g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d); vida = 0.8;
        atualizar = (k) => g.position.copy(origem).addScaledVector(d, k * 3 * e);
        break;
      }
      case 'explosao': {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 * e, 0), mat);
        obj = m; vida = 0.7;
        atualizar = (k) => { m.position.copy(origem); m.scale.setScalar(1 + k * 8); };
        break;
      }
      default: { // brilho
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08 * e, 0), mat);
        obj = m; vida = 0.8;
        atualizar = (k) => { m.position.copy(origem); m.rotation.y += 0.2; m.scale.setScalar(1 + k * 2.5); };
      }
    }
    this.grupo.add(obj);
    this.vivos.push({ obj, idade: 0, vida, atualizar });
    atualizar(0, 0);
  }

  /** Brilho de carga numa mão (ação engatilhada esperando a liberação). */
  carga(chave: string, cor: string | null, onde: THREE.Vector3 | null, escala: number, t: number): void {
    let m = this.cargas.get(chave);
    if (!cor || !onde) { if (m) m.visible = false; return; }
    if (!m) { m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.6, depthWrite: false })); this.cargas.set(chave, m); this.grupo.add(m); }
    (m.material as THREE.MeshBasicMaterial).color.set(cor);
    m.visible = true; m.position.copy(onde); m.scale.setScalar(escala * (1 + Math.sin(t * 12) * 0.25)); m.rotation.y = t * 3;
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
      v.obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k * k); });
    }
  }

  get quantos(): number { return this.vivos.length; }
}
