/* REGRESSION 2 - the Senator from film 16 (c-plus), ported to the contract. A ball on short legs leaning back to
   balance the belly; the head sits straight on the body. Pig snout, a wattle of chins pouring into the chest, a wide
   frog mouth, small wide-set beady eyes, thin high arches, tiny ears, slick centre-parted hair, sweat beads, a mole;
   a toga over the plum stripe, a gravy stain, a gold ring. Signature: thumb twiddling; the chuckle bounces the belly.
   What broke in film 16 and what changed here:
   - ARMS UNDER THE CHIN: shoulders at y -420 (+ a -6 tilt applied only to the solver) while his real chin, the
     wattle, hangs to y -401: the arm roots sat under the wattle and read as fat lumps, 12-28 px off the drawn
     shoulder. Shoulders now sit on the ball below the wattle (sw 112, sy -380) and the tilt is applied once, to both.
   - HAND UNDER THE CHIN / FOLDED ARMS: a face-contact target ('chin') and the 'fold' pose instead of guessed hands.
   - JAW: the wattle, mouth and skin outline share one J (the wattle used its own copy of the jaw maths). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = '#c08a70', SKIN_D = '#8e5a46', SEED = 2510, TOGA = '#a29a7e', TOGA_D = '#7a7258', HAIR = '#1c1816';
  const SHADE = 'rgba(50,20,20,0.34)';
  const D = { sw: 112, sy: -380, sz: -6, tilt: -6, l1a: 92, l2a: 84, hw: 36, hy: -166, l1l: 90, l2l: 80, elbowOut: 1, top: -660, waist: [118, -300], hk: 1.08, lean: -4 };
  const NECK = [[0, -444], [10, -444], [20, -440], [0, -444]];

  const BALL = [
    [-60, -468, -118, -450, -142, -390, -148, -310, -136, -230, -106, -176, -40, -150, 40, -150, 106, -176, 136, -230, 148, -310, 142, -390, 118, -450, 60, -468],
    [-50, -470, -106, -452, -130, -390, -136, -310, -124, -230, -94, -176, -20, -148, 60, -150, 124, -180, 156, -240, 164, -320, 150, -400, 112, -454, 50, -470],
    [-30, -472, -70, -456, -84, -390, -86, -300, -80, -220, -60, -170, 30, -150, 110, -170, 152, -230, 162, -320, 140, -410, 84, -460, 20, -474],
    [-60, -468, -120, -450, -144, -390, -150, -310, -138, -230, -108, -176, -40, -152, 40, -152, 108, -176, 138, -230, 150, -310, 144, -390, 120, -450, 60, -468],
  ];
  const STRIPE = [[[-34, -466, -40, -160], [34, -466, 40, -160]], [[-4, -468, 6, -150], [62, -462, 92, -170]], [[70, -456, 130, -190]], []];
  const TOGAS = [
    [-90, -462, -54, -470, 20, -420, 90, -350, 132, -280, 136, -210, 96, -196, 30, -250, -40, -262, -96, -216, -138, -240, -132, -380],
    [-80, -464, -44, -472, 40, -420, 110, -350, 150, -280, 152, -210, 112, -196, 50, -250, -20, -258, -76, -214, -122, -240, -118, -380],
    [-60, -468, -24, -476, 30, -440, 90, -400, 140, -330, 152, -260, 110, -240, 30, -262, -40, -250, -80, -380],
    [90, -462, 54, -470, -20, -420, -90, -350, -132, -280, -136, -210, -96, -196, -30, -250, 40, -262, 96, -216, 138, -240, 132, -380],
  ];
  function body(ctx, v, A) {
    ST.torso(ctx, A, BALL[v], C.LINEN, { lw: 10, seed: SEED + v, shade: [C.LINEN_D, -30, 10], mottle: ['#9a9074', 5, 26], hatch: { c: 'rgba(40,34,20,0.5)', n: 8, len: 44, gap: 6, k: 3, ang: 80 } });
    STRIPE[v].forEach((s, i) => ST.stroke(ctx, A.fit(s), { w: 18, color: '#5a3c4c', seed: SEED + 5 + i, taper: false }));
    ST.blob(ctx, A.fit(TOGAS[v]), TOGA, { lw: 9, seed: SEED + 8 + v, shade: [TOGA_D, -20, 8], hatch: { c: 'rgba(40,34,20,0.5)', n: 7, len: 44, gap: 6, k: 3, ang: -30, bend: 0.1 } });
    ST.stain(ctx, [30, 50, 80, -30][v], -300, 56, 34, SEED + 12, 'rgba(110,50,30,0.5)'); // gravy
    ST.stain(ctx, [0, 14, 40, 0][v], -456, 110, 28, SEED + 13, 'rgba(120,96,40,0.45)'); // sweat ring at the collar
    if (v < 3) ST.stroke(ctx, [[-90, -200, 0, -168, 90, -200], [-70, -196, 30, -164, 120, -200], [40, -170, 100, -168, 140, -210]][v], { w: 4, seed: SEED + 14 }); // under-belly fold
  }

  // ---------- face parts ----------
  function ear(ctx, x, y, s, seed) { ST.blob(ctx, [x, y - 12, x + s * 12, y - 14, x + s * 14, y + 2, x + s * 6, y + 10, x, y + 6], SKIN, { lw: 5, seed, shade: [SKIN_D, -s * 3, 2] }); }
  function eye(ctx, x, y, r, f, seed, chuckle) { // beady eye: a small round wet bead set wide apart, a puffy lower lid
    const rr = r * f.eye, lid = chuckle ? 0.85 : f.lid;
    ST.blob(ctx, ST.ellipseRing(x, y, rr * 1.3, rr, 8), '#d8ccaa', { lw: 4, seed, double: false });
    if (ST.SIL) return;
    ctx.fillStyle = C.INK;
    ctx.beginPath();
    ctx.arc(x + f.look[0] * rr * 0.4, y + f.look[1] * rr * 0.3, Math.max(2.6, rr * 0.55 * f.pup), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6dc';
    ctx.fillRect(x + 1, y - rr * 0.5, 2.5, 2.5);
    if (lid > 0.45) { ST.blob(ctx, [x - rr * 1.5, y - rr * 1.4, x + rr * 1.5, y - rr * 1.4, x + rr * 1.4, y - rr * 1.2 + rr * 2.2 * (lid - 0.3), x - rr * 1.4, y - rr * 1.2 + rr * 2.2 * (lid - 0.3)], SKIN, { lw: 0, seed: seed + 1 }); ST.stroke(ctx, [x - rr * 1.3, y - rr + rr * 2.2 * (lid - 0.35), x + rr * 1.3, y - rr + rr * 2.2 * (lid - 0.35)], { w: 4, seed: seed + 2 }); }
    ST.stroke(ctx, [x - rr * 1.4, y + rr * 1.3, x, y + rr * 2, x + rr * 1.4, y + rr * 1.2], { w: 2.6, seed: seed + 3 }); // puffy lower lid
  }
  function brow(ctx, x, y, s, r, k, seed) { // thin, high, plucked-looking arches
    const yy = y - 10 - r * 10;
    ST.stroke(ctx, [x - s * 16, yy + 8 + k * 4, x, yy - 8, x + s * 18, yy + 6], { w: 3.4, color: HAIR, seed });
  }
  function snout(ctx, x, y, dir, ks) { // pig snout: a round upturned disc with two big round nostrils facing the camera
    if (!ST.SIL) ST.blob(ctx, [x + ks * 20, y + 18, x + ks * 42, y + 22, x + ks * 32, y + 36, x + ks * 12, y + 32], SHADE, { lw: 0, seed: SEED + 39 });
    ST.blob(ctx, [x - 10, y - 34, x + 10, y - 34, x + 14, y - 14], SKIN, { lw: 5, seed: SEED + 40 }); // short bridge
    ST.blob(ctx, ST.ellipseRing(x + dir * 12, y, 30 - Math.abs(dir) * 10, 24, 10, dir * 0.4), '#c9927a', { lw: 7, seed: SEED + 41, shade: [SKIN_D, -6, 5], patch: ['#dba892', 4, -8, 0.3] });
    if (ST.SIL) return;
    ctx.fillStyle = C.INK;
    [[-11, 4], [11, 4]].forEach(([dx, dy], i) => { if (Math.abs(dir) > 0.8 && i === 0) return; ctx.beginPath(); ctx.ellipse(x + dir * 14 + dx * (1 - Math.abs(dir) * 0.4), y + dy, 6, 8.5, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  // wide frog mouth: the corners reach toward the ears; the lower lip hangs off the jaw (J)
  function mouth(ctx, x, y, w, f, seed, J) {
    const m = f.m, ww = w * (1 + m.wide * 0.2 - m.round * 0.45), s = m.smile * 16, lo = J.y(y + 4 + 14 * m.open);
    const L = [x - ww / 2, y - s + m.twist * 4], R = [x + ww / 2, y - s - m.twist * 4];
    if (lo - y > 8) {
      ST.hole(ctx, [L[0], L[1], x - ww * 0.25, y - 4, x + ww * 0.25, y - 4, R[0], R[1], x + ww * 0.25, lo, x - ww * 0.25, lo], { lw: 5, seed: seed + 9, inner: () => {
        for (let i = 0; i < 8; i++) ST.rect(ctx, x - ww * 0.36 + i * ww * 0.09, y - 7, ww * 0.075, 10, C.TOOTH, { seed: seed + i, lw: 2, amp: 0.5, double: false });
      } });
    } else ST.stroke(ctx, [L[0], L[1], x - ww * 0.3, y + 4 - s * 0.3, x + ww * 0.3, y + 4 - s * 0.3, R[0], R[1]], { w: m.press ? 7 : 5.5, seed: seed + 10, taper: false });
    if (!ST.SIL) [[L, -1], [R, 1]].forEach(([q, sg], i) => ST.stroke(ctx, [q[0] + sg * 2, q[1] - 8, q[0] + sg * 8, q[1] + 2, q[0] + sg * 2, q[1] + 10], { w: 3, seed: seed + 11 + i })); // dimple creases
  }
  function sweat(ctx, list, seed) { ST.beads(ctx, list, -1, seed); }
  function cheeks(ctx, list) { list.forEach(([x, y]) => ST.blotch(ctx, ST.ellipseRing(x, y, 18, 11, 7), 'rgba(176,58,46,0.38)')); }
  function hair(ctx, dx, v) { // slick black cap of hair, centre parting, a kiss curl
    if (v === 3) { ST.blob(ctx, [-78, -60, -80, -120, -50, -150, 0, -158, 50, -150, 80, -120, 78, -60, 40, -70, 0, -66, -40, -70], HAIR, { lw: 6, seed: SEED + 60, hatch: { c: 'rgba(160,150,130,0.35)', n: 8, len: 30, gap: 4, k: 3, ang: 80, bend: 0 } }); return; }
    ST.blob(ctx, [-76 + dx, -86, -74 + dx, -128, -40 + dx, -152, dx, -156, 40 + dx, -150, 74 + dx, -126, 76 + dx, -86, 50 + dx, -110, 6 + dx, -124, -40 + dx, -112], HAIR, { lw: 6, seed: SEED + 61 + v, hatch: { c: 'rgba(160,150,130,0.35)', n: 6, len: 26, gap: 4, k: 3, ang: 20, bend: 0 } });
    if (ST.SIL) return;
    ST.stroke(ctx, [dx + 2, -154, dx + 4, -126], { w: 3, color: '#5a5048', seed: SEED + 65, taper: false });
    ST.stroke(ctx, [dx + 10, -124, dx + 20, -112, dx + 10, -104, dx + 4, -112], { w: 4, color: HAIR, seed: SEED + 66, taper: false }); // kiss curl
  }
  function wattle(ctx, cx, w, J, ks) { // chins pouring into the chest: they hang off the jaw
    ST.blob(ctx, J.pts([cx - w, -10, cx - w * 0.6, 26, cx, 40, cx + w * 0.6, 26, cx + w, -10, cx, 6]), SKIN, { lw: 7, seed: SEED + 70, shade: [SKIN_D, -10 * ks, 6] });
    [[0.8, 4], [0.6, 22]].forEach(([k, dy], i) => ST.stroke(ctx, J.pts([cx - w * k, dy, cx, dy + 12, cx + w * k, dy]), { w: 3.4, seed: SEED + 71 + i }));
  }
  function headFront(ctx, f, o) {
    const J = o.J, ks = o.ks, ch = o.p.chuckle;
    wattle(ctx, 0, 84, J, ks);
    ear(ctx, -82, -70, -1, SEED + 74);
    ear(ctx, 82, -72, 1, SEED + 75);
    ST.blob(ctx, J.pts([-60, -140, 0, -152, 60, -140, 82, -100, 90, -50, 86, -10, 50, 10, 0, 16, -50, 10, -86, -10, -90, -50, -82, -100]), SKIN, { lw: 9, seed: SEED + 76, shade: [SKIN_D, -16 * ks, 8], mottle: ['#b07a62', 5, 14] });
    hair(ctx, 0, 0);
    cheeks(ctx, [[-56, -40], [58, -42]]);
    eye(ctx, -44, -80, 9, f, SEED + 79, ch);
    eye(ctx, 46, -82, 9, f, SEED + 83, ch);
    brow(ctx, -44, -96, -1, f.bl[0], f.bl[1], SEED + 87);
    brow(ctx, 46, -98, 1, f.br[0], f.br[1], SEED + 88);
    mouth(ctx, 0, -10, 128, f, SEED + 89, J);
    snout(ctx, 0, -50, 0, ks);
    ST.wart(ctx, -62, -16, 4, '#5a3a2a', SEED + 101, false);
    sweat(ctx, [[-30, -122], [40, -116], [70, -70]], SEED + 102);
  }
  function head34(ctx, f, o) {
    const J = o.J, ks = o.ks, ch = o.p.chuckle;
    wattle(ctx, 14, 82, J, ks);
    ear(ctx, -70, -70, -1, SEED + 105);
    ST.blob(ctx, J.pts([-50, -142, 10, -152, 64, -138, 90, -100, 100, -54, 96, -12, 60, 10, 10, 16, -40, 10, -76, -10, -80, -60, -72, -110]), SKIN, { lw: 9, seed: SEED + 106, shade: [SKIN_D, -16 * ks, 8], mottle: ['#b07a62', 5, 14] });
    hair(ctx, 10, 1);
    cheeks(ctx, [[-30, -40], [80, -44]]);
    eye(ctx, -18, -80, 9, f, SEED + 109, ch);
    eye(ctx, 64, -82, 7, f, SEED + 113, ch);
    brow(ctx, -18, -96, -1, f.bl[0], f.bl[1], SEED + 117);
    brow(ctx, 64, -98, 1, f.br[0], f.br[1], SEED + 118);
    mouth(ctx, 26, -10, 112, f, SEED + 119, J);
    snout(ctx, 36, -50, 0.5, ks);
    sweat(ctx, [[-10, -122], [70, -110]], SEED + 131);
  }
  function headProfile(ctx, f, o) {
    const J = o.J, ks = o.ks, ch = o.p.chuckle;
    wattle(ctx, 30, 60, J, ks);
    ST.blob(ctx, J.pts([-60, -134, 0, -152, 50, -138, 72, -100, 78, -70, 76, -40, 80, -14, 70, 8, 30, 16, -20, 10, -60, -10, -76, -70]), SKIN, { lw: 9, seed: SEED + 134, shade: [SKIN_D, -16 * ks, 8], mottle: ['#b07a62', 5, 14] });
    hair(ctx, -6, 2);
    ear(ctx, -30, -70, -1, SEED + 135);
    cheeks(ctx, [[30, -40]]);
    eye(ctx, 48, -82, 7, f, SEED + 137, ch);
    brow(ctx, 48, -98, 1, f.br[0], f.br[1], SEED + 141);
    mouth(ctx, 58, -10, 44, f, SEED + 142, J);
    snout(ctx, 80, -52, 1, ks);
    sweat(ctx, [[20, -116]], SEED + 154);
  }
  function headBack(ctx, f, o) {
    ear(ctx, -82, -70, -1, SEED + 156);
    ear(ctx, 82, -72, 1, SEED + 157);
    ST.blob(ctx, [-60, -140, 0, -152, 60, -140, 82, -100, 90, -50, 86, 0, 50, 20, 0, 26, -50, 20, -86, 0, -90, -50, -82, -100], SKIN, { lw: 9, seed: SEED + 158, shade: [SKIN_D, -16 * o.ks, 8] });
    hair(ctx, 0, 3);
    if (!ST.SIL) [[-60, 0, 0, 12, 60, 0], [-50, 18, 0, 28, 50, 18]].forEach((v, i) => ST.stroke(ctx, v, { w: 4, seed: SEED + 159 + i })); // neck rolls
  }
  const JAW = [{ pivot: -14, drop: 18, span: 10 }, { pivot: -14, drop: 18, span: 10 }, { pivot: -14, drop: 16, span: 10 }, { pivot: 0, drop: 0 }];
  const FACE = [
    { nose: [0, -50], mouth: [0, -6], chin: [0, 34], forehead: [0, -112], cheek: [[-56, -38], [58, -40]], ear: [[-88, -70], [88, -72]] },
    { nose: [40, -50], mouth: [26, -6], chin: [14, 34], forehead: [14, -112], cheek: [[-30, -38], [80, -42]], ear: [[-76, -70]] },
    { nose: [86, -52], mouth: [58, -6], chin: [30, 34], forehead: [30, -112], cheek: [[30, -38]], ear: [[-34, -70]] },
    null,
  ];

  function hold(ctx, side, j, g, p) { // the wax tablet, held at the palm (p.tabletL: in the left hand)
    if (!p.tablet || side !== (p.tabletL ? 'L' : 'R')) return;
    ST.rect(ctx, g[0] - 40, g[1] - 30, 80, 58, C.TIMBER, { seed: SEED + 170, lw: 5 });
    ST.rect(ctx, g[0] - 32, g[1] - 22, 64, 42, '#3c3426', { seed: SEED + 171, lw: 2 });
    if (!ST.SIL) for (let i = 0; i < 3; i++) ST.stroke(ctx, [g[0] - 24, g[1] - 10 + i * 12, g[0] + 22 - i * 10, g[1] - 10 + i * 12], { w: 2.2, color: '#a08a5a', seed: SEED + 172 + i, taper: false });
  }
  function holdOver(ctx, side, j) { // the gold ring on the left hand
    if (side === 'L') ST.blob(ctx, ST.ellipseRing(j.h[0], j.h[1] + 26 * (j.fore || 1), 8, 5, 6), '#8e6c22', { lw: 3, seed: SEED + 185, double: false });
  }
  // signature: thumbs twiddling on the belly (hands meet on the front of the ball - as far as his short arms reach -
  // and the thumbs swap on twos)
  ST.senatorTwiddle = (t) => { const s = Math.floor(ST.twos(t) * 6) % 2 ? 4 : -4, y = D.sy + 92, z = D.sz + 96; return { hL: ST.fitArm(D, 1, [10, y + s, z]), hR: ST.fitArm(D, -1, [-10, y - s, z]), kL: 'fist', kR: 'fist', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3] }; };
  const ARM = { cloth: C.LINEN, clothD: C.LINEN_D, w: [54, 46, 38], bare: 0.1, skin: SKIN, skinD: SKIN_D, hsz: 40, lw: 7.5, hatch: { c: 'rgba(40,34,20,0.5)', n: 3, len: 24, gap: 6, k: 3, ang: 30 } };
  const LEG = { cloth: SKIN, clothD: SKIN_D, w: [58, 46, 34], shoe: '#3e2618', shoeD: '#2a1a10', len: 64, sw: 32, lw: 8, splay: 0.55 };
  ST.defineCharacter({
    id: 'senator', name: 'The Senator', seed: SEED, D, neck: NECK, torso: body, heads: [headFront, head34, headProfile, headBack],
    jaw: JAW, face: FACE, arm: ARM, leg: LEG, hold, holdOver, expr0: 'grin',
    adjust: (P, p) => { if (p.chuckle) P.bob = (P.bob || 0) + (Math.floor(ST.twos(p.t || 0) * 6) % 2 ? 0.05 : 0); },
    extraRows: [
      ['twiddle', (Dd) => ({ pose: ST.pose('stand', Dd, null, ST.senatorTwiddle(0.05)) })],
      ['hand under chin', (Dd) => ({ pose: ST.pose('stand', Dd, null, Object.assign(ST.touch('R', 'chin', 0, 12, 'fist'), { hL: ST.fitArm(Dd, 1, [10, Dd.sy + 92, Dd.sz + 96]), poleL: [1, 0.2, -0.3] })) })],
    ],
  });
})();
