/**
 * Fixtures of the anti-slop guard tests (PLAN.md#13.7): the approved Sketchbook showcase film
 * (docs/worlds/sketchbook-v2: narration of its ten shots and the facts of its research notes), the
 * kit's Sketchbook template scenes and goldens, and painters of deliberately bad frames.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, type RgbaImage } from '@reelforge/engine/raster';

/** The showcase's narration (docs/worlds/sketchbook-v2/js/timeline.js, all ten shots). */
export const SHOWCASE_NARRATION = [
  'A year has 365 days.',
  "Except it doesn't. Not quite.",
  'Earth takes about 365 and a quarter days to go round the Sun.',
  'Count only 365, and the dates drift off the seasons.',
  "A quarter day a year: in 4 years, that's almost one whole day.",
  'So: add one day every fourth year. The leap day.',
  'In 45 BC, Julius Caesar made it law.',
  'Close. But a little too much.',
  'A calendar makes a promise: same date, same season.',
  "Caesar's calendar slowly drifted away from the seasons.",
  'Year after year, the spring equinox crept earlier.',
  'Too slow for anyone to notice.',
  "Caesar's year was too long by about 11 minutes.",
  'From 325 to 1582, that added up to ten whole days.',
  '45 BC. Then more than sixteen centuries of drift.',
  '1582: the fix. 1752: Britain finally follows.',
  'In 1582, Pope Gregory XIII cut ten days: October 4th, then October 15th.',
  'Britain waited until 1752, and lost eleven days.',
  'The fix: century years skip the leap day, unless they divide by 400.',
  "1900, no. 2000, yes. That's why there is a February 29.",
].join(' ');

/** The showcase's research notes ("Facts on screen", docs/worlds/sketchbook-v2/NOTES.md). */
export const SHOWCASE_RESEARCH =
  'On screen: 365.2422-day year; Julian calendar 45 BC +1 day every 4th year; equinox ~21 March ' +
  '(325), ~11 March by 1582 (interpolated +-1 in the flipbook); 1582: 4 Oct then 15 Oct; Britain ' +
  '1752: 2 Sep then 14 Sep (3-13 struck, 11 days); rule /4, /100, /400 (1900 no, 2000 yes).';

const KIT = fileURLToPath(new URL('../../../kit/', import.meta.url));
const EXAMPLES = path.join(KIT, 'examples', 'sketchbook');
const GOLDENS = path.join(KIT, 'test', 'goldens', 'swiftshader');

/** The kit's Sketchbook template scenes (looks A/B/C, pop-up, strip): file name -> source. */
export function sketchbookExamples(): Map<string, string> {
  const files = readdirSync(EXAMPLES).filter((name) => name.endsWith('.js'));
  return new Map(files.map((name) => [name, readFileSync(path.join(EXAMPLES, name), 'utf8')]));
}

/** Golden frames whose file name matches. */
export function goldenFrames(match: RegExp): Map<string, RgbaImage> {
  const files = readdirSync(GOLDENS).filter((name) => match.test(name));
  return new Map(files.map((name) => [name, decodePng(readFileSync(path.join(GOLDENS, name)))]));
}

export type Rgb = readonly [number, number, number];

/** Notebook paper and inks of the Sketchbook world (kit inks.ts). */
export const PAPER: Rgb = [0xf4, 0xee, 0xdb];
export const INK: Rgb = [0x1d, 0x1b, 0x20];
export const RED: Rgb = [0xd8, 0x34, 0x2b];

export function blankFrame(width: number, height: number, color: Rgb): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([color[0], color[1], color[2], 255], offset);
  }
  return { width, height, data };
}

export function copyFrame(image: RgbaImage): RgbaImage {
  return { width: image.width, height: image.height, data: Uint8Array.from(image.data) };
}

/** Paints a filled rectangle (clipped to the frame). */
export function paintRect(
  image: RgbaImage,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Rgb,
): RgbaImage {
  for (let row = Math.max(0, y); row < Math.min(image.height, y + h); row += 1) {
    for (let column = Math.max(0, x); column < Math.min(image.width, x + w); column += 1) {
      image.data.set([color[0], color[1], color[2], 255], (row * image.width + column) * 4);
    }
  }
  return image;
}

/** Paints a filled disc. */
export function paintDisc(image: RgbaImage, cx: number, cy: number, r: number, color: Rgb) {
  for (let row = Math.max(0, cy - r); row <= Math.min(image.height - 1, cy + r); row += 1) {
    for (
      let column = Math.max(0, cx - r);
      column <= Math.min(image.width - 1, cx + r);
      column += 1
    ) {
      if ((column - cx) ** 2 + (row - cy) ** 2 <= r * r) {
        image.data.set([color[0], color[1], color[2], 255], (row * image.width + column) * 4);
      }
    }
  }
  return image;
}

/** The left half mirrored onto the right half (a perfectly symmetric frame). */
export function mirrorLeftHalf(image: RgbaImage): RgbaImage {
  const out = copyFrame(image);
  for (let row = 0; row < image.height; row += 1) {
    for (let column = 0; column < image.width / 2; column += 1) {
      const from = (row * image.width + column) * 4;
      const to = (row * image.width + (image.width - 1 - column)) * 4;
      out.data.set(image.data.subarray(from, from + 4), to);
    }
  }
  return out;
}

/** The frame moved `dx` pixels right (the gap filled with the first column). */
export function shiftRight(image: RgbaImage, dx: number): RgbaImage {
  const out = copyFrame(image);
  for (let row = 0; row < image.height; row += 1) {
    for (let column = 0; column < image.width; column += 1) {
      const source = (row * image.width + Math.max(0, column - dx)) * 4;
      out.data.set(image.data.subarray(source, source + 4), (row * image.width + column) * 4);
    }
  }
  return out;
}
