/**
 * A rubber stamp on the Comic page (the showcase's marks.js `rubberStamp`): a worn frame and
 * display letters in one ink, with seeded dropouts where the rubber did not touch the paper.
 * Screen space; `k` = scale (a stamp slams in from > 1 to 1).
 */
import type { ComicCanvas } from './canvas.js';
import { bigLetter } from './letters.js';
import { noise2, rnd, rndRange } from './math.js';
import { rotPts } from './shapes.js';

export interface StampDraw {
  readonly text: string;
  readonly cx: number;
  readonly cy: number;
  readonly k: number;
  readonly angle: number;
  readonly ink: number;
  readonly key: string;
  /** Box size at k = 1 (px). */
  readonly w: number;
  readonly h: number;
  /** Letter cell size and pitch at k = 1 (px). */
  readonly size: number;
  readonly pitch: number;
  /** Share of the rubber that did not print (0..0.5). */
  readonly wear: number;
  /** A second, thin frame inside the first. */
  readonly inner: boolean;
}

export function rubberStamp(canvas: ComicCanvas, stamp: StampDraw): void {
  const { cx, cy, k, angle, key } = stamp;
  const w = stamp.w * k;
  const h = stamp.h * k;
  const box = (inset: number) =>
    rotPts(
      [
        ...[cx - w / 2 + inset, cy - h / 2 + inset, cx + w / 2 - inset, cy - h / 2 + inset],
        ...[cx + w / 2 - inset, cy + h / 2 - inset, cx - w / 2 + inset, cy + h / 2 - inset],
      ],
      cx,
      cy,
      angle,
    );
  const thin = (x: number, y: number) => noise2(`${key}ink`, x, y, 3) < stamp.wear;
  const worn = (x: number, y: number) =>
    thin(x, y) || rnd(`${key}dot`, (x * 7 + y * 13) % 997) < 0.08 ? -1 : stamp.ink;
  canvas.polyline(box(0), worn, Math.max(2, Math.round(2 * k)), true);
  if (stamp.inner) canvas.polyline(box(4 * k), worn, 1, true);
  const pitch = stamp.pitch * k;
  const chars = Array.from(stamp.text);
  chars.forEach((char, i) => {
    const off = (i - (chars.length - 1) / 2) * pitch;
    const tilt = angle + rndRange(key, 30 + i, -0.04, 0.04);
    bigLetter(
      canvas,
      char,
      cx + Math.cos(angle) * off,
      cy + Math.sin(angle) * off,
      stamp.size * k,
      tilt,
      worn,
      { key: `${key}${String(i)}`, outline: 0, extrude: [0, 0], mis: [0, 0], block: false },
    );
  });
}
