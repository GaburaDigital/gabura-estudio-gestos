// Boneco genérico do Estúdio: humanoide cinza low-poly que repete as gravações e mostra os poderes no modo testar.
// Serve para qualquer jogo. A "aparência" do arquivo de configuração deixa ele parecido com o personagem
// (altura, proporções, cores e alguns acessórios de uma lista fechada), sem precisar do modelo 3D do jogo.
//
// O corpo segue só a cabeça e as duas mãos (é o que o Quest sabe): o tronco fica embaixo da cabeça, os braços
// ligam o ombro à mão com um cotovelo calculado (IK de dois ossos, como um "SkeletonIK" da Godot) e as pernas
// dobram quando a cabeça desce (agachar).

import * as THREE from 'three';
import type { Aparencia } from '../nucleo/config';
import type { V3 } from '../nucleo/gravacao';

/** Pose no espaço do boneco (metros do boneco, chão em y = 0). */
export interface PoseBoneco {
  cabeca: { p: V3; q: THREE.Quaternion };
  /** `botao`: A (mão direita) ou X (esquerda) apertado: a palma muda de cor. */
  maos: Record<'esq' | 'dir', { p: V3; q: THREE.Quaternion; gatilho: number; grip: number; botao?: boolean }>;
}

const v3 = (p: V3) => new THREE.Vector3(p.x, p.y, p.z);

function material(cor: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: cor, flatShading: true, roughness: 0.85, metalness: 0 });
}

/** Cilindro de 6 lados entre dois pontos (um "osso" low-poly). */
class Osso {
  readonly malha: THREE.Mesh;
  constructor(mat: THREE.Material, readonly raio: number, pai: THREE.Object3D) {
    this.malha = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, 1, 6), mat);
    pai.add(this.malha);
  }
  ligar(a: THREE.Vector3, b: THREE.Vector3): void {
    const d = b.clone().sub(a), l = d.length();
    this.malha.position.copy(a).add(b).multiplyScalar(0.5);
    this.malha.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), l > 1e-5 ? d.divideScalar(l) : new THREE.Vector3(0, 1, 0));
    this.malha.scale.set(this.raio, Math.max(1e-3, l), this.raio);
  }
}

export class Boneco {
  readonly grupo = new THREE.Group();
  /** Altura dos olhos do boneco (m): o tamanho em que as gravações são desenhadas. */
  readonly olhos: number;
  private cabeca = new THREE.Group();
  private tronco: Osso; private frente: THREE.Mesh; private quadrilM: THREE.Mesh;
  private bracos: Record<'esq' | 'dir', { braco: Osso; antebraco: Osso; mao: THREE.Group; dedos: THREE.Object3D; indicador: THREE.Object3D; palma: THREE.MeshStandardMaterial; lado: number; cotovelo: THREE.Mesh }>;
  private pernas: Record<'esq' | 'dir', { coxa: Osso; canela: Osso; pe: THREE.Mesh }>;
  private extrasCostas = new THREE.Group();
  private H: number; private L: { cabeca: number; braco: number; antebraco: number; ombros: number; tronco: number; coxa: number; canela: number };

