/* MINIMAL CHARACTER SKELETON - copy this file to start a new hand-built c-plus person. Everything a character must
   provide is here, nothing more; see CHARACTER_CONTRACT.md for the rules the validators check.
   "The Clerk": a plain clerk with a ledger. Replace the shapes, keep the structure. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const SKIN = C.SKIN_SALLOW, SKIN_D = C.SKIN_SALLOW_D, COAT = C.GREYBLUE, COAT_D = C.GREYBLUE_D, SEED = 4100;

  // 1. DIMENSIONS (body space: x = the character's LEFT, y = down from the feet, z = forward).
  //    sw/sy/sz = the shoulder joint. It MUST land inside every torso view and BELOW the real chin (validator 1).
  //    tilt: one shoulder higher (+ = left lower); it is applied ONCE by the engine to the anchors and to the torso.
  //    hk = head scale. Arm/leg lengths, waist (for akimbo), lean (permanent body lean, degrees).
  const D = { sw: 52, sy: -460, sz: 4, tilt: 5, l1a: 100, l2a: 92, hw: 26, hy: -280, l1l: 140, l2l: 130, elbowOut: 0.7, top: -760, waist: [64, -330], hk: 1.1, lean: 0 };

  // 2. NECK per body view (figure space, unmirrored): where the head's origin (top of the neck) sits.
  const NECK = [[0, -498], [10, -498], [20, -494], [0, -498]];

  // 3. TORSO per view, drawn by hand around the projected shoulders (front +-sw, 3/4 ~+-0.7sw, profile = depth).
  //    Draw the main outline with ST.torso(ctx, A, pts, ...) and any other part near the shoulders with A.fit(pts):
  //    that is how the torso READS the anchors (tilt). Never offset shoulders by hand.
  const TORSO = [
    [-30, -506, -66, -492, -78, -450, -72, -380, -74, -300, -62, -262, 62, -262, 74, -300, 72, -380, 78, -450, 66, -492, 30, -506],
    [-22, -508, -58, -494, -66, -450, -62, -380, -66, -300, -54, -262, 60, -262, 72, -300, 70, -380, 72, -450, 62, -492, 26, -508],
    [-18, -508, -42, -486, -48, -420, -44, -330, -42, -262, 46, -262, 50, -330, 48, -420, 36, -486, 12, -508],
    [-30, -506, -66, -492, -78, -450, -72, -380, -74, -300, -62, -262, 62, -262, 74, -300, 72, -380, 78, -450, 66, -492, 30, -506],
  ];
  function torso(ctx, v, A) {
    ST.torso(ctx, A, TORSO[v], COAT, { lw: 9, seed: SEED + v, lit: [COAT_D, 22], hatch: { c: 'rgba(14,18,22,0.5)', n: 7, len: 40, gap: 7, k: 3, ang: 80 } });
    if (v < 3) ST.stroke(ctx, A.fit([[0, -500, 2, -270], [24, -500, 30, -270], [40, -500, 42, -270]][v]), { w: 4, seed: SEED + 5 }); // the button line
  }

  // 4. HEADS per head view (front, 3/4, profile, back), head-local (origin = neck top, facing +x).
  //    THE JAW RULE: o.J = ST.jaw(f.jaw, JAW[view]). Run the skin outline through o.J.pts and put everything that hangs
  //    off the jaw (lower lip, chin, beard, warts) at o.J.y(...). Never move a separate "jaw tier" by itself.
  //    o.measure is true while the engine measures the head box: skip hats and props then.
  const JAW = { pivot: -40, drop: 22, span: 8 };
  const OUT = [
    [-50, -20, -56, -80, -50, -140, -26, -176, 8, -180, 40, -168, 56, -130, 58, -80, 52, -24, 30, 4, 0, 12, -30, 4],
    [-40, -20, -50, -80, -46, -140, -20, -178, 16, -180, 48, -164, 64, -128, 70, -90, 72, -60, 64, -24, 40, 4, 10, 12, -20, 4],
    [-36, -16, -50, -80, -46, -144, -14, -180, 22, -176, 48, -150, 58, -112, 66, -74, 62, -40, 56, -10, 36, 8, 0, 10],
    [-50, -20, -56, -80, -50, -140, -26, -176, 8, -180, 40, -168, 56, -130, 58, -80, 52, -24, 30, 4, 0, 12, -30, 4],
  ];
  const HAIR = [[-56, -110, -50, -170, 0, -194, 50, -172, 58, -112, 30, -150, -20, -146], [-48, -110, -40, -172, 12, -196, 58, -168, 68, -120, 40, -150, -10, -150], [-50, -100, -40, -170, 10, -192, 50, -160, 30, -150, -10, -140], [-58, -40, -60, -150, 0, -196, 60, -150, 58, -40, 0, -60]];
  function head(v) {
    return (ctx, f, o) => {
      const J = o.J, ks = o.ks;
      ST.blob(ctx, J.pts(OUT[v]), SKIN, { lw: 9, seed: SEED + 20 + v, shade: [SKIN_D, -16 * ks, 8] }); // ONE skin outline
      ST.blob(ctx, HAIR[v], C.BROWN_D, { lw: 6, seed: SEED + 30 + v });
      if (v === 3) return;
      const cx = [0, 22, 46][v];
      [[-22, 0], [22, 1]].forEach(([dx, side]) => {
        if (v === 2 && side === 0) return;
        const x = cx + dx * [1, 0.8, 0.6][v];
        ST.socketEye(ctx, ST.ellipseRing(x, -96, 11 * f.eye * (v === 2 ? 0.7 : 1), 9 * f.eye, 8), { pupil: [x + f.look[0] * 5, -96 + f.look[1] * 4], pr: 3.6 * f.pup, lid: f.lid, sq: f.sq[side], skin: SKIN, lw: 4, seed: SEED + 40 + side });
      });
      ST.blob(ctx, [cx - 8, -86, cx + 10 + v * 6, -72, cx + 2, -58, cx - 10, -62], SKIN, { lw: 6, seed: SEED + 50, shade: [SKIN_D, -4 * ks, 3] }); // nose
      const mx = cx + v * 4, hw = 18 - v * 4;
      if (J.d > 3) ST.hole(ctx, [mx - hw, -40, mx, -43, mx + hw, -40, mx + hw * 0.6, J.y(-34), mx - hw * 0.6, J.y(-34)], { lw: 4, seed: SEED + 60 });
      else ST.stroke(ctx, [mx - hw, -40 + f.m.smile * -4, mx, -38, mx + hw, -40 + f.m.smile * -4], { w: 4.5, seed: SEED + 61, taper: false });
      ST.wart(ctx, mx + 10, J.y(-8), 3.5, '#6e5a3a', SEED + 62, true); // a chin mole: hangs off the jaw
    };
  }

  // 5. FACE ANCHORS per head view (head-local, on the REAL drawing): touch targets for ST.touch. Lists = candidates,
  //    the engine picks the one on the touching hand's side. Points below JAW.pivot follow the jaw automatically.
  const FACE = [
    { nose: [0, -70], mouth: [0, -40], chin: [0, 6], forehead: [0, -140], cheek: [[-36, -56], [36, -56]], ear: [[-54, -84], [54, -84]] },
    { nose: [26, -70], mouth: [26, -40], chin: [22, 6], forehead: [16, -140], cheek: [[-10, -56], [52, -56]], ear: [[-44, -84]] },
    { nose: [58, -70], mouth: [52, -40], chin: [36, 4], forehead: [40, -140], cheek: [[30, -56]], ear: [[-16, -86]] },
    null,
  ];

  // 6. LIMB STYLES: arm (hsz = hand size, also used for palms/grips/guard) and leg. Limbs are never double-stroked.
  const ARM = { cloth: COAT, clothD: COAT_D, w: [36, 32, 28], skin: SKIN, skinD: SKIN_D, hsz: 32, lw: 7, cuff: C.LINEN };
  const LEG = { cloth: C.BLACK, clothD: C.BLACK_D, w: [40, 30, 24], shoe: C.BROWN_D, shoeD: '#241a12', len: 56, sw: 26, lw: 7 };

  // 7. GRIPS: props are drawn AT THE SOLVED PALM (g), before the hand closes over them. p.ledger = 'L' | 'R'.
  function hold(ctx, side, j, g, p) {
    if (p.ledger !== side) return;
    ST.rect(ctx, g[0] - 34, g[1] - 26, 68, 50, C.RUST_D, { seed: SEED + 70, lw: 6 });
    ST.rect(ctx, g[0] - 28, g[1] - 20, 56, 38, C.PAPER, { seed: SEED + 71, lw: 2 });
  }

  ST.defineCharacter({
    id: 'clerk', name: 'The Clerk (skeleton)', seed: SEED, D, neck: NECK, torso, heads: [head(0), head(1), head(2), head(3)],
    jaw: JAW, face: FACE, arm: ARM, leg: LEG, hold, shadowW: 160, expr0: 'deadpan',
    extraRows: [['ledger', (Dd) => ({ ledger: 'R', pose: ST.pose('stand', Dd, null, { hR: ST.handAt(Dd, -1, -0.2, 0.55, 0.6), kR: 'grip' }) })]],
  });
})();
