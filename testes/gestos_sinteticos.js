// Gestos de mentira para os testes automáticos: geram amostras do "Quest" (cabeça e mãos a 72 por segundo) sem
// óculos. Cada gesto é uma lista de poses-chave no espaço de quem grava (direita +x, frente −z, metros de uma
// pessoa com olhos a 1,6 m); o gerador gira, muda o tamanho, a velocidade e põe um tremido, para o teste conferir
// que o reconhecedor aguenta pessoas e jeitos diferentes.
window.__gestos = (() => {
  const R = (x, y, z) => [x, y, z];
  const DESCANSO = { e: R(-0.2, 0.85, -0.08), d: R(0.2, 0.85, -0.08) };
  // chaves: [tempo, mão esq, mão dir, gatilho esq, gatilho dir, grip esq, grip dir]
  const k = (t, e, d, ge = 0, gd = 0, pe = 0, pd = 0) => ({ t, e, d, ge, gd, pe, pd });
  const G = {
    parado: () => [k(0, DESCANSO.e, DESCANSO.d), k(1, DESCANSO.e, DESCANSO.d)],
    aceno: () => {
      const r = [k(0, DESCANSO.e, DESCANSO.d), k(0.3, DESCANSO.e, R(0.35, 1.55, -0.25))];
      for (let i = 1; i <= 6; i++) r.push(k(0.3 + i * 0.2, DESCANSO.e, R(0.35 + (i % 2 ? 0.17 : -0.12), 1.55, -0.25)));
      r.push(k(1.9, DESCANSO.e, DESCANSO.d)); return r;
    },
    palma: () => [k(0, DESCANSO.e, DESCANSO.d), k(0.35, R(-0.38, 1.2, -0.35), R(0.38, 1.2, -0.35)), k(0.47, R(-0.03, 1.2, -0.35), R(0.03, 1.2, -0.35)), k(0.7, R(-0.03, 1.2, -0.35), R(0.03, 1.2, -0.35)), k(1.1, DESCANSO.e, DESCANSO.d)],
    bracos_cima: () => [k(0, DESCANSO.e, DESCANSO.d), k(0.5, R(-0.25, 2.0, -0.05), R(0.25, 2.0, -0.05)), k(1.1, R(-0.25, 2.0, -0.05), R(0.25, 2.0, -0.05)), k(1.6, DESCANSO.e, DESCANSO.d)],
    engatilhar: () => [k(0, DESCANSO.e, DESCANSO.d), k(0.5, R(0.15, 1.0, -0.15), R(0.32, 1.0, -0.15)), k(0.8, R(0.15, 1.0, -0.15), R(0.32, 1.0, -0.15), 1, 1), k(1.2, R(0.15, 1.0, -0.15), R(0.32, 1.0, -0.15), 1, 1)],
    liberar: () => [k(0, R(0.15, 1.0, -0.15), R(0.32, 1.0, -0.15), 1, 1), k(0.22, R(-0.08, 1.3, -0.65), R(0.08, 1.3, -0.65), 0, 0), k(0.6, R(-0.08, 1.3, -0.65), R(0.08, 1.3, -0.65)), k(1.0, DESCANSO.e, DESCANSO.d)],
    empurrar: () => [k(0, DESCANSO.e, DESCANSO.d), k(0.3, R(-0.08, 1.3, -0.65), R(0.08, 1.3, -0.65)), k(0.7, R(-0.08, 1.3, -0.65), R(0.08, 1.3, -0.65)), k(1.1, DESCANSO.e, DESCANSO.d)],
    soco: () => [k(0, DESCANSO.e, DESCANSO.d), k(0.3, DESCANSO.e, R(0.2, 1.35, -0.1), 0, 1, 0, 1), k(0.45, DESCANSO.e, R(0.15, 1.4, -0.7), 0, 1, 0, 1), k(0.8, DESCANSO.e, DESCANSO.d)],
    // movimentos que NÃO são gestos: andar balançando os braços e mexer as mãos à toa
    andar: () => { const r = []; for (let i = 0; i <= 10; i++) r.push(k(i * 0.25, R(-0.22, 0.85, -0.08 + (i % 2 ? 0.12 : -0.12)), R(0.22, 0.85, -0.08 + (i % 2 ? -0.12 : 0.12)))); r.andar = 1.2; return r; },
    coçar: () => [k(0, DESCANSO.e, DESCANSO.d), k(0.6, DESCANSO.e, R(0.12, 1.5, 0.0)), k(1.0, DESCANSO.e, R(0.1, 1.48, 0.02)), k(1.6, DESCANSO.e, DESCANSO.d)],
  };
  const lerp = (a, b, s) => a.map((v, i) => v + (b[i] - v) * s);
  function poseNo(chaves, t) {
    let i = 0; while (i < chaves.length - 2 && chaves[i + 1].t < t) i++;
    const a = chaves[i], b = chaves[Math.min(i + 1, chaves.length - 1)];
    let s = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0; s = s * s * (3 - 2 * s);
    return { e: lerp(a.e, b.e, s), d: lerp(a.d, b.d, s), ge: a.ge + (b.ge - a.ge) * s, gd: a.gd + (b.gd - a.gd) * s, pe: a.pe + (b.pe - a.pe) * s, pd: a.pd + (b.pd - a.pd) * s };
  }
  let semente = 1;
  const sorte = () => { semente = (semente * 16807) % 2147483647; return (semente - 1) / 2147483646; };
  /** Amostras de um gesto. op: { t0, x, z, yaw, altura, velocidade, tremido, espelhar } */
  function gerar(nome, op = {}) {
    const chaves = G[nome](), dur = chaves[chaves.length - 1].t, v = op.velocidade ?? 1, s = (op.altura ?? 1.6) / 1.6, yaw = op.yaw ?? 0, tr = op.tremido ?? 0.01;
    const c = Math.cos(yaw), sn = Math.sin(yaw), q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    const r = [], n = Math.ceil((dur / v) * 72);
    for (let i = 0; i <= n; i++) {
      const tl = (i / 72) * v, p = poseNo(chaves, tl);
      const anda = chaves.andar ? chaves.andar * tl : 0;
      const mundo = (l) => {
        let x = l[0] * s, y = l[1] * s, z = (l[2] - anda) * s;
        if (op.espelhar) x = -x;
        x += (sorte() - 0.5) * tr; y += (sorte() - 0.5) * tr; z += (sorte() - 0.5) * tr;
        return { x: (op.x ?? 0) + x * c + z * sn, y, z: (op.z ?? 0) - x * sn + z * c };
      };
      const [me, md] = op.espelhar ? [p.d, p.e] : [p.e, p.d];
      const cab = mundo([0, 1.6, -anda + 0]);
      cab.y = 1.6 * s;
      const mao = (pos, g, gr) => ({ p: mundo(pos), q, gatilho: g, grip: gr });
      r.push({ t: (op.t0 ?? 0) + i / 72, cabeca: { p: cab, q }, esq: mao(me, op.espelhar ? p.gd : p.ge, op.espelhar ? p.pd : p.pe), dir: mao(md, op.espelhar ? p.ge : p.gd, op.espelhar ? p.pe : p.pd), botoes: 0 });
    }
    return r;
  }
  return { gerar, nomes: Object.keys(G), semear: (n) => { semente = n; } };
})();
