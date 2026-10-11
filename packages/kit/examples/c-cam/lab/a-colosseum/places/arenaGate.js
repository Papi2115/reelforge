// Grim Ink place (kit-ext/places/arenaGate.js): the fighters' gate of the arena seen from the sand.
// A heavy stone arch in the podium wall, an iron grille hanging in it (raised or dropped), a dark
// passage behind with a pale square of daylight at its far end, sand drifted in over the threshold,
// a torch in an iron bracket (the one warm light), chalk tally marks on the jamb, rust streaks.
// Options (opts): grille (0 = raised out of the way, 1 = dropped shut; default 1), torch (default
// true), outside (default false: true = the daylight beyond is brighter, the street end of the
// passage).
// foreground(): the bars of the grille when it is dropped (people outside stand behind them).
const FLOOR = 900;
const ARCH = { x: 1000, w: 640, h: 720 };

export const place = {
  id: 'arenaGate',
  name: 'The fighters gate',
  bounds: [2400, 1300],
  light: { x: 1520, y: 520, rx: 520, ry: 380, color: '#e09a45', alpha: 0.12 },
  anchors: {
    gate: [1000, 900],
    inside: [1000, 760],
    sand: [1300, 960],
    torch: [1520, 360],
    jamb: [700, 520],
  },
  collide: [
    [380, 160, 300, 760],
    [1320, 160, 300, 760],
  ],
  draw(g, ink, t, opts) {
    const o = opts || {};
    wall(ink);
    passage(ink, o);
    grilleTop(ink, o);
    floor(ink);
    if (o.torch !== false) torch(ink, t);
  },
  foreground(g, ink, t, opts) {
    const o = opts || {};
    if (grilleOf(o) < 0.5) return;
    bars(ink, grilleOf(o));
  },
};

const grilleOf = (o) => (o.grille === undefined ? 1 : o.grille);

function wall(ink) {
  const { C } = ink;
  ink.rect(-300, -300, 2700, FLOOR + 320, C.CLAY, {
    lw: 0,
    seed: 1,
    mottle: [C.CLAY_D, 12, 60],
  });
  ink.bricks(-300, -300, 2700, FLOOR + 300, {
    bh: 90,
    bw: 190,
    seed: 2,
    density: 0.2,
    tone: C.CLAY_D,
  });
  ink.stain(140, 200, 300, 200, 3);
  ink.stain(1900, 420, 260, 260, 4, 'rgba(60,30,16,0.3)');
  ink.crack(1780, 120, 220, 5, 1);
  ink.peel(220, 600, 120, 90, 6);
  // Rust streaks under the grille's hinge pins.
  ink.brushStroke([700, 220, 704, 420], {
    w: 10,
    color: 'rgba(120,50,20,0.35)',
    seed: 7,
    taper: true,
  });
  ink.brushStroke([1300, 220, 1296, 460], {
    w: 10,
    color: 'rgba(120,50,20,0.35)',
    seed: 8,
    taper: true,
  });
  // Chalk tally marks on the left jamb: fights won.
  for (let i = 0; i < 4; i += 1) {
    ink.brushStroke([560 + i * 18, 490, 564 + i * 18, 560], {
      w: 4,
      color: C.LINEN,
      seed: 10 + i,
    });
  }
  ink.brushStroke([548, 552, 640, 500], { w: 4, color: C.LINEN, seed: 9 });
}

function passage(ink, o) {
  const { C } = ink;
  const { x, w, h } = ARCH;
  // The dark passage and the daylight at its far end.
  ink.rect(x - w / 2, FLOOR - h, w, h, C.BLACK_D, { lw: 0, seed: 20 });
  const day = o.outside ? '#c9b98c' : '#8f8668';
  ink.rect(x - 90, FLOOR - 330, 180, 250, day, { lw: 5, seed: 21 });
  ink.blob(
    [x - w / 2, FLOOR, x - 90, FLOOR - 80, x + 90, FLOOR - 80, x + w / 2, FLOOR],
    C.STONE_D,
    { lw: 0, seed: 22 },
  );
  // The arch round it.
  ink.props.arch({
    x,
    y: FLOOR,
    w: w + 20,
    h: h + 40,
    thick: 110,
    tone: 'stone',
    wear: 0.7,
    seed: 23,
  });
}

function grilleTop(ink, o) {
  // A raised grille hangs in the top of the arch (only its spikes show).
  const k = grilleOf(o);
  if (k >= 0.5) return;
  const { x, w, h } = ARCH;
  const y = FLOOR - h + 60;
  for (let i = 0; i < 9; i += 1) {
    const bx = x - w / 2 + 50 + i * ((w - 100) / 8);
    ink.beam(bx, FLOOR - h - 20, bx, y + 40, 12, 30 + i, ink.C.RUST_D);
  }
  ink.beam(x - w / 2 + 30, y + 30, x + w / 2 - 30, y + 30, 16, 40, ink.C.RUST_D);
}

function bars(ink, k) {
  const { C } = ink;
  const { x, w, h } = ARCH;
  const bottom = FLOOR - h + (h - 20) * k;
  for (let i = 0; i < 9; i += 1) {
    const bx = x - w / 2 + 50 + i * ((w - 100) / 8);
    ink.beam(bx, FLOOR - h - 20, bx + (i % 3) - 1, bottom, 14, 50 + i, C.RUST_D);
  }
  ink.beam(x - w / 2 + 20, FLOOR - h + 120, x + w / 2 - 20, FLOOR - h + 124, 18, 60, C.RUST_D);
  ink.beam(x - w / 2 + 20, bottom - 140, x + w / 2 - 20, bottom - 136, 18, 61, C.RUST_D);
}

function floor(ink) {
  ink.rect(-300, FLOOR, 2700, 420, '#a88d5a', {
    lw: 0,
    seed: 70,
    mottle: ['#8f7547', 24, 40],
  });
  ink.inkLine([-300, FLOOR, 600, FLOOR + 3, 1400, FLOOR - 2, 2400, FLOOR + 2], {
    seed: 71,
    w: 8,
  });
  // Sand drifted in over the threshold and footprints leading out.
  ink.blob(
    [680, FLOOR, 820, FLOOR - 20, 1180, FLOOR - 22, 1320, FLOOR, 1000, FLOOR + 30],
    '#b49a66',
    { lw: 4, seed: 72 },
  );
  for (let i = 0; i < 7; i += 1) {
    const px = 1500 - i * 80;
    const py = 1100 - i * 30 + (i % 2) * 16;
    ink.blob(ink.ellipseRing(px, py, 18, 9, 7), 'rgba(80,60,30,0.45)', {
      lw: 0,
      seed: 73 + i,
    });
  }
}

function torch(ink, t) {
  const lamp = ink.props.lamp({
    x: 1520,
    y: 400,
    kind: 'torch',
    rot: -10,
    t,
    seed: 90,
  });
  // The iron bracket that holds it to the wall.
  ink.beam(1490, 430, 1560, 470, 10, 91, ink.C.BLACK);
  return lamp;
}
