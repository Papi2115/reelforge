// Grim Ink sample place (kit-ext/places/bakeryBackRoom.js, PLAN.md#14.8): the back room of a
// night bakery. A plastered wall gone grey with flour and soot, a brick oven whose mouth is the one
// warm light, flour sacks slumped in a corner, a scarred work table, a dark window, a stone floor.
// Original, simple; the reference fixture of the places module contract (tests, kit-docs places).
// No imports: draw(g, ink, t) gets the brushes bound to this frame, the palette and time helpers.
const FLOOR = 900;

export const place = {
  id: 'bakeryBackRoom',
  name: 'The bakery back room',
  bounds: [2200, 1080],
  light: { x: 1560, y: 700, rx: 760, ry: 460, color: '#e0a443', alpha: 0.08 },
  anchors: { table: [760, 900], oven: [1500, 910], sacks: [300, 905] },
  collide: [
    [560, 760, 420, 150],
    [1300, 520, 460, 390],
  ],
  draw(g, ink, t) {
    wall(ink);
    floor(ink);
    oven(ink, t);
    sacks(ink);
    table(ink);
  },
};

function wall(ink) {
  const { C } = ink;
  ink.rect(-40, -40, 2280, FLOOR + 60, C.PLASTER, { lw: 0, seed: 1, mottle: [C.LINEN_D, 14, 120] });
  ink.bricks(-40, 640, 2280, FLOOR - 640, { bh: 26, bw: 64, seed: 2, density: 0.14 });
  ink.stain(420, 380, 240, 160, 3);
  ink.stain(1100, 200, 300, 140, 4, 'rgba(40,30,20,0.25)');
  ink.crack(240, 160, 180, 5);
  ink.crack(1960, 420, 140, 6, 2);
  ink.windowPane(980, 330, 180, 220, 7);
}

function floor(ink) {
  const { C } = ink;
  ink.rect(-40, FLOOR, 2280, 220, C.STONE_D, { lw: 0, seed: 8 });
  ink.inkLine([-40, FLOOR, 700, FLOOR + 4, 1500, FLOOR - 2, 2240, FLOOR + 3], { seed: 9, w: 8 });
  for (let i = 0; i < 9; i += 1) {
    const x = ink.time.rnd(0, 2200, 10, i);
    const y = ink.time.rnd(FLOOR + 30, 1060, 11, i);
    ink.blob(ink.ellipseRing(x, y, ink.time.rnd(40, 110, 12, i), 9, 8), C.LINEN, {
      lw: 0,
      seed: 12 + i,
    });
  }
}

function oven(ink, t) {
  const { C, time } = ink;
  // The brick hump with its arched mouth.
  ink.blob(
    [1300, FLOOR, 1300, 620, 1380, 520, 1530, 480, 1680, 520, 1760, 620, 1760, FLOOR],
    C.CLAY,
    {
      lw: 8,
      seed: 20,
      shade: [C.CLAY_D, -30, 0],
      hatch: { c: 'rgba(30,16,8,0.45)', n: 9, len: 50, gap: 9, k: 3, ang: 70 },
    },
  );
  ink.bricks(1310, 560, 440, 330, { bh: 24, bw: 52, seed: 21, density: 0.2, tone: C.RUST_D });
  ink.blob(
    [1420, 860, 1420, 740, 1460, 690, 1530, 676, 1600, 690, 1640, 740, 1640, 860],
    C.BLACK_D,
    { lw: 7, seed: 22 },
  );
  // Embers flicker in held steps (on twos, 0.25 s each).
  const beat = Math.floor(time.twos(t) / 0.25);
  for (let i = 0; i < 7; i += 1) {
    const x = time.rnd(1450, 1610, 23, i);
    const r = time.rnd(10, 26, 24, i, beat);
    ink.blob(ink.ellipseRing(x, 846, r, r * 0.6, 8), i % 2 ? C.FIRE : C.FIRE_D, {
      lw: 0,
      seed: 25 + i,
    });
  }
  // The peel leaning on the oven: a long handle and a flat blade.
  ink.beam(1250, 420, 1340, FLOOR, 12, 30, C.TIMBER);
  ink.blob([1220, 380, 1290, 370, 1296, 440, 1226, 452], C.TIMBER, { lw: 5, seed: 31 });
}

function sacks(ink) {
  const { C } = ink;
  [
    [150, 260, 32],
    [300, 280, 33],
    [230, 200, 34],
  ].forEach(([x, h, seed]) => {
    const pts = [
      x - 90,
      FLOOR,
      x - 100,
      FLOOR - h * 0.7,
      x - 50,
      FLOOR - h,
      x + 50,
      FLOOR - h,
      x + 100,
      FLOOR - h * 0.6,
      x + 90,
      FLOOR,
    ];
    ink.blob(pts, C.LINEN, { lw: 7, seed, shade: [C.LINEN_D, -20, 8], mottle: [C.EYE, 6, 18] });
    ink.brushStroke([x - 40, FLOOR - h + 10, x, FLOOR - h + 26, x + 40, FLOOR - h + 10], {
      w: 5,
      seed: seed + 10,
    });
  });
}

function table(ink) {
  const { C } = ink;
  ink.beam(600, 780, 610, FLOOR, 18, 40, C.TIMBER);
  ink.beam(940, 780, 930, FLOOR, 18, 41, C.TIMBER);
  ink.rect(560, 740, 420, 46, C.BROWN, { seed: 42, lw: 7, shade: [C.BROWN_D, 0, 10] });
  ink.blob(ink.ellipseRing(700, 734, 70, 16, 10), C.LINEN, {
    lw: 4,
    seed: 43,
    shade: [C.LINEN_D, 0, 4],
  });
  ink.brushStroke([820, 744, 900, 748], { w: 4, seed: 44 });
}
