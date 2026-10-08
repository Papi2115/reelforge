/**
 * The level card's title band (`hud.levelCard`, real run Game B2 2: the `game-b2-level-card`
 * transition swept an EMPTY black band across the frame and the new place only showed as tiny
 * compass text). The incoming shot draws the same ribbed black band across the middle of the frame
 * (42-58 % of its height, as the transition's plate leaves it) and types the new place into it in
 * big letters with its year or chapter under it; the band holds, then sweeps off to the right on
 * the plate's slant. Pure in t: the typewriter times are seeded per card.
 */
import { z } from 'zod';
import type { Bmp } from '../core/bitmap.js';
import { drawText, textWidth, typedCount, typeTimes } from '../core/font.js';
import { EASES, seg } from '../core/rand.js';
import { C, T } from '../palette.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import { time, words } from './hud-schemas.js';

/** The band rows (the transition's 0.42-0.58 of the frame height). */
export const CARD_BAND = { top: Math.round(SCREEN_H * 0.42), bottom: Math.round(SCREEN_H * 0.58) };
const LEAN = 0.12;
const TITLE_SCALE = 3;
const SUB_SCALE = 2;
const SWEEP_S = 0.45;

export const levelCardSchema = z.strictObject({
  place: words(z.string().min(1).max(24)).describe(
    'The new place or chapter, words of the narration',
  ),
  sub: words(z.string().max(24)).default('').describe('Its year or chapter number (optional)'),
  at: time.default(0).describe('The band is up (0: as the level-card transition leaves it)'),
  until: time.optional().describe('The band has swept off (default at + 1.8)'),
});

export interface LevelCard {
  readonly place: string;
  readonly sub: string;
  readonly at: number;
  readonly until: number;
  readonly placeTimes: readonly number[];
  readonly subTimes: readonly number[];
}

export function planLevelCard(
  o: z.output<typeof levelCardSchema>,
  at: number,
  until: number | undefined,
  seed: number,
  fail: (message: string) => never,
): LevelCard {
  const end = until ?? at + 1.8;
  if (end - at < 1.2) fail('levelCard(): the band needs >= 1.2 s (typed, held, swept off)');
  if (textWidth(o.place, TITLE_SCALE) > 560) fail(`levelCard.place: "${o.place}" is too wide`);
  const placeTimes = typeTimes(o.place, seed + 77, at + 0.08, 0.026);
  const subStart = (placeTimes.at(-1) ?? at) + 0.12;
  return {
    place: o.place,
    sub: o.sub,
    at,
    until: end,
    placeTimes,
    subTimes: typeTimes(o.sub, seed + 78, subStart, 0.03),
  };
}

/** Paints the card at t: the ribbed band over the HUD, the typed text, cut away as it sweeps off. */
export function drawLevelCard(b: Bmp, card: LevelCard, t: number): void {
  if (t < card.at || t >= card.until) return;
  const { top, bottom } = CARD_BAND;
  for (let y = top; y < bottom; y += 1)
    b.d.fill((y - top) % 3 === 0 ? C.SHADOW : C.VOID, y * SCREEN_W, (y + 1) * SCREEN_W);
  const placeX = Math.round((SCREEN_W - textWidth(card.place, TITLE_SCALE)) / 2);
  const placeY = top + (card.sub === '' ? 19 : 9);
  drawText(b, card.place, placeX, placeY, C.TUNGSTEN, TITLE_SCALE, {
    count: typedCount(card.placeTimes, t),
    shadow: C.UMBER,
  });
  if (card.sub !== '') {
    const subX = Math.round((SCREEN_W - textWidth(card.sub, SUB_SCALE)) / 2);
    drawText(b, card.sub, subX, top + 37, C.SAND, SUB_SCALE, {
      count: typedCount(card.subTimes, t),
      jitter: 23,
    });
  }
  // The sweep off: the plate's slanted trailing edge uncovers the level from the left.
  const tail = EASES.inOut(seg(t, card.until - SWEEP_S, card.until)) * SCREEN_W * (1 + LEAN);
  if (tail <= 0) return;
  for (let y = top; y < bottom; y += 1) {
    const slant = (SCREEN_H - y) * LEAN;
    const cut = Math.min(SCREEN_W, Math.max(0, Math.ceil(tail - slant)));
    b.d.fill(T, y * SCREEN_W, y * SCREEN_W + cut);
    // The plate's lit lip on the trailing edge.
    if (cut > 0 && cut < SCREEN_W - 2) b.d.fill(C.TAN, y * SCREEN_W + cut, y * SCREEN_W + cut + 2);
  }
}
