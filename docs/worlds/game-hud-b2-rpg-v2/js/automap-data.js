/* Automap geometry, derived once from the real level grid (RF.MAP, era 1983): every edge between a walkable cell
   and a solid one becomes a wall line; shelves / cubicles / the counter are interior lines; the open desert has no
   walls, so the landfill is the pit outline, the fence and the truck tracks from the floor map. Lines are put in a
   pencil order (greedy chain from the door you enter by) and get seeded hand-ruling: room offsets, 1 px restarts,
   corner overruns, uneven dashes and pen speeds. Static data only - nothing here depends on time. */
'use strict';
(function () {
  const RF = window.RF, M = RF.MAP, WT = M.WT;
  const S = 8; // px per cell on the automap (the HUD minimap uses 3)
  const INTERIOR = [WT.whShelf, WT.whShelfEnd, WT.whShelfSign, WT.cubicle, WT.counter];
  const idAt = (x, y) => M.wall[y * M.W + x];
  const isOpen = (x, y) => idAt(x, y) === WT.empty || idAt(x, y) === WT.door;
  const LAST_ROOM = 4; // 0 corridor, 1 office, 2 warehouse, 3 store, 4 returns; 5 = desert (no walls)

  // each region sits a pixel off the grid, like rooms traced by hand one at a time
  const JIT = [];
  for (let r = 0; r <= 5; r++) JIT.push([Math.round((RF.hash3(r, 3, 77) - 0.5) * 2.6), Math.round((RF.hash3(r, 4, 77) - 0.5) * 2.6)]);

  /** One pen line in px (camera-free): along-axis span [a, b), perpendicular coordinate q. */
  function mk(h, a, b, q, r, cls, seed) {
    const rnd = RF.rng(seed);
    const n0 = b - a - 1;
    const over = () => (cls === 0 && rnd() < 0.4 ? 1 + Math.floor(rnd() * 2) : 0);
    const os0 = over(), os1 = over();
    const long = n0 >= 4 * S && rnd() < 0.55;
    const on = 3 + Math.floor(rnd() * 2);
    return {
      h: h, r: r, cls: cls, a: a - os0, b: b - 1 + os1, q: q, n: n0 + os0 + os1, len: (b - a) / S,
      jogAt: long ? 0.3 + rnd() * 0.4 : 0, jog: rnd() < 0.5 ? 1 : -1, speed: 0.7 + rnd() * 0.6,
      on: on, period: on + 2 + Math.floor(rnd() * 2), phase: Math.floor(rnd() * 5), p0: 0, dir: 1,
    };
  }

  // ---------------- walls from the grid ----------------
  const runs = new Map();
  for (let y = 0; y < M.H; y++)
    for (let x = 0; x < M.W; x++) {
      if (!isOpen(x, y)) continue;
      const r = M.regionOfX(x);
      if (r > LAST_ROOM) continue;
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= M.W || ny >= M.H || isOpen(nx, ny)) return;
        const cls = INTERIOR.includes(idAt(nx, ny)) ? 1 : 0;
        const h = dy !== 0;
        const line = h ? (dy < 0 ? y : y + 1) : dx < 0 ? x : x + 1;
        const side = h ? dy : dx; // +1: the open cell is above / left, so the pen runs on its last pixel row
        const key = [h ? 'h' : 'v', line, side, r, cls].join('|');
        if (!runs.has(key)) runs.set(key, { h: h, line: line, side: side, r: r, cls: cls, at: [] });
        runs.get(key).at.push(h ? x : y);
      });
    }
  const SEGS = [];
  let seed = 1;
  runs.forEach((k) => {
    k.at.sort((p, q) => p - q);
    let s0 = k.at[0];
    for (let i = 1; i <= k.at.length; i++) {
      if (i < k.at.length && k.at[i] === k.at[i - 1] + 1) continue;
      const e = k.at[i - 1] + 1;
      SEGS.push(mk(k.h, s0 * S, e * S, k.line * S - (k.side > 0 ? 1 : 0), k.r, k.cls, 7000 + seed++));
      s0 = k.at[i];
    }
  });

  // ---------------- the landfill (outdoors: no walls) ----------------
  const P = M.PIT;
  SEGS.push(mk(true, P.x0 * S, P.x1 * S, P.y0 * S, 5, 0, 81), mk(false, P.y0 * S, P.y1 * S, P.x1 * S - 1, 5, 0, 82));
  SEGS.push(mk(true, P.x0 * S, P.x1 * S, P.y1 * S - 1, 5, 0, 83), mk(false, P.y0 * S, P.y1 * S, P.x0 * S, 5, 0, 84));
  let f0 = 99, f1 = 0, fx = 0;
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (idAt(x, y) === WT.fence) { f0 = Math.min(f0, y); f1 = Math.max(f1, y); fx = x; }
  if (f1 >= f0) SEGS.push(mk(false, f0 * S, (f1 + 1) * S, Math.round((fx + 0.5) * S), 5, 1, 85));
  const tracksId = RF.TEX.sandTracks.id;
  let t0 = 99, t1 = 0, ty = 0;
  for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) if (M.floorA[y * M.W + x] === tracksId) { t0 = Math.min(t0, x); t1 = Math.max(t1, x); ty = y; }
  if (t1 >= t0) [0.28, 0.72].forEach((k, i) => SEGS.push(mk(true, t0 * S, (t1 + 1) * S, Math.round((ty + k) * S), 5, 2, 86 + i)));

  // ---------------- pencil order: greedy chain from the way in ----------------
  const ENTRY = [[1, 20.5], [14, 20.5], [23, 20.5], [41, 20.5], [56, 20.5], [75, 16]];
  const ORDER = [], WEIGHT = [];
  for (let r = 0; r <= 5; r++) {
    ORDER.push([]); WEIGHT.push([]);
    let px = ENTRY[r][0] * S, py = ENTRY[r][1] * S;
    for (let cls = 0; cls <= 2; cls++) {
      const pool = SEGS.filter((s) => s.r === r && s.cls === cls), out = [];
      while (pool.length) {
        let best = 0, bestD = 1e9, flip = false;
        pool.forEach((s, i) => {
          const ax = s.h ? s.a : s.q, ay = s.h ? s.q : s.a, bx = s.h ? s.b : s.q, by = s.h ? s.q : s.b;
          const da = Math.abs(ax - px) + Math.abs(ay - py), db = Math.abs(bx - px) + Math.abs(by - py);
          if (da < bestD) { bestD = da; best = i; flip = false; }
          if (db < bestD) { bestD = db; best = i; flip = true; }
        });
        const s = pool.splice(best, 1)[0];
        s.dir = flip ? -1 : 1;
        s.p0 = flip ? s.b : s.a;
        const end = s.p0 + s.n * s.dir;
        px = s.h ? end : s.q; py = s.h ? s.q : end;
        out.push(s);
      }
      ORDER[r].push(out);
      WEIGHT[r].push(out.reduce((sum, s) => sum + s.len * s.speed, 0));
    }
  }

  // ---------------- cells (floors / hatching) and doors ----------------
  const CELLS = [];
  for (let r = 0; r <= LAST_ROOM; r++) CELLS.push([]);
  for (let y = 0; y < M.H; y++)
    for (let x = 0; x < M.W; x++) {
      const r = M.regionOfX(x);
      if (r <= LAST_ROOM && isOpen(x, y)) CELLS[r].push([x, y, r]);
    }
  const PIT_CELLS = [];
  for (let y = P.y0; y < P.y1; y++) for (let x = P.x0; x < P.x1; x++) PIT_CELLS.push([x, y, 5]);
  const DOORS = M.DOORS.map((d) => ({ x: d.x, y: d.y, r: M.regionOfX(d.x), next: M.regionOfX(d.x + 1) === 3 }));

  RF.AUTOMAP_DATA = { S: S, JIT: JIT, ORDER: ORDER, WEIGHT: WEIGHT, CELLS: CELLS, PIT_CELLS: PIT_CELLS, DOORS: DOORS };
})();
