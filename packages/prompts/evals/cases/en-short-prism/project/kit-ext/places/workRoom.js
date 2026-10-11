// Grim Ink place (kit-ext/places/workRoom.js): a dim back room with a plastered wall gone grey,
// a crack and a stain, a stone floor and one warm lamp pool over the bench.
const FLOOR = 900;

export const place = {
  id: 'workRoom',
  name: 'The back room',
  bounds: [2400, 1080],
  light: { x: 1180, y: 600, rx: 700, ry: 400, color: '#e0a443', alpha: 0.08 },
  anchors: { bench: [1180, 905], door: [420, 905], shelf: [1900, 905] },
  collide: [[980, 760, 400, 140]],
  draw(g, ink) {
    const { C } = ink;
    ink.rect(-40, -40, 2480, FLOOR + 60, C.PLASTER, {
      lw: 0,
      seed: 1,
      mottle: [C.LINEN_D, 14, 120],
    });
    ink.stain(640, 320, 260, 170, 3);
    ink.crack(1820, 240, 160, 5);
    ink.rect(300, 420, 240, 480, C.TIMBER, { seed: 6, lw: 7, shade: [C.BROWN_D, 0, 10] });
    ink.rect(-40, FLOOR, 2480, 220, C.STONE_D, { lw: 0, seed: 8 });
    ink.inkLine([-40, FLOOR, 800, FLOOR + 4, 1600, FLOOR - 2, 2440, FLOOR + 3], { seed: 9, w: 8 });
    ink.rect(980, 760, 400, 40, C.BROWN, { seed: 10, lw: 7, shade: [C.BROWN_D, 0, 8] });
    ink.beam(1000, 800, 1010, FLOOR, 16, 11, C.TIMBER);
    ink.beam(1360, 800, 1350, FLOOR, 16, 12, C.TIMBER);
  },
};
