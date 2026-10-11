// Grim Ink place (kit-ext/places/arenaSand.js): the arena floor of a Roman amphitheatre at the end
// of a fight. Raked dusty sand with a dragged blood smear and a dropped shield, the stone podium
// wall with its stained blocks and a barred hatch, three tiers of the crowd above it under a torn
// rust awning, and on the right the editor's box: a jutting balcony hung with a plum cloth. The
// one warm light is the afternoon sun falling on the middle of the sand.
// Options (opts): crowd (a crowd reaction: 'cheer', 'wave', 'stand', …; default 'mutter'), t0 (when
// it starts), box (default true: the editor's box), shield (default true: the dropped shield).
// foreground(): the front rail of the editor's box (draw the editor before it, the people on the
// sand after it).
const WALL_TOP = 330;
const SAND = 640;
const BOX = { x0: 1300, x1: 1840, floor: 470 };

export const place = {
  id: 'arenaSand',
  name: 'The arena sand',
  bounds: [2400, 1300],
  light: { x: 900, y: 900, rx: 900, ry: 300, color: '#e3b45a', alpha: 0.1 },
  anchors: {
    centre: [900, 930],
    left: [520, 930],
    right: [1320, 930],
    box: [1560, 470],
    shield: [1500, 900],
  },
  collide: [[1440, 860, 140, 60]],
  draw(g, ink, t, opts) {
    const o = opts || {};
    sky(g, ink);
    stands(g, ink, t, o);
    wall(ink);
    if (o.box !== false) box(ink);
    sand(ink, o);
  },
  foreground(g, ink, t, opts) {
    if ((opts || {}).box === false) return;
    const { C } = ink;
    ink.rect(BOX.x0 - 20, BOX.floor - 70, BOX.x1 - BOX.x0 + 40, 80, C.STONE, {
      lw: 7,
      seed: 90,
      shade: [C.STONE_D, 0, 12],
      hatch: { c: 'rgba(30,26,20,0.4)', n: 6, len: 40, gap: 8, k: 3, ang: 70 },
    });
    ink.props.banner({
      x: BOX.x0 + 60,
      y: BOX.floor - 10,
      w: 420,
      h: 150,
      kind: 'hanging',
      emblem: 'band',
      tone: 'PLUM',
      emblemTone: 'MUSTARD',
      wind: 0.2,
      t,
      seed: 91,
    });
  },
};

function sky(g, ink) {
  const { C } = ink;
  ink.bands(-300, -300, 2700, 120, ['#8d8a72', '#9a9478', '#a39b7c'], 3);
  // The torn rust awning stretched over the top of the stands.
  for (let i = 0; i < 6; i += 1) {
    const x = -300 + i * 480;
    ink.blob(
      [x, -300, x + 470, -300, x + 450, -170 + (i % 2) * 20, x + 240, -120, x + 20, -170],
      i % 2 ? C.RUST : C.RUST_D,
      {
        lw: 6,
        seed: 4 + i,
        shade: [C.RUST_D, 0, 10],
      },
    );
  }
  ink.peel(1180, -200, 120, 70, 11);
}

function stands(g, ink, t, o) {
  const { C } = ink;
  ink.rect(-300, -140, 2700, WALL_TOP + 160, C.STONE_D, { lw: 0, seed: 12 });
  // Three stone tiers with the crowd on them, back row first.
  ink.crowd.rows({
    x0: -260,
    x1: 2460,
    y: WALL_TOP - 10,
    rows: 3,
    density: 0.9,
    s: 0.34,
    shrink: 0.85,
    step: 110,
    tiers: true,
    tierTone: 'STONE',
    reaction: o.crowd || 'mutter',
    mix: 0.8,
    t,
    t0: o.t0 || 0,
    stagger: 0.5,
    palette: 'muted',
    seed: 13,
  });
}

