import type { TimedWord } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from '../anchors.js';
import type { SceneModule } from '../contract.js';
import { buildShot, type ShotInput } from '../shot.js';
import { resolveStyle } from '../style.js';
import {
  CAPTION_HOLD_S,
  captionGroupAt,
  captionGroups,
  captionScale,
  drawCaptions,
  spokenWordIndex,
} from './captions.js';
import { createTextSurface, hexToRgb8 } from './surface.js';

const WORDS: TimedWord[] = [
  { text: 'Bridges', t: 10.1, tEnd: 10.5 },
  { text: 'can', t: 10.5, tEnd: 10.7 },
  { text: 'sing', t: 10.7, tEnd: 11.0 },
  { text: 'loudly.', t: 11.0, tEnd: 11.4 },
  { text: 'Why?', t: 11.5, tEnd: 11.8 },
  { text: 'Nobody', t: 13.0, tEnd: 13.4 },
  { text: 'knew', t: 13.4, tEnd: 13.7 },
  { text: 'later', t: 14.2, tEnd: 14.5 },
];

const COLORS = {
  fill: [240, 240, 240],
  highlight: [250, 200, 40],
  shadow: [10, 10, 20],
} as const;

function count(pixels: Uint8Array, color: readonly number[]): number {
  let total = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (
      pixels[offset + 3] === 255 &&
      pixels[offset] === color[0] &&
      pixels[offset + 1] === color[1] &&
      pixels[offset + 2] === color[2]
    ) {
      total += 1;
    }
  }
  return total;
}

function inkRows(pixels: Uint8Array, width: number): { top: number; bottom: number } {
  let top = Infinity;
  let bottom = -Infinity;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] !== 255) continue;
    const y = Math.floor(offset / 4 / width);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { top, bottom };
}

describe('captionGroups', () => {
  it('groups at most 3 words, breaks at sentence ends and pauses, inside the window', () => {
    const groups = captionGroups(WORDS, { t0: 10, t1: 14 });
    expect(groups.map((group) => group.words.map((word) => word.text))).toEqual([
      ['Bridges', 'can', 'sing'],
      ['loudly.'],
      ['Why?'],
      ['Nobody', 'knew'],
    ]);
    // A group ends where the next starts, or CAPTION_HOLD_S after its last word, or at the shot end.
    expect(groups.map((group) => [group.t0, group.t1])).toEqual([
      [10.1, 11.0],
      [11.0, 11.5],
      [11.5, 11.8 + CAPTION_HOLD_S],
      [13.0, 14],
    ]);
    expect(captionGroups(WORDS, { t0: 13.5, t1: 13.6 })).toEqual([]);
    expect(captionGroups(WORDS, { t0: 13, t1: 13.5 }).at(-1)?.t1).toBe(13.5);
  });

  it('finds the group and the spoken word at a time', () => {
    const groups = captionGroups(WORDS, { t0: 10, t1: 15 });
    const first = captionGroupAt(groups, 10.6);
    expect(first?.words[0]?.text).toBe('Bridges');
    expect(first === undefined ? -1 : spokenWordIndex(first, 10.6)).toBe(1);
    expect(captionGroupAt(groups, 12.5)).toBeUndefined();
    expect(captionGroupAt(groups, 10.0)).toBeUndefined();
  });
});

describe('drawCaptions', () => {
  it('draws the group big, the spoken word highlighted, inside the portrait safe band', () => {
    const surface = createTextSurface(360, 640);
    const groups = captionGroups(WORDS, { t0: 10, t1: 15 });
    drawCaptions(surface, groups, 10.6, COLORS);
    expect(surface.empty).toBe(false);
    expect(count(surface.pixels, COLORS.highlight)).toBeGreaterThan(50);
    expect(count(surface.pixels, COLORS.fill)).toBeGreaterThan(
      count(surface.pixels, COLORS.highlight),
    );
    const rows = inkRows(surface.pixels, 360);
    expect(rows.top).toBeGreaterThan(640 * 0.12);
    expect(rows.bottom).toBeLessThan(640 * 0.8);
    expect(captionScale({ width: 360, height: 640 })).toBe(4);
    expect(captionScale({ width: 640, height: 360 })).toBe(3);
  });

  it('draws nothing between groups and the same pixels for the same time', () => {
    const groups = captionGroups(WORDS, { t0: 10, t1: 15 });
    const gap = createTextSurface(360, 640);
    drawCaptions(gap, groups, 12.5, COLORS);
    expect(gap.empty).toBe(true);
    const first = createTextSurface(640, 360);
    const second = createTextSurface(640, 360);
    drawCaptions(first, groups, 13.45, COLORS);
    drawCaptions(second, groups, 13.45, COLORS);
    expect(first.pixels).toEqual(second.pixels);
  });
});

describe('captions in a shot', () => {
  const palette = resolveStyle({}).palette;
  const module: SceneModule = { meta: { id: 's02' }, build: () => ({}), update: () => undefined };
  const input = (captions?: readonly TimedWord[]): ShotInput => ({
    shot: { id: 's02', t0: 10, duration: 4, width: 360, height: 640, fps: 30 },
    module,
    projectSeed: 5,
    palette,
    resolveAnchor: NO_ANCHORS,
    captions,
  });

  it('draws the shot words over the frame only when captions are on', () => {
    const plain = buildShot(input());
    plain.update(0.6);
    expect(plain.overlay.empty).toBe(true);
    const captioned = buildShot(input(WORDS));
    captioned.update(0.6);
    expect(captioned.overlay.empty).toBe(false);
    expect(count(captioned.overlay.pixels, hexToRgb8(palette.accent1))).toBeGreaterThan(0);
    // Captions are not text cards (no card QA on them).
    expect(captioned.cards()).toEqual([]);
    // The video clock wins over the (possibly slowed) scene clock.
    captioned.update(0.6, { captionTime: 12.5 });
    expect(captioned.overlay.empty).toBe(true);
  });
});
