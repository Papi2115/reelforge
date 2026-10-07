/* The persistent 3D room (metres, y up, z away from the first camera). Everything here is static geometry or
 * a pure function of t (lamp swing). Light: one warm pendant lamp + the cyan HOTEL sign outside, whose light
 * only enters through the window aperture (mullions + half-lowered blinds) and is blocked by the board and desk. */
'use strict';
(function () {
  const NB = window.NB;
  const C = NB.C;
  const R = (a, b, c, d, e) => Uint8Array.from([C[a], C[b], C[c], C[d], C[e]]);
  // Material ramps by light class: [shadow, night ambient, lamp, lamp hot, neon]
  const M = {
    board: R('NIGHT', 'INDIGO', 'PLUM', 'PLUM', 'TEAL_D'),
    wall: R('INK', 'NIGHT', 'PLUM', 'PLUM', 'TEAL_D'),
    floor: R('INK', 'INK', 'PLUM', 'RUST', 'TEAL_D'),
    wood: R('INK', 'GRAPH', 'PLUM', 'RUST', 'TEAL'),
    desk: R('INK', 'NIGHT', 'PLUM', 'PLUM', 'TEAL_D'),
    paper: R('SLATE', 'MIST', 'PEACH', 'HOTW', 'ICE'),
    paperB: R('DUSK', 'SLATE', 'TAN', 'PEACH', 'MIST'),
    pDark: R('INK', 'NIGHT', 'NIGHT', 'PLUM', 'TEAL_D'),
    pMid: R('NIGHT', 'INDIGO', 'PLUM', 'RUST', 'TEAL'),
    pLight: R('INDIGO', 'SLATE', 'TAN', 'PEACH', 'TEAL'),
    ink: R('INK', 'INK', 'INK', 'INK', 'INK'),
    metal: R('INK', 'GRAPH', 'TAN', 'PEACH', 'CYAN'),
    shade: R('INK', 'GRAPH', 'PLUM', 'RUST', 'TEAL'),
    red: R('RED_DK', 'RED', 'RED', 'RED_HOT', 'RED'),
    brass: R('PLUM', 'DUSK', 'AMBER', 'PEACH', 'CYAN'),
    mug: R('INK', 'DUSK', 'TAN', 'PEACH', 'TEAL'),
    water: R('DUSK', 'SLATE', 'TAN', 'TAN', 'TEAL'),
  };
  const P = {
    board: NB.addPlane(0, 0, -1, 0),
    desk: NB.addPlane(0, 1, 0, 0.78),
    floor: NB.addPlane(0, 1, 0, 0),
    back: NB.addPlane(0, 0, -1, -1.45),
    left: NB.addPlane(1, 0, 0, -3.1),
    right: NB.addPlane(-1, 0, 0, -3.0),
  };
  const G = {
    ZW: 1.45, CEIL: 3.0, XL: -3.1, XR: 3.0, ZF: -6.5,
    win: { x0: 1.5, x1: 2.85, y0: 0.95, y1: 2.6, xm: 2.175, ym: 1.72, blind: 2.22 },
    board: { cx: -0.1, cy: 1.7, w: 2.6, h: 1.5, frame: 0.065 },
    desk: { y: 0.78, x0: -1.15, x1: 1.25, z0: -1.6, z1: -0.82, th: 0.045 },
    lampPivot: [-0.33, 3.0, -0.62],
    cord: 0.5,
    neon: [2.86, 3.1, 3.6],
  };
  const B = G.board;
  const BX0 = B.cx - B.w / 2;
  const BX1 = B.cx + B.w / 2;
  const BY0 = B.cy - B.h / 2;
  const BY1 = B.cy + B.h / 2;

  NB.light.occluders = function (qx, qy, qz, dx, dy, dz) {
    if (qz >= G.ZW - 1e-4) return false;
    const s = (G.ZW - qz) / dz;
    if (s <= 0 || s >= 1) return false;
    const wx = qx + dx * s;
    const wy = qy + dy * s;
    const w = G.win;
    if (wx < w.x0 || wx > w.x1 || wy < w.y0 || wy > w.y1) return false;
    if (Math.abs(wx - w.xm) < 0.028 || Math.abs(wy - w.ym) < 0.024) return false;
    if (wy > w.blind && ((wy - w.blind) / 0.075) % 1 < 0.58) return false;
    if (qz < -0.002) {
      const s0 = -qz / dz;
      const bx = qx + dx * s0;
      const by = qy + dy * s0;
      if (bx > BX0 - B.frame && bx < BX1 + B.frame && by > BY0 - B.frame - 0.03 && by < BY1 + B.frame) return false;
    }
    if (qy < G.desk.y - 0.002 && dy > 0) {
      const s1 = (G.desk.y - qy) / dy;
      if (s1 < 1) {
        const x = qx + dx * s1;
        const z = qz + dz * s1;
        if (x > G.desk.x0 && x < G.desk.x1 && z > G.desk.z0 && z < G.desk.z1) return false;
      }
    }
    return true;
  };

  // ---------- primitives ----------
  const v3 = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
  };
  const camPos = () => [NB.cam.px, NB.cam.py, NB.cam.pz];
  /** Flat-lit convex face (4+ world points) with optional outline width (px). */
  function face(pts, n, mat, outline) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    const k = pts.length / 3;
    for (let i = 0; i < k; i++) {
      cx += pts[3 * i];
      cy += pts[3 * i + 1];
      cz += pts[3 * i + 2];
    }
    cx /= k;
    cy /= k;
    cz /= k;
    if ((NB.cam.px - cx) * n[0] + (NB.cam.py - cy) * n[1] + (NB.cam.pz - cz) * n[2] <= 0) return;
    const cls = NB.classAt(cx, cy, cz, n[0], n[1], n[2]);
    NB.poly3(pts, mat[cls]);
    if (outline) NB.polyline3(pts, 0, outline, outline, C.INK, true);
  }
  /** Oriented box: centre c, unit axes a,b,d (arrays), half sizes hx,hy,hz. mats: one ramp or {top, side}. */
  function obox(c, a, b, d, hx, hy, hz, mat, outline) {
    const corner = (sx, sy, sz) => [
      c[0] + a[0] * hx * sx + b[0] * hy * sy + d[0] * hz * sz,
      c[1] + a[1] * hx * sx + b[1] * hy * sy + d[1] * hz * sz,
      c[2] + a[2] * hx * sx + b[2] * hy * sy + d[2] * hz * sz,
    ];
    const q = (p1, p2, p3, p4) => [].concat(p1, p2, p3, p4);
    const m = mat instanceof Uint8Array ? { top: mat, side: mat } : mat;
    const ol = outline === undefined ? 1 : outline;
    face(q(corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1)), b, m.top, ol);
    face(q(corner(-1, -1, -1), corner(-1, -1, 1), corner(1, -1, 1), corner(1, -1, -1)), v3.mul(b, -1), m.side, ol);
    face(q(corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1)), a, m.side, ol);
    face(q(corner(-1, -1, -1), corner(-1, 1, -1), corner(-1, 1, 1), corner(-1, -1, 1)), v3.mul(a, -1), m.side, ol);
    face(q(corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)), d, m.side, ol);
    face(q(corner(-1, -1, -1), corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1)), v3.mul(d, -1), m.front || m.side, ol);
  }
  const X = [1, 0, 0];
  const Y = [0, 1, 0];
  const Z = [0, 0, 1];
  const abox = (x0, y0, z0, x1, y1, z1, mat, ol) =>
    obox([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], X, Y, Z, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, mat, ol);

  // ---------- outside: the brick wall across a narrow alley, a fire escape, the vertical HOTEL sign ----------
  function drawOutside(t, neonOn) {
    NB.fb.fill(C.NIGHT);
    const Zf = 3.75;
    NB.poly3([0.2, -3, Zf, 7, -3, Zf, 7, 6, Zf, 0.2, 6, Zf], C.INK);
    // brick courses: a few long mortar lines in the sign's light, nothing else
    for (let k = 0; k < 9; k++) {
      const y = 0.55 + k * 0.31;
      NB.polyline3([1.6 + (k % 2) * 0.2, y, Zf - 0.005, 3.9 - (k % 3) * 0.25, y, Zf - 0.005], 0.012, 1, 2, k % 3 === 1 ? C.TEAL_D : C.NIGHT);
    }
    // fire escape: platform rail + ladder, plain iron silhouettes
    const z2 = Zf - 0.5;
    NB.polyline3([0.9, 2.62, z2, 2.35, 2.62, z2], 0.03, 1, 4, C.GRAPH);
    NB.polyline3([0.9, 2.95, z2, 2.35, 2.95, z2], 0.02, 1, 3, C.GRAPH);
    for (let x = 1.0; x < 2.35; x += 0.22) NB.polyline3([x, 2.62, z2, x, 2.95, z2], 0.012, 1, 2, C.GRAPH);
    NB.polyline3([1.15, 2.62, z2, 1.6, 0.4, z2], 0.025, 1, 3, C.GRAPH);
    NB.polyline3([1.3, 2.62, z2, 1.75, 0.4, z2], 0.025, 1, 3, C.GRAPH);
    // one warm window across the alley: somebody else is up late
    NB.poly3([3.55, 1.05, Zf - 0.01, 3.95, 1.05, Zf - 0.01, 3.95, 1.6, Zf - 0.01, 3.55, 1.6, Zf - 0.01], C.RUST);
    NB.poly3([3.55, 1.05, Zf - 0.02, 3.7, 1.05, Zf - 0.02, 3.7, 1.6, Zf - 0.02, 3.55, 1.6, Zf - 0.02], C.PLUM);
    // vertical sign: backing plate, tube letters H-O-T-E-L (the middle T has a bad electrode)
    const sx = 2.62;
    const zz = Zf - 0.12;
    // neon spill on the bricks: two hand-placed dither rings, only over the dark wall
    if (neonOn) {
      const halo = (pad, dens) => {
        const x0 = sx - pad;
        const x1 = sx + 0.36 + pad;
        const y0 = 0.62 - pad;
        const y1 = 3.05 + pad;
        const c = pad * 0.9;
        const z = Zf - 0.003;
        NB.poly3([x0 + c, y0, z, x1 - c, y0, z, x1, y0 + c, z, x1, y1 - c, z, x1 - c, y1, z, x0 + c, y1, z, x0, y1 - c, z, x0, y0 + c, z], {
          fn: (x, y) => (NB.fb[y * NB.W + x] === C.INK && NB.bayer(x, y) < dens ? C.TEAL_D : -1),
        });
      };
      halo(0.34, 0.1);
      halo(0.17, 0.28);
    }
    NB.poly3([sx - 0.06, 0.62, zz + 0.02, sx + 0.42, 0.62, zz + 0.02, sx + 0.42, 3.05, zz + 0.02, sx - 0.06, 3.05, zz + 0.02], C.INK);
    NB.polyline3([sx - 0.06, 0.62, zz, sx + 0.42, 0.62, zz, sx + 0.42, 3.05, zz, sx - 0.06, 3.05, zz], 0.012, 1, 2, C.GRAPH, true);
    const letters = 'HOTEL';
    for (let i = 0; i < 5; i++) {
      const on = neonOn && !(i === 2 && NB.light.tFlick);
      const lay = NB.font.layout(letters[i], { font: 'disp', size: 0.36, x: 0, y: 0 });
      const y0 = 2.93 - i * 0.47;
      lay.strokes.forEach((st) => {
        const pts = [];
        for (let k = 0; k < st.p.length; k += 2) pts.push(sx + 0.1 + st.p[k], y0 - st.p[k + 1], zz);
        if (on) NB.polyline3(pts, 0.075, 3, 9, { glow: C.TEAL_D });
        NB.polyline3(pts, 0.03, 1, 4, on ? C.TEAL : C.GRAPH);
        if (on) NB.polyline3(pts, 0.011, 1, 2, C.CYAN);
      });
    }
  }

  // ---------- room shell ----------
  function drawRoom() {
    const w = G.win;
    const { ZW, CEIL, XL, XR, ZF } = G;
    const back = { mat: M.wall, plane: P.back };
    NB.poly3([XL, 0, ZW, w.x0, 0, ZW, w.x0, CEIL, ZW, XL, CEIL, ZW], back);
    NB.poly3([w.x1, 0, ZW, XR, 0, ZW, XR, CEIL, ZW, w.x1, CEIL, ZW], back);
    NB.poly3([w.x0, 0, ZW, w.x1, 0, ZW, w.x1, w.y0, ZW, w.x0, w.y0, ZW], back);
    NB.poly3([w.x0, w.y1, ZW, w.x1, w.y1, ZW, w.x1, CEIL, ZW, w.x0, CEIL, ZW], back);
    NB.poly3([XL, 0, ZF, XL, 0, ZW, XL, CEIL, ZW, XL, CEIL, ZF], { mat: M.wall, plane: P.left });
    NB.poly3([XR, 0, ZW, XR, 0, ZF, XR, CEIL, ZF, XR, CEIL, ZW], { mat: M.wall, plane: P.right });
    NB.poly3([XL, 0, ZF, XR, 0, ZF, XR, 0, ZW, XL, 0, ZW], { mat: M.floor, plane: P.floor });
    NB.poly3([XL, CEIL, ZW, XR, CEIL, ZW, XR, CEIL, ZF, XL, CEIL, ZF], C.INK);
    // skirting line + one floorboard seam pair (quiet, gives the floor scale)
    NB.polyline3([XL, 0.09, ZW - 0.002, w.x0 + 2, 0.09, ZW - 0.002], 0.012, 1, 2, C.INK);
    // window: frame, mullions, sill, blind slats (down to the blind line)
    const z = ZW - 0.004;
    abox(w.x0 - 0.05, w.y0 - 0.07, ZW - 0.06, w.x1 + 0.05, w.y0, ZW, M.wood);
    NB.polyline3([w.x0, w.y0, z, w.x1, w.y0, z, w.x1, w.y1, z, w.x0, w.y1, z], 0.04, 1, 6, C.INK, true);
    NB.polyline3([w.xm, w.y0, z, w.xm, w.y1, z], 0.05, 1, 5, C.INK);
    NB.polyline3([w.x0, w.ym, z, w.x1, w.ym, z], 0.045, 1, 5, C.INK);
    for (let y = w.blind; y < w.y1; y += 0.075) {
      NB.poly3([w.x0, y, z - 0.01, w.x1, y, z - 0.01, w.x1, y + 0.042, z - 0.01, w.x0, y + 0.042, z - 0.01], C.GRAPH);
      NB.polyline3([w.x0, y, z - 0.012, w.x1, y, z - 0.012], 0.006, 1, 1, C.TEAL_D);
    }
    NB.polyline3([w.x0 + 0.3, w.blind, z - 0.015, w.x0 + 0.3, w.y1, z - 0.015], 0.006, 1, 1, C.INK);
    NB.polyline3([w.x1 - 0.3, w.blind, z - 0.015, w.x1 - 0.3, w.y1, z - 0.015], 0.006, 1, 1, C.INK);
    // the blind cord, hanging a little crooked
    NB.polyline3([w.x1 - 0.12, w.y1, z - 0.02, w.x1 - 0.1, 1.55, z - 0.02], 0.004, 1, 1, C.MIST);
  }

  // ---------- the board as an object: stand, back, frame, surface ----------
  function drawBoardBody() {
    const f = B.frame;
    // stand: two posts behind the board, feet on the floor
    [BX0 + 0.16, BX1 - 0.16].forEach((x) => {
      abox(x - 0.03, 0.02, 0.06, x + 0.03, BY1 + 0.02, 0.12, M.wood);
      abox(x - 0.035, 0, -0.32, x + 0.035, 0.05, 0.42, M.wood);
    });
    abox(BX0 - f, BY0 - f, 0.0, BX1 + f, BY1 + f, 0.055, M.wood, 1);
    // board surface (the cork face, lit per pixel)
    NB.poly3([BX0, BY0, 0, BX1, BY0, 0, BX1, BY1, 0, BX0, BY1, 0], { mat: M.board, plane: P.board });
    // a board that has been used before: old pin holes
    for (let i = 0; i < 46; i++) {
      const x = BX0 + 0.06 + NB.rnd(301, i) * (B.w - 0.12);
      const y = BY0 + 0.06 + NB.rnd(302, i) * (B.h - 0.12);
      const p = NB.proj(x, y, -0.0005);
      if (p && (0.0011 * NB.cam.f) / p[2] > 0.6) NB.stampAt(p[0], p[1], (0.0022 * NB.cam.f) / p[2], { mat: M.pDark, plane: P.board });
    }
    // the frame: four proud rails
    abox(BX0 - f, BY1, -0.03, BX1 + f, BY1 + f, 0.0, M.wood, 1);
    abox(BX0 - f, BY0 - f, -0.03, BX1 + f, BY0, 0.0, M.wood, 1);
    abox(BX0 - f, BY0, -0.03, BX0, BY1, 0.0, M.wood, 1);
    abox(BX1, BY0, -0.03, BX1 + f, BY1, 0.0, M.wood, 1);
    // chalk-tray ledge along the bottom
    abox(BX0 - f, BY0 - f - 0.02, -0.08, BX1 + f, BY0 - f, 0.0, M.wood, 1);
  }

  // ---------- desk ----------
  function drawDeskBody() {
    const d = G.desk;
    [[d.x0 + 0.05, d.z0 + 0.05], [d.x1 - 0.05, d.z0 + 0.05], [d.x0 + 0.05, d.z1 - 0.05], [d.x1 - 0.05, d.z1 - 0.05]].forEach(([x, z]) =>
      abox(x - 0.025, 0, z - 0.025, x + 0.025, d.y - d.th, z + 0.025, M.wood),
    );
    abox(d.x0 + 0.04, d.y - d.th - 0.12, d.z0 + 0.04, d.x1 - 0.04, d.y - d.th, d.z0 + 0.06, M.wood);
    abox(d.x0, d.y - d.th, d.z0, d.x1, d.y - 0.001, d.z1, M.wood, 1);
    NB.poly3([d.x0, d.y, d.z0, d.x1, d.y, d.z0, d.x1, d.y, d.z1, d.x0, d.y, d.z1], { mat: M.desk, plane: P.desk });
  }

  // ---------- lamp (pure function of swing angles) ----------
  function lampState(la) {
    const p = G.lampPivot;
    // cord direction: straight down plus the swing; the shade is aimed at a point on the board
    const cd = v3.norm([Math.sin(la.tilt), -1, 0]);
    const pos = v3.add(p, v3.mul(cd, G.cord));
    const aim = v3.norm(v3.sub([la.aim[0], la.aim[1], 0], pos));
    return { pivot: p, pos, axis: aim };
  }
  /** Conical shade (pendant or desk lamp head). dims: {r0, r1, back, front, cordW} */
  function drawLamp(st, lampOn, dims) {
    const dm = dims || { r0: 0.045, r1: 0.17, back: 0.06, front: 0.12, cordW: 0.006 };
    const ax = st.axis;
    const tmp = Math.abs(ax[1]) < 0.9 ? Y : X;
    const u = v3.norm(v3.cross(ax, tmp));
    const w = v3.cross(ax, u);
    const top = v3.sub(st.pos, v3.mul(ax, dm.back));
    const rim = v3.add(st.pos, v3.mul(ax, dm.front));
    if (dm.cordW) NB.polyline3([].concat(st.pivot, top), dm.cordW, 1, 2, C.INK);
    const N = 14;
    const ring = (c, r) => {
      const out = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        out.push(v3.add(c, v3.add(v3.mul(u, Math.cos(a) * r), v3.mul(w, Math.sin(a) * r))));
      }
      return out;
    };
    const r0 = ring(top, dm.r0);
    const r1 = ring(rim, dm.r1);
    const toCam = v3.sub(camPos(), rim);
    if (v3.dot(toCam, ax) > 0) {
      const disc = [];
      r1.forEach((p) => disc.push(...p));
      NB.poly3(disc, lampOn ? C.PEACH : C.GRAPH);
      const bulb = NB.proj(...v3.add(st.pos, v3.mul(ax, dm.front * 0.3)));
      if (bulb && lampOn) NB.stampAt(bulb[0], bulb[1], Math.min(12, ((dm.r1 * 0.6 * NB.cam.f) / bulb[2]) + 2), C.HOTW);
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const pts = [].concat(r0[i], r0[j], r1[j], r1[i]);
      const mid = v3.mul(v3.add(v3.add(r0[i], r0[j]), v3.add(r1[i], r1[j])), 0.25);
      const n = v3.norm(v3.sub(mid, v3.add(top, v3.mul(ax, v3.dot(v3.sub(mid, top), ax)))));
      face(pts, v3.norm(v3.sub(n, v3.mul(ax, 0.35))), M.shade, 0);
    }
    const rimPts = [];
    r1.forEach((p) => rimPts.push(...p));
    NB.polyline3(rimPts, 0.006, 1, 2, lampOn ? C.AMBER : C.INK, true);
  }
  // Desk lamp: weighted base, two-segment arm, small shade aimed at the map.
  const deskLamp = (function () {
    const base = [-0.7, G.desk.y, -1.42];
    const elbow = [-0.66, 1.3, -1.42];
    const pos = [-0.36, 1.34, -1.3];
    const axis = v3.norm(v3.sub([0.06, G.desk.y, -1.12], pos));
    return { base, elbow, pos, axis, pivot: elbow };
  })();
  function drawDeskLamp(on) {
    const d = deskLamp;
    const N = 12;
    const ringAt = (y, r) => {
      const out = [];
      for (let i = 0; i < N; i++) out.push(d.base[0] + Math.cos((i / N) * 6.283) * r, y, d.base[2] + Math.sin((i / N) * 6.283) * r);
      return out;
    };
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * 6.283;
      const a1 = ((i + 1) / N) * 6.283;
      const p = (a, y, r) => [d.base[0] + Math.cos(a) * r, y, d.base[2] + Math.sin(a) * r];
      face([].concat(p(a0, d.base[1], 0.075), p(a1, d.base[1], 0.075), p(a1, d.base[1] + 0.025, 0.06), p(a0, d.base[1] + 0.025, 0.06)), [Math.cos((a0 + a1) / 2), 0.5, Math.sin((a0 + a1) / 2)], M.shade, 0);
    }
    NB.poly3(ringAt(d.base[1] + 0.025, 0.06), C.GRAPH);
    NB.polyline3([].concat([d.base[0], d.base[1] + 0.02, d.base[2]], d.elbow, v3.sub(d.pos, v3.mul(d.axis, 0.05))), 0.012, 1, 4, C.INK);
    NB.polyline3([].concat([d.base[0] + 0.012, d.base[1] + 0.02, d.base[2]], v3.add(d.elbow, [0.012, 0, 0])), 0.003, 1, 1, C.GRAPH);
    drawLamp(d, on, { r0: 0.022, r1: 0.07, back: 0.05, front: 0.05, cordW: 0 });
  }

  // ---------- chair (foreground silhouette, gives the room a near layer) ----------
  function drawChair() {
    const cx = -0.55;
    const cz = -2.05;
    const m = M.wood;
    abox(cx - 0.22, 0.44, cz - 0.22, cx + 0.22, 0.48, cz + 0.22, m);
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([dx, dz]) => abox(cx + dx - 0.02, 0, cz + dz - 0.02, cx + dx + 0.02, 0.44, cz + dz + 0.02, m));
    [-0.2, 0.2].forEach((dx) => abox(cx + dx - 0.02, 0.48, cz - 0.24, cx + dx + 0.02, 1.0, cz - 0.2, m));
    abox(cx - 0.22, 0.8, cz - 0.25, cx + 0.22, 0.98, cz - 0.21, m);
    // a coat over the backrest: one draped slab (dark), the human mess of a long night
    NB.poly3([cx - 0.24, 0.99, cz - 0.27, cx + 0.12, 1.0, cz - 0.27, cx + 0.16, 0.62, cz - 0.3, cx - 0.02, 0.55, cz - 0.31, cx - 0.26, 0.66, cz - 0.3], C.INK);
  }

  NB.world = { M, P, G, v3, face, obox, abox, drawOutside, drawRoom, drawBoardBody, drawDeskBody, lampState, drawLamp, deskLamp, drawDeskLamp, drawChair, BX0, BX1, BY0, BY1 };
})();
