// Converte uma amostra gravada (metros e lugar de quem gravou) numa pose do boneco (tamanho do personagem,
// de frente para quem olha). Com "espelho" ligado, o boneco imita como um espelho: a mão esquerda de quem grava
// aparece do lado esquerdo de quem olha (é a mão direita do boneco). Sem espelho, ele repete como outra pessoa
// fazendo o gesto de frente para você.

import * as THREE from 'three';
import type { Amostra, Q4 } from '../nucleo/gravacao';
import type { PoseBoneco } from './boneco';

/** De onde as posições são medidas: o lugar e a direção da cabeça no começo (a gravação "olha para a frente"). */
export interface Referencia { x: number; z: number; yaw: number }

export function referenciaDe(a: Amostra): Referencia {
  const q = a.cabeca.q;
  const fx = -2 * (q.x * q.z + q.w * q.y), fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
  return { x: a.cabeca.p.x, z: a.cabeca.p.z, yaw: Math.atan2(-fx, -fz) };
}

export function poseDaAmostra(a: Amostra, ref: Referencia, escala: number, espelho: boolean): PoseBoneco {
  const c = Math.cos(-ref.yaw), s = Math.sin(-ref.yaw);
  const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ref.yaw);
  const pos = (p: { x: number; y: number; z: number }) => {
    const dx = p.x - ref.x, dz = p.z - ref.z;
    const x = (dx * c + dz * s) * escala, z = (-dx * s + dz * c) * escala;
    return { x: espelho ? -x : x, y: p.y * escala, z };
  };
  const rot = (q: Q4) => {
    const r = giro.clone().multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    if (espelho) { r.y = -r.y; r.z = -r.z; } // reflexo no plano x = 0
    return r;
  };
  const mao = (m: Amostra['esq'], botao: boolean) => ({ p: pos(m.p), q: rot(m.q), gatilho: m.gatilho, grip: m.grip, botao });
  const e = mao(a.esq, (a.botoes & 4) !== 0), d = mao(a.dir, (a.botoes & 1) !== 0); // X na esquerda, A na direita
  return { cabeca: { p: pos(a.cabeca.p), q: rot(a.cabeca.q) }, maos: espelho ? { esq: d, dir: e } : { esq: e, dir: d } };
}
