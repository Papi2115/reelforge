/**
 * Marks that appear by themselves, without the hand (labels, numbers, small words while the hand
 * draws the key thing): never stroke by stroke (ink that writes itself reads as a glitch), but
 * as an ink bloom (the ink soaks in, a small wave across a small word, all at once over a big
 * one), a quick pop-in, or a typewriter-from-nothing (letters popping in one by one).
 * Deterministic; the marks keep their shapes, boil and roughness.
 */
import type { AppearKind, Mark } from './marks.js';

/** Bloom: each mark soaks in over BLOOM s, the wave crosses the task in WAVE s. */
const BLOOM = 0.22;
const WAVE = 0.14;
/** Typewriter: one mark every TYPE_STEP s, the whole task in at most TYPE_MAX s. */
const TYPE_STEP = 0.045;
const TYPE_MAX = 0.6;
/**
 * A bloom's wave crosses only small text: over a task this tall (page px) or taller, a wave from
 * the first letter to the last reads as the word writing itself, so it soaks in all at once.
 */
export const BLOOM_WAVE_MAX_HEIGHT = 48;

/** Vertical extent of the marks' points (page px). */
function heightOf(marks: readonly Mark[]): number {
  let [top, bottom] = [Infinity, -Infinity];
  for (const mark of marks) {
    const pts = mark.type === 'stroke' ? mark.shape.pts : mark.poly;
    for (let i = 1; i < pts.length; i += 2) {
      const y = pts[i] ?? 0;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return bottom > top ? bottom - top : 0;
}

/**
 * The task's marks appearing from `at` (in drawing order), held by no hand. `wave` false = a
 * bloom soaks in everywhere at once: a word that lost the hand must not arrive letter by letter
 * in writing order (that reads as ink writing itself).
 */
export function appearMarks(
  marks: readonly Mark[],
  kind: AppearKind,
  at: number,
  wave = true,
): Mark[] {
  const order = [...marks].sort((a, b) => a.t0 - b.t0);
  const sweep = wave && (kind !== 'bloom' || heightOf(order) < BLOOM_WAVE_MAX_HEIGHT);
  const n = Math.max(1, order.length - 1);
  const span = Math.min(TYPE_MAX, TYPE_STEP * order.length);
  const timing = new Map<Mark, { t0: number; dur: number }>();
  order.forEach((mark, index) => {
    const k = sweep ? index / n : 0;
    if (kind === 'bloom') timing.set(mark, { t0: at + WAVE * k, dur: BLOOM });
    else if (kind === 'type') timing.set(mark, { t0: at + span * k, dur: 0 });
    else timing.set(mark, { t0: at, dur: 0 });
  });
  return marks.map((mark) => {
    const time = timing.get(mark) ?? { t0: at, dur: 0 };
    return { ...mark, ...time, held: false, reveal: kind === 'bloom' ? 'bloom' : 'pop' };
  });
}

/** When appearing marks are all in (s). */
export function appearEnd(kind: AppearKind, at: number, count: number): number {
  if (kind === 'bloom') return at + WAVE + BLOOM;
  if (kind === 'type') return at + Math.min(TYPE_MAX, TYPE_STEP * count);
  return at;
}