  constructor(readonly aparencia: Aparencia) {
    const A = aparencia, H = A.altura, P = A.proporcoes;
    this.H = H; this.olhos = H * 0.93;
    this.L = {
      cabeca: 0.068 * H * P.cabeca, braco: 0.19 * H * P.bracos, antebraco: 0.18 * H * P.bracos,
      ombros: 0.13 * H * P.ombros, tronco: 0.29 * H * P.tronco, coxa: 0.25 * H, canela: 0.24 * H,
    };
    const mCorpo = material(A.cores.corpo), mFrente = material(A.cores.frente), mDet = material(A.cores.detalhe), mMao = material(A.cores.maos);
    const g = this.grupo;
    // cabeça (olha para −z), olhos e acessórios do rosto
    const r = this.L.cabeca;
    const cab = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mCorpo); this.cabeca.add(cab);
    for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.13, 0), material('#1d2328')); o.position.set(s * r * 0.36, r * 0.15, -r * 0.9); this.cabeca.add(o); }
    const tem = (a: string) => (A.acessorios as string[]).includes(a);
    if (tem('orelhas_redondas')) for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.38, 0), mCorpo); o.position.set(s * r * 0.72, r * 0.78, 0); this.cabeca.add(o); }
    if (tem('orelhas_pontudas')) for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, r * 0.8, 4), mCorpo); o.position.set(s * r * 0.6, r * 1.05, 0); o.rotation.z = -s * 0.35; this.cabeca.add(o); }
    if (tem('chifres')) for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.ConeGeometry(r * 0.16, r * 0.7, 5), mDet); o.position.set(s * r * 0.45, r * 1.05, -r * 0.1); o.rotation.z = -s * 0.5; this.cabeca.add(o); }
    if (tem('antenas')) for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.04, r * 0.04, r * 0.9, 4), mDet); h.position.set(s * r * 0.35, r * 1.3, 0); this.cabeca.add(h);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.14, 0), mDet); b.position.set(s * r * 0.35, r * 1.8, 0); this.cabeca.add(b);
    }
    if (tem('focinho')) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.45, 0), mFrente); f.scale.set(1.1, 0.75, 0.9); f.position.set(0, -r * 0.3, -r * 0.82); this.cabeca.add(f);
      const n = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.13, 0), material('#1d2328')); n.position.set(0, -r * 0.18, -r * 1.22); this.cabeca.add(n); }
    if (tem('oculos')) { const o = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, r * 0.36, r * 0.2), mDet); o.position.set(0, r * 0.15, -r * 0.9); this.cabeca.add(o); }
    g.add(this.cabeca);
    // tronco, frente (peito/barriga) e quadril
    this.tronco = new Osso(mCorpo, this.L.ombros * 0.95, g);
    this.frente = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mFrente); g.add(this.frente);
    this.frente.visible = tem('barriga'); // peito/barriga de outra cor só com o acessório "barriga"
    this.quadrilM = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mCorpo); g.add(this.quadrilM);
    if (tem('mochila')) { const m = new THREE.Mesh(new THREE.BoxGeometry(this.L.ombros * 1.2, this.L.tronco * 0.6, this.L.ombros * 0.6), mDet); m.position.set(0, 0, this.L.ombros * 0.95); this.extrasCostas.add(m); }
    if (tem('cauda')) { const c = new THREE.Mesh(new THREE.ConeGeometry(this.L.ombros * 0.25, this.L.tronco * 0.6, 5), mCorpo); c.rotation.x = -Math.PI / 2.6; c.position.set(0, -this.L.tronco * 0.55, this.L.ombros * 0.9); this.extrasCostas.add(c); }
    g.add(this.extrasCostas);
    // braços e mãos (ou patas)
    const raioBraco = 0.034 * H * Math.sqrt(P.ombros);
    // Mão no jeito do controle do Quest (espaço do "grip", C35): os dedos apontam para −z, o polegar para +y e a
    // palma fica virada para dentro (mão direita para −x, esquerda para +x). O indicador fica em cima (no gatilho)
    // e os outros dedos embaixo (no grip): assim os dedos nunca aparecem trocados.
    const fazerMao = (l: 'esq' | 'dir') => {
      const mao = new THREE.Group(), s = 0.05 * H * (A.maos === 'patas' ? 1.25 : 1), sn = l === 'dir' ? -1 : 1;
      const costas = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, s * 0.8, s * 0.85), mMao); costas.position.set(-sn * s * 0.02, 0, -s * 0.15); mao.add(costas);
      const mPalma = material(A.cores.maos); mPalma.emissive.set('#000000');
      const palma = new THREE.Mesh(new THREE.BoxGeometry(s * 0.06, s * 0.7, s * 0.75), mPalma); palma.position.set(sn * s * 0.19, 0, -s * 0.15); mao.add(palma);
      const polegar = new THREE.Mesh(new THREE.BoxGeometry(s * 0.2, s * 0.2, s * 0.45), mMao); polegar.position.set(sn * s * 0.12, s * 0.45, -s * 0.3); mao.add(polegar);
      // dedos (grip): bloco embaixo, dobra para o lado da palma
      const dedos = new THREE.Object3D(); dedos.position.set(0, -s * 0.12, -s * 0.57); mao.add(dedos);
      const bloco = new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.52, s * 0.55), mMao); bloco.position.set(0, 0, -s * 0.27); dedos.add(bloco);
      // indicador (gatilho): em cima, perto do polegar
      const indicador = new THREE.Object3D(); indicador.position.set(0, s * 0.27, -s * 0.57); mao.add(indicador);
      const ind = new THREE.Mesh(new THREE.BoxGeometry(s * 0.26, s * 0.2, s * 0.6), mMao); ind.position.z = -s * 0.3; indicador.add(ind);
      if (A.maos === 'patas') {
        const garra = (pai: THREE.Object3D, y: number, z: number) => { const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.07, s * 0.3, 4), material('#f2eadf')); c.rotation.x = -Math.PI / 2; c.position.set(0, y, z); pai.add(c); };
        garra(indicador, 0, -s * 0.68); garra(dedos, s * 0.12, -s * 0.62); garra(dedos, -s * 0.14, -s * 0.62);
      }
      g.add(mao); return { mao, dedos, indicador, palma: mPalma, lado: -sn };
    };
    this.bracos = {} as Boneco['bracos'];
    for (const l of ['esq', 'dir'] as const) {
      const m = fazerMao(l);
      const cot = new THREE.Mesh(new THREE.IcosahedronGeometry(raioBraco, 0), mCorpo); g.add(cot);
      this.bracos[l] = { braco: new Osso(mCorpo, raioBraco, g), antebraco: new Osso(mCorpo, raioBraco * 0.85, g), cotovelo: cot, ...m };
    }
    const raioPerna = 0.045 * H * Math.sqrt(P.pernas);
    this.pernas = {} as Boneco['pernas'];
    for (const l of ['esq', 'dir'] as const) {
      const pe = new THREE.Mesh(new THREE.BoxGeometry(raioPerna * 1.8, raioPerna, raioPerna * 3), mMao); g.add(pe);
      this.pernas[l] = { coxa: new Osso(mCorpo, raioPerna, g), canela: new Osso(mCorpo, raioPerna * 0.85, g), pe };
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.frustumCulled = false; } });
  }

  /** Pose de descanso (de pé, braços ao lado do corpo). */
  poseDeDescanso(): PoseBoneco {
    const q = new THREE.Quaternion(), H = this.H;
    return { cabeca: { p: { x: 0, y: this.olhos, z: 0 }, q },
      maos: { esq: { p: { x: -0.2 * H, y: 0.48 * H, z: -0.05 * H }, q: q.clone(), gatilho: 0, grip: 0 }, dir: { p: { x: 0.2 * H, y: 0.48 * H, z: -0.05 * H }, q: q.clone(), gatilho: 0, grip: 0 } } };
  }

  /** Posiciona o corpo inteiro a partir da cabeça e das mãos. */
  aplicar(pose: PoseBoneco): void {
    const L = this.L, H = this.H;
    const cab = v3(pose.cabeca.p);
    this.cabeca.position.copy(cab); this.cabeca.quaternion.copy(pose.cabeca.q);
    // frente do corpo = para onde a cabeça olha, no chão
    const fr = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.cabeca.q); fr.y = 0;
    if (fr.lengthSq() < 1e-4) fr.set(0, 0, -1); fr.normalize();
    const dir = new THREE.Vector3(-fr.z, 0, fr.x); // direita do corpo
    const yaw = Math.atan2(-fr.x, -fr.z);
    // pescoço e quadril: o corpo fica um pouco atrás da cabeça; agachar encolhe as pernas
    const pescoco = cab.clone().add(new THREE.Vector3(0, -L.cabeca * 1.25, 0)).addScaledVector(fr, -L.cabeca * 0.3);
    const quadril = pescoco.clone().add(new THREE.Vector3(0, -L.tronco, 0));
    quadril.y = Math.max(quadril.y, 0.12 * H);
    this.tronco.ligar(quadril, pescoco);
    const meio = quadril.clone().lerp(pescoco, 0.45);
    this.frente.position.copy(meio).addScaledVector(fr, L.ombros * 0.6);
    this.frente.scale.set(L.ombros * 0.75, L.tronco * 0.42, L.ombros * 0.45); this.frente.rotation.set(0, yaw, 0);
    this.quadrilM.position.copy(quadril); this.quadrilM.scale.set(L.ombros * 0.95, L.ombros * 0.55, L.ombros * 0.75); this.quadrilM.rotation.set(0, yaw, 0);
    this.extrasCostas.position.copy(meio); this.extrasCostas.rotation.set(0, yaw, 0);
    // braços (IK de dois ossos, cotovelo para baixo e para fora)
    for (const l of ['esq', 'dir'] as const) {
      const s = l === 'esq' ? -1 : 1, b = this.bracos[l], m = pose.maos[l];
      const ombro = pescoco.clone().add(new THREE.Vector3(0, -L.cabeca * 0.35, 0)).addScaledVector(dir, L.ombros * s);
      const mao = v3(m.p);
      const cot = cotovelo(ombro, mao, L.braco, L.antebraco, dir.clone().multiplyScalar(s), fr);
      b.braco.ligar(ombro, cot); b.antebraco.ligar(cot, mao); b.cotovelo.position.copy(cot);
      b.mao.position.copy(mao); b.mao.quaternion.copy(m.q);
      // dobrar os dedos para o lado da palma (mão direita: −x; esquerda: +x)
      b.dedos.rotation.y = b.lado * m.grip * 1.4; b.indicador.rotation.y = b.lado * m.gatilho * 1.3;
      b.palma.emissive.set(m.botao ? '#ffb800' : '#000000'); b.palma.emissiveIntensity = m.botao ? 0.9 : 0;
    }
    // pernas: pés no chão embaixo do quadril; o joelho dobra para a frente quando o quadril desce
    for (const l of ['esq', 'dir'] as const) {
      const s = l === 'esq' ? -1 : 1, p = this.pernas[l];
      const topo = quadril.clone().addScaledVector(dir, L.ombros * 0.45 * s);
      const pe = new THREE.Vector3(topo.x, 0.03 * H, topo.z);
      const joelho = cotovelo(topo, pe, L.coxa, L.canela, fr.clone(), new THREE.Vector3(0, 1, 0), true);
      p.coxa.ligar(topo, joelho); p.canela.ligar(joelho, pe);
      p.pe.position.copy(pe).addScaledVector(fr, 0.03 * H); p.pe.rotation.set(0, yaw, 0);
    }
  }

  /** Onde os efeitos saem (no mundo). */
  maoMundo(l: 'esq' | 'dir'): THREE.Vector3 { return this.bracos[l].mao.getWorldPosition(new THREE.Vector3()); }
  bocaMundo(): THREE.Vector3 { return this.cabeca.localToWorld(new THREE.Vector3(0, -this.L.cabeca * 0.35, -this.L.cabeca * 1.1)); }
  corpoMundo(): THREE.Vector3 { return this.tronco.malha.getWorldPosition(new THREE.Vector3()); }
  /** Para onde o boneco olha (no mundo). */
  olharMundo(): THREE.Vector3 { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.cabeca.getWorldQuaternion(new THREE.Quaternion())).normalize(); }
  /** Para onde a mão aponta (no mundo). */
  apontarMundo(l: 'esq' | 'dir'): THREE.Vector3 { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.bracos[l].mao.getWorldQuaternion(new THREE.Quaternion())).normalize(); }
  get altura(): number { return this.H; }

  descartar(): void {
    this.grupo.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.grupo.removeFromParent();
  }
}

/** Cotovelo (ou joelho) por IK de dois ossos. `fora` diz para onde a junta dobra; esticado demais, os dois ossos
 *  crescem juntos (como o braço que estica do LUTCHA). */
function cotovelo(a: THREE.Vector3, b: THREE.Vector3, L1: number, L2: number, fora: THREE.Vector3, frente: THREE.Vector3, joelho = false): THREE.Vector3 {
  const d = b.clone().sub(a), dist = d.length(), u = dist > 1e-5 ? d.clone().divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  if (dist >= L1 + L2 - 1e-4) return a.clone().addScaledVector(u, dist * (L1 / (L1 + L2)));
  const x = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  let polo = joelho ? fora.clone() : fora.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, -1, 0)).addScaledVector(frente, -0.3);
  polo.addScaledVector(u, -polo.dot(u)); if (polo.lengthSq() < 1e-6) polo = fora.clone(); polo.normalize();
  return a.clone().addScaledVector(u, x).addScaledVector(polo, h);
}
