/**
 * C-CAM gag objects of any period (PLAN.md#14.17, quality lab): the Apollo film's gags draw its own
 * modern things (a sandwich, a click pen, a ring-bound checklist, a wristwatch), which a Roman or a
 * lighthouse keeper must not carry. Like `sip`'s `vessel`, each held-object gag takes the object
 * as an option; the default is the film's own object (drawn by gag-props.ts, byte-identical), the
 * others come from the period-neutral vocabulary (props-table.ts, props-paper.ts) or, for the
 * timepieces, from two small marks here. Pure functions of their arguments.
 *
 * Public API: `drawGagFood`, `drawGagPen`, `drawGagSheet`, `drawGagTimepiece`.
 */
import { C, twos } from '../core.js';
import { brushStroke, type BrushEnv } from './brushes.js';
import { checklist, sandwich, ticks, watch } from './gag-props.js';
import type { GAG_FOODS, GAG_PENS, GAG_SHEETS, GAG_TIMEPIECES } from './gags.js';
import type { Paint2D } from './paint.js';
import { blob, ellipseRing, tube } from './shapes.js';
import { drawPaper, paperSchema } from '../vocabulary/props-paper.js';
import { PROPS_TABLE } from '../vocabulary/props-table.js';

type Food = (typeof GAG_FOODS)[number];
type Pen = (typeof GAG_PENS)[number];
type Sheet = (typeof GAG_SHEETS)[number];
type Timepiece = (typeof GAG_TIMEPIECES)[number];

/** The bitten food in the hand's local frame (grip at 0, 0; 40 = one mitten). */
export function drawGagFood(
  g: Paint2D,
  env: BrushEnv,
  food: Food,
  bitten: boolean,
  seed: number,
): void {
  if (food === 'sandwich') {
    sandwich(g, env, 0, -16, -10, seed, bitten);
    return;
  }
  const size = food === 'fruit' ? 0.9 : 0.7;
  const spec = { x: 0, y: -16, kind: food, state: bitten ? 'bitten' : 'whole', rot: -10, size, seed };
  PROPS_TABLE.food.draw(g, env, PROPS_TABLE.food.schema.parse(spec));
}

/**
 * The pen of `penClick` held at the chest (hand-local frame, tip down): the film's click pen, or
 * a quill, stylus, pencil or chalk that taps instead of clicking (a tick at the tip on the beat).
 */
export function drawGagPen(
  g: Paint2D,
  env: BrushEnv,
  pen: Pen,
  click: boolean,
  seed: number,
): void {
  if (pen === 'pen') {
    tube(g, env, [0, 26, 0, -80], [10, 9], C.INK, { lw: 3, seed });
    const top = ellipseRing(0, click ? -80 : -88, 6, 7, 6);
    blob(g, env, top, C.STONE, { lw: 3, seed: seed + 1 });
    if (click) ticks(g, env, 0, -96, 14, 0, seed + 2);
    return;
  }
  const spec = { x: 0, y: click ? 6 : 0, kind: pen, size: 0.9, seed };
  PROPS_TABLE.pen.draw(g, env, PROPS_TABLE.pen.schema.parse(spec));
  if (click) ticks(g, env, 0, 52, 12, 180, seed + 2);
}

/** What `checklist` holds at the chest, centred at (x, y), width w; page = the flip in [0, 1). */
export function drawGagSheet(
  g: Paint2D,
  env: BrushEnv,
  sheet: Sheet,
  at: { readonly x: number; readonly y: number; readonly w: number },
  page: number,
  seed: number,
): void {
  if (sheet === 'checklist') {
    checklist(g, env, at.x, at.y, at.w, page, seed);
    return;
  }
  const state = sheet === 'scroll' ? 'open' : 'shut';
  // A scroll unrolls tall: narrower, so it stays between the hands.
  const w = sheet === 'scroll' ? at.w * 0.7 : at.w;
  const spec = { x: at.x, y: at.y, kind: sheet, state, w, page, seed };
  drawPaper(g, env, paperSchema.parse(spec));
}

/** An hourglass in the palm (hand-local frame): two glass bulbs in a wooden frame, sand on twos. */
function hourglass(g: Paint2D, env: BrushEnv, t: number, seed: number): void {
  const fall = (twos(t) % 4) / 4;
  blob(g, env, [-20, -46, 20, -46, 3, -6, 20, 34, -20, 34, -3, -6], 'rgba(200,205,190,0.35)', {
    lw: 4,
    seed,
  });
  const top = 18 * (1 - fall);
  blob(g, env, [-top * 0.9, -40 + (18 - top), top * 0.9, -40 + (18 - top), 0, -8], C.MUSTARD, {
    lw: 0,
    seed: seed + 1,
  });
  blob(g, env, [-18 * fall - 2, 32, 18 * fall + 2, 32, 0, 32 - 20 * fall], C.MUSTARD, {
    lw: 0,
    seed: seed + 2,
  });
  for (const y of [-50, 38]) tube(g, env, [-28, y, 28, y], [8, 8], C.TIMBER, { lw: 4, seed });
  for (const x of [-26, 26]) {
    brushStroke(g, env, [x, -50, x, 38], { w: 4, seed: seed + 3, taper: false });
  }
}

/**
 * The timepiece `clockCheck` looks at: the film's wristwatch on the wrist (wx, wy), or a pocket
 * watch on its chain / an hourglass in the palm (px, py; hand-local scale k = mitten / 40).
 */
export function drawGagTimepiece(
  g: Paint2D,
  env: BrushEnv,
  piece: Timepiece,
  spots: {
    readonly wrist: readonly [number, number];
    readonly palm: readonly [number, number];
    readonly hsz: number;
  },
  t: number,
  seed: number,
): void {
  if (piece === 'watch') {
    watch(g, env, spots.wrist[0], spots.wrist[1], spots.hsz * 0.24, t, seed);
    return;
  }
  const [x, y] = spots.palm;
  if (piece === 'pocketWatch') {
    const r = spots.hsz * 0.42;
    brushStroke(g, env, [x, y - r, x - r * 0.6, y - r * 2.2, x - r * 1.4, y - r * 1.6], {
      w: 3,
      color: C.MUSTARD_D,
      seed: seed + 4,
      taper: false,
    });
    blob(g, env, ellipseRing(x, y, r * 1.18, r * 1.18, 10), C.MUSTARD, { lw: 5, seed: seed + 5 });
    watch(g, env, x, y, r, t, seed);
    return;
  }
  const k = spots.hsz / 40;
  g.save();
  g.translate(x, y - spots.hsz * 0.6);
  g.scale(k, k);
  hourglass(g, env, t, seed);
  g.restore();
}
