/**
 * The accordion strip's pencil construction (docs/worlds/sketchbook-v2 shot 8 traces): the axis
 * ruled panel by panel (it never quite lines up across a crease), hand-ruled year ticks with one
 * pencilled year, and the end word with its arrow. Strip coordinates (u along, v across).
 */
import { textWidth } from '../draw/lettering.js';
import { strokeMark, writeMarks, type Mark, type ToolName } from '../draw/marks.js';
import { rnd } from '../draw/math.js';
import type { StripOptions } from './strip-schema.js';

/** v of the pencil axis across the strip. */
export const AXIS = 96;
/** Marks that were on the strip before the shot. */
export const PRE = { t0: -5, dur: 0.01, held: false, tool: 'pencil' as ToolName, fps: 10 };

/** Pencil construction: the axis ruled panel by panel, year ticks, a year label, the end word. */
export function construction(
  o: StripOptions,
  us: readonly number[],
  creases: readonly number[],
  u1: number,
  seed: number,
): Mark[] {
  const marks: Mark[] = [];
  for (let k = 0; k + 1 < creases.length; k += 1) {
    const a = (creases[k] ?? 0) + 3;
    const z = Math.min((creases[k + 1] ?? 0) - 3, u1 - 26);
    if (z <= a) continue;
    const v = AXIS + rnd(-1.2, 1.2, seed, k, 5);
    const slope = rnd(-0.004, 0.004, seed, k, 6);
    const pts: number[] = [];
    for (let u = a; u < z; u += 9) pts.push(u, v + (u - a) * slope);
    pts.push(z, v + (z - a) * slope);
    marks.push(strokeMark(pts, { ...PRE, smooth: false, boil: 0.5, seed: seed + 71 + k }));
  }
  const years = o.events.map((event) => event.year);
  const first = years[0];
  const last = years.at(-1);
  if (first !== undefined && last !== undefined) {
    const span = last - first;
    const step =
      [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000].find(
        (candidate) => span / candidate <= 24,
      ) ?? 10_000;
    const uOf = (year: number): number => {
      let i = 0;
      while (i < years.length - 2 && year > (years[i + 1] ?? year)) i += 1;
      const [ya, yb] = [years[i] ?? 0, years[i + 1] ?? 1];
      return (us[i] ?? 0) + (((us[i + 1] ?? 0) - (us[i] ?? 0)) * (year - ya)) / (yb - ya);
    };
    let labelled = false;
    for (let year = Math.ceil((first + 1) / step) * step; year < last; year += step) {
      const u = uOf(year) + rnd(-2, 2, seed, year, 7);
      const clear = Math.min(...us.map((eu) => Math.abs(eu - u)));
      if (clear < 16) continue;
      const len = rnd(4, 7, seed, year, 8);
      const lean = rnd(-1.5, 1.5, seed, year, 9);
      marks.push(
        strokeMark([u - lean, AXIS - len, u + lean, AXIS + len], {
          ...PRE,
          smooth: false,
          seed: seed + 900 + (year % 997),
        }),
      );
      if (!labelled && clear > 150 && (year / step) % 5 === 0) {
        labelled = true;
        writeMarks(marks, String(year), {
          ...PRE,
          t1: -4.9,
          x: u - 14,
          y: AXIS + 22,
          size: 13,
          hand: 'scrawl',
          rot: -3,
          seed: seed + 92,
        });
      }
    }
  }
  if (o.end !== undefined) {
    marks.push(
      strokeMark([u1 - 36, AXIS - 6, u1 - 25, AXIS, u1 - 36, AXIS + 6], {
        ...PRE,
        corners: [false, true, false],
        seed: seed + 90,
      }),
    );
    writeMarks(marks, o.end, {
      ...PRE,
      t1: -4.9,
      x: u1 - 64 - textWidth(o.end, 21, 'scrawl'),
      y: AXIS - 14,
      size: 21,
      hand: 'scrawl',
      rot: -4,
      seed: seed + 91,
    });
  }
  return marks;
}