function wall(ink) {
  const { C } = ink;
  // The podium wall: big blocks, stains, a barred hatch, a crack.
  ink.rect(-300, WALL_TOP, 2700, SAND - WALL_TOP + 20, C.CLAY, {
    lw: 7,
    seed: 20,
    shade: [C.CLAY_D, 0, 16],
    mottle: [C.CLAY_D, 10, 60],
  });
  ink.bricks(-300, WALL_TOP + 10, 2700, SAND - WALL_TOP, {
    bh: 70,
    bw: 160,
    seed: 21,
    density: 0.18,
    tone: C.CLAY_D,
  });
  ink.inkLine([-300, WALL_TOP, 600, WALL_TOP - 4, 1500, WALL_TOP + 3, 2400, WALL_TOP], {
    seed: 22,
    w: 8,
  });
  ink.stain(200, 420, 260, 120, 23);
  ink.stain(980, 470, 200, 140, 24, 'rgba(70,20,16,0.3)');
  ink.crack(640, 360, 160, 25);
  ink.crack(2100, 400, 120, 26, 2);
  // A barred hatch low in the wall (where the beasts come from).
  ink.rect(620, 470, 180, 170, C.BLACK_D, { lw: 7, seed: 27 });
  for (let i = 0; i < 5; i += 1)
    ink.beam(640 + i * 36, 474, 642 + i * 36, 636, 8, 28 + i, C.RUST_D);
}

function box(ink) {
  const { C } = ink;
  // The balcony juts out of the wall on two brackets; the editor stands on its floor (anchor box).
  // Behind him: a plum curtain on a rail under a striped awning, two columns.
  ink.rect(BOX.x0, BOX.floor, BOX.x1 - BOX.x0, 40, C.STONE, {
    lw: 7,
    seed: 40,
    shade: [C.STONE_D, 0, 10],
  });
  ink.beam(BOX.x0 + 60, BOX.floor + 40, BOX.x0 + 120, SAND - 20, 30, 41, C.STONE_D);
  ink.beam(BOX.x1 - 60, BOX.floor + 40, BOX.x1 - 120, SAND - 20, 30, 42, C.STONE_D);
  ink.props.banner({
    x: BOX.x0 + 20,
    y: WALL_TOP - 150,
    w: BOX.x1 - BOX.x0 - 40,
    h: BOX.floor - WALL_TOP + 140,
    kind: 'curtain',
    emblem: 'none',
    tone: 'PLUM',
    wind: 0.1,
    seed: 43,
  });
  for (let i = 0; i < 5; i += 1) {
    const x = BOX.x0 - 30 + i * ((BOX.x1 - BOX.x0 + 60) / 5);
    ink.blob(
      [x, WALL_TOP - 220, x + 120, WALL_TOP - 220, x + 110, WALL_TOP - 160, x + 10, WALL_TOP - 160],
      i % 2 ? C.MUSTARD_D : C.LINEN_D,
      { lw: 5, seed: 46 + i },
    );
  }
  ink.props.column({
    x: BOX.x0 + 30,
    y: BOX.floor,
    h: 380,
    w: 50,
    kind: 'round',
    tone: 'stone',
    wear: 0.5,
    seed: 44,
  });
  ink.props.column({
    x: BOX.x1 - 30,
    y: BOX.floor,
    h: 380,
    w: 50,
    kind: 'round',
    tone: 'stone',
    wear: 0.5,
    seed: 45,
  });
}

function sand(ink, o) {
  const { time } = ink;
  ink.rect(-300, SAND, 2700, 700, '#a88d5a', {
    lw: 0,
    seed: 50,
    mottle: ['#8f7547', 18, 90],
  });
  ink.inkLine([-300, SAND, 800, SAND + 4, 1600, SAND - 3, 2400, SAND + 2], {
    seed: 51,
    w: 8,
  });
  // Raked lines and footprints.
  for (let i = 0; i < 14; i += 1) {
    const y = SAND + 40 + i * 44;
    const x = time.rnd(-300, 1800, 52, i);
    ink.brushStroke([x, y, x + 200, y + 3, x + 420, y - 2], {
      w: 3,
      color: 'rgba(80,60,30,0.5)',
      seed: 53 + i,
      taper: true,
    });
  }
  for (let i = 0; i < 8; i += 1) {
    const x = 700 + i * 70;
    const y = 1000 - i * 28 + (i % 2) * 18;
    ink.blob(ink.ellipseRing(x, y, 16, 9, 7), 'rgba(80,60,30,0.45)', {
      lw: 0,
      seed: 70 + i,
    });
  }
  // The dragged blood smear.
  ink.blob(
    [1100, 760, 1300, 740, 1560, 770, 1620, 800, 1380, 800, 1140, 790],
    'rgba(110,30,22,0.55)',
    { lw: 0, seed: 80 },
  );
  if (o.shield !== false) {
    ink.props.weapon({
      x: 1500,
      y: 900,
      kind: 'shield',
      tone: 'GREYBLUE',
      wear: 0.8,
      size: 0.8,
      seed: 81,
    });
  }
}
