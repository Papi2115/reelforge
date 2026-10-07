/* The dungeon is the story: corridor (1983) -> office -> warehouse -> toy store -> returns -> desert landfill.
   One continuous map; everything time-dependent here is a pure function of the global time t. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, E = RF.ease;
  const MW = 100, MH = 40;
  const W = {}; // wall type table
  const wallTypes = [];
  function wt(name, tex, h, opts) {
    const o = Object.assign({ id: wallTypes.length, name: name, tex: tex, h: h }, opts || {});
    wallTypes.push(o);
    W[name] = o.id;
    return o;
  }
  wt('empty', null, 0);
  wt('auto', null, 1);
  wt('corrTally', 'corrTally', 1);
  wt('door', 'door', 1, { door: true });
  wt('officeCal', 'officeCal', 1);
  wt('officePoster', 'officePoster', 1);
  wt('cubicle', 'cubicle', 0.55, { cap: C.PUTTY });
  wt('whShelf', 'whShelf', 1, { variants: ['whShelf', 'whShelf2', 'whShelf3'] });
  wt('whShelfEnd', 'whShelfEnd', 1);
  wt('whShelfSign', 'whShelfSign', 1);
  wt('toyPacked', 'toyPacked', 1, { variants: ['toyPacked', 'toyPacked2'] });
  wt('counter', 'counter', 0.42, { cap: C.TAN });
  wt('fence', 'fence', 0.6, { transparent: true });
  wt('tape', 'tape', 0.42, { transparent: true });

  // regions: index order is story order
  const REG = [
    { name: 'corridor', x1: 12, wall: 'corrWall', floor: 'concrete', ceil: 'corrCeil', tint: [1.0, 0.9, 0.78], fog: [8, 7, 10], dens: 0.16, amb: 0.02 },
    { name: 'office', x1: 22, wall: 'officeWall', floor: 'carpet', ceil: 'offCeil', tint: [1.1, 0.95, 0.72], fog: [44, 30, 24], dens: 0.05, amb: 0.3 },
    { name: 'warehouse', x1: 40, wall: 'whWall', floor: 'whFloor', ceil: 'whCeil', tint: [0.92, 1.03, 0.94], fog: [16, 32, 26], dens: 0.085, amb: 0.09 },
    { name: 'store', x1: 55, wall: 'toyShelf', floor: 'storeTile', ceil: 'storeCeil', tint: [0.96, 1.05, 0.96], fog: [58, 99, 75], dens: 0.04, amb: 0.42 },
    { name: 'returns', x1: 65, wall: 'retWall', floor: 'retTile', ceil: 'retCeil', tint: [1.0, 0.97, 0.9], fog: [43, 41, 42], dens: 0.07, amb: 0.17 },
    { name: 'desert', x1: 999, wall: 'whWall', floor: 'sand', ceil: null, tint: [0.55, 0.74, 1.45], fog: [26, 37, 70], dens: 0.05, amb: 0.62 },
  ];
  const DAWN = { tint: [1.1, 0.97, 0.86], fog: [206, 178, 146], dens: 0.03, amb: 0.95 };
  REG.forEach((r) => (r.cmap = RF.makeColormap(r.tint, r.fog)));
  DAWN.cmap = RF.makeColormap(DAWN.tint, DAWN.fog);
  const regionOfX = (cx) => { for (let i = 0; i < REG.length; i++) if (cx <= REG[i].x1) return i; return REG.length - 1; };

  // ---------------- grid ----------------
  const wall = new Uint8Array(MW * MH).fill(W.auto);
  const carve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wall[y * MW + x] = W.empty; };
  const set = (x, y, t) => (wall[y * MW + x] = t);
  carve(1, 20, 12, 20); carve(5, 21, 6, 21); // corridor with a dead alcove on the right
  carve(14, 16, 21, 24); // office
  carve(23, 13, 39, 27); // warehouse
  carve(41, 19, 46, 21); carve(47, 19, 50, 20); carve(51, 20, 55, 20); // the aisle narrows
  carve(56, 15, 64, 24); // returns
  carve(66, 0, MW - 1, MH - 1); // desert
  set(9, 19, W.corrTally);
  [13, 22, 40, 65].forEach((x) => set(x, 20, W.door));
  set(18, 15, W.officeCal); set(22, 19, W.officePoster);
  [[15, 18], [15, 22], [16, 22], [17, 22]].forEach(([x, y]) => set(x, y, W.cubicle));
  for (let x = 25; x <= 35; x++) [17, 18, 22, 23].forEach((y) => set(x, y, x === 25 || x === 35 ? W.whShelfEnd : W.whShelf));
  set(25, 22, W.whShelfSign);
  for (let x = 47; x <= 50; x++) set(x, 21, W.toyPacked);
  for (let x = 51; x <= 54; x++) { set(x, 19, W.toyPacked); set(x, 21, W.toyPacked); }
  for (let x = 58; x <= 62; x++) set(x, 18, W.counter);
  for (let y = 12; y <= 28; y++) set(84, y, W.fence);
  const wall2014 = wall.slice();
  for (let x = 75; x <= 81; x++) { wall2014[15 * MW + x] = W.tape; wall2014[25 * MW + x] = W.tape; }

  // floors / ceilings per cell (texture ids), two eras for the desert
  const T = RF.TEX;
  const floorA = new Uint8Array(MW * MH), floorB = new Uint8Array(MW * MH), ceil = new Uint8Array(MW * MH);
  const region = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++)
    for (let x = 0; x < MW; x++) {
      const i = y * MW + x, r = regionOfX(x);
      region[i] = r;
      floorA[i] = floorB[i] = T[REG[r].floor].id;
      ceil[i] = REG[r].ceil ? T[REG[r].ceil].id : 255;
    }
  const setF = (x, y, name, era) => { if (era !== 2) floorA[y * MW + x] = T[name].id; if (era !== 1) floorB[y * MW + x] = T[name].id; };
  const setC = (x, y, name) => (ceil[y * MW + x] = T[name].id);
  setF(11, 20, 'concreteSand');
  for (let x = 23; x <= 39; x++) setF(x, 20, 'whLine');
  for (let x = 66; x <= 74; x++) setF(x, 20, 'sandTracks', 1);
  for (let y = 16; y <= 24; y++) for (let x = 75; x <= 81; x++) { setF(x, y, 'pit', 1); setF(x, y, 'trench', 2); }
  setC(16, 18, 'offLight'); setC(19, 21, 'offLight'); setC(20, 19, 'offLight');
  [27, 35, 38].forEach((x) => setC(x, 20, 'whTube'));
  setC(31, 20, 'whTubeFlicker');
  [43, 47, 51, 54].forEach((x) => setC(x, 20, 'storeTube'));
  setC(60, 19, 'retTubeFlicker');

  // ---------------- doors ----------------
  const DOORS = [
    { x: 13, y: 20, a: 5.9, b: 6.6 },
    { x: 22, y: 20, a: 14.55, b: 15.25 },
    { x: 40, y: 20, a: 30.75, b: 31.45 },
    { x: 65, y: 20, a: 47.25, b: 47.95 },
  ];
  const doorOpen = new Float32Array(MW * MH);

  // ---------------- time-dependent state ----------------
  const flickWh = (t) => {
    const k = Math.floor(t * 14);
    const h = RF.hash3(k, 31, 1);
    return h < 0.07 ? 0.1 : h < 0.11 ? 0.55 : 1;
  };
  const flickRet = (t) => {
    const k = Math.floor(t * 9);
    const burst = RF.hash3(Math.floor(t * 1.3), 60, 2) < 0.4;
    return burst && RF.hash3(k, 60, 3) < 0.45 ? 0.05 : 1;
  };
  const bulbSway = (t) => 0.035 * Math.sin(t * 1.9) + 0.012 * Math.sin(t * 4.3 + 1);
  const ERA_SWAP = 56.85;
  /** The single light clicks on after a beat of darkness (two stutters, uneven). */
  RF.bulbOn = (t) => (t < 0.42 ? 0 : t < 0.5 ? 1 : t < 0.58 ? 0 : t < 0.63 ? 0.6 : t < 0.71 ? 0 : 1);
  RF.FIND = { x: 74.85, y: 20.45 };
  const era = (t) => (t < ERA_SWAP ? 1 : 2);
  /** Store fog thickens as the aisle crowds; snaps clear when you step out. */
  const storeDens = (t) => 0.035 + 0.13 * E.inOut(RF.seg(t, 33.2, 37.6)) - 0.12 * RF.seg(t, 38.7, 39.1);

  function lightsAt(t) {
    const L = [];
    const add = (reg, x, y, z, I, r) => L.push({ reg: reg, x: x, y: y, z: z, I: I, inv: 1 / (r * r) });
    const bulbFlick = RF.bulbOn(t) * (RF.hash3(Math.floor(t * 11), 5, 5) < 0.04 ? 0.7 : 1);
    add(0, 11.0 + bulbSway(t), 20.45, 0.68, 1.7 * bulbFlick, 1.45);
    const d1 = E.inOut(RF.seg(t, DOORS[0].a, DOORS[0].b));
    if (d1 > 0) add(0, 12.7, 20.5, 0.5, 1.2 * d1, 2.0);
    add(1, 16.5, 18.5, 0.95, 0.8, 4.2); add(1, 19.5, 21.5, 0.95, 0.7, 4.2); add(1, 20.5, 19.5, 0.95, 0.6, 3.6); add(1, 20.6, 16.1, 0.5, 0.4, 1.4);
    add(2, 27.5, 20.5, 0.95, 0.95, 3.6); add(2, 31.5, 20.5, 0.95, 0.95 * flickWh(t), 3.6);
    add(2, 35.5, 20.5, 0.95, 0.95, 3.6); add(2, 38.5, 20.5, 0.95, 0.9, 3.4);
    add(3, 43.5, 20.5, 0.95, 0.6, 4.0); add(3, 47.5, 20.0, 0.95, 0.6, 4.0); add(3, 51.5, 20.5, 0.95, 0.55, 4.0);
    add(4, 60.5, 19.5, 0.95, 1.05 * flickRet(t), 4.2); add(4, 61.6, 15.7, 0.6, 0.55, 1.9);
    if (era(t) === 1) { add(5, 84.4, 18.2, 0.32, 1.1, 3.4); add(5, 78.4, 20.2, 0.9, 0.55, 3.6); }
    return L;
  }

  /** Sprites active at t: {spr, x, y, z, w, h}. */
  function spritesAt(t) {
    const S = [];
    const add = (spr, x, y, z, w, h) => S.push({ spr: RF.SPR[spr], x: x, y: y, z: z, w: w, h: h });
    add(RF.bulbOn(t) > 0.5 ? 'bulb' : 'bulbOff', 11.0 + bulbSway(t), 20.45, 0.64, 0.1, 0.4);
    add('sandPile', 11.05, 20.8, 0, 0.5, 0.21);
    const typing = RF.hash3(Math.floor(t * 7), 2, 2) < 0.55 ? 1 : 0;
    add('prog' + typing, 20.6, 16.3, 0, 1.3, 0.98);
    add('cartonFallen', 30.4, 19.45, 0, 0.42, 0.25);
    add('pallet', 38.4, 22.4, 0, 0.9, 0.82);
    add('sale0', 44.2, 19.45, 0.5, 0.4, 0.46);
    add('sale1', 49.2, 19.6, 0.52, 0.4, 0.46);
    add('bargainBin', 45.2, 21.35, 0, 0.95, 0.5);
    add('returnsSign', 58.75, 18.5, 0.64, 0.56, 0.35);
    add(RF.clerkFrame ? RF.clerkFrame(t) : 'clerk0', 60.45, 17.45, 0, 0.56, 0.76);
    // returned stock lands on the desk in two growing piles (uneven beats)
    [[40.5, 'stack0', 60.95, 0], [41.75, 'stack1', 61.4, 0], [42.6, 'stack2', 60.9, 1], [44.15, 'stack1', 61.45, 1], [45.05, 'stack0', 60.98, 2]].forEach(([at, s, x, lvl]) => {
      if (t < at) return;
      const drop = 1 - E.outBack(RF.seg(t, at, at + 0.22));
      add(s, x, 18.45 + (x > 61.3 ? 0.15 : 0), 0.42 + drop * 0.25 + lvl * 0.22, 0.5, 0.39);
    });
    add('exitSign', 64.55, 20.5, 0.8, 0.44, 0.18);
    if (era(t) === 1) {
      add('truckL', 83.3, 18.4, 0, 2.5, 1.33);
      add('pile0', 77.7, 19.3, -0.6, 1.7, 0.62);
      add('pile1', 79.4, 21.9, -0.6, 1.7, 0.62);
      add('pile2', 76.7, 21.0, -0.52, 1.4, 0.5);
    } else {
      add('excavator', 82.6, 17.0, 0, 2.8, 1.84);
      add('tripod', 82.9, 22.5, 0, 0.45, 0.8);
      add('crew', 83.45, 22.85, 0, 0.36, 0.98);
      if (t < RF.GRAB_T) add('dirtCart', RF.FIND.x, RF.FIND.y, -0.02, 0.3, 0.22);
    }
    return S;
  }

  /** Per-frame state handed to the raycaster. */
  RF.worldState = function (t) {
    doorOpen.fill(0);
    DOORS.forEach((d) => (doorOpen[d.y * MW + d.x] = E.inOut(RF.seg(t, d.a, d.b))));
    T.whTubeFlicker.emisLevel = flickWh(t) > 0.5 ? 1.25 : 0;
    T.retTubeFlicker.emisLevel = flickRet(t) > 0.5 ? 1.2 : 0;
    const e = era(t);
    const dens = REG.map((r, i) => (i === 3 ? storeDens(t) : i === 5 && e === 2 ? DAWN.dens : r.dens));
    const amb = REG.map((r, i) => (i === 5 && e === 2 ? DAWN.amb : r.amb));
    const cmaps = REG.map((r, i) => (i === 5 && e === 2 ? DAWN.cmap : r.cmap));
    return {
      t: t, era: e, wall: e === 1 ? wall : wall2014, floor: e === 1 ? floorA : floorB, ceil: ceil, region: region,
      doorOpen: doorOpen, dens: dens, amb: amb, cmaps: cmaps, lights: lightsAt(t), sprites: spritesAt(t),
      fogBoost: RF.fogBoost ? RF.fogBoost(t) : 0,
    };
  };
  const PIT = { x0: 75, y0: 16, x1: 82, y1: 25, depth1: 0.6, depth2: 0.3 };
  RF.MAP = { PIT: PIT, W: MW, H: MH, wall: wall, wall2014: wall2014, wallTypes: wallTypes, WT: W, REG: REG, region: region, floorA: floorA, DOORS: DOORS, regionOfX: regionOfX, ERA_SWAP: ERA_SWAP, era: era };
})();
