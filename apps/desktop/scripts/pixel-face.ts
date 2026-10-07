/**
 * `pnpm --filter @reelforge/desktop pixel-face` (PLAN.md#13.12, U13): rebuilds the app's pixel
 * title face, src/renderer/fonts/reelforge-pixel.ttf, from the engine's CC0 display font
 * (ADR-005, docs/licenses.md). The file is checked in; a unit test fails when it no longer matches
 * the engine's glyphs, so run this after changing packages/engine/src/text/font-display.ts.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DISPLAY_FONT } from '@reelforge/engine';
import { notdefGlyph, pixelFaceGlyphs } from './pixel-face-glyphs.js';
import { writeTrueType } from './pixel-face-ttf.js';

export const PIXEL_FACE_FAMILY = 'ReelForge Pixel';
export const PIXEL_FACE_FILE = path.join('src', 'renderer', 'fonts', 'reelforge-pixel.ttf');

/** The face's bytes: a pure function of the engine's display font. */
export function buildPixelFace(): Uint8Array {
  return writeTrueType(
    notdefGlyph(DISPLAY_FONT),
    pixelFaceGlyphs(DISPLAY_FONT),
    {
      ascentPixels: DISPLAY_FONT.ascent + DISPLAY_FONT.capHeight,
      descentPixels: DISPLAY_FONT.descent,
      capHeightPixels: DISPLAY_FONT.capHeight,
    },
    {
      family: PIXEL_FACE_FAMILY,
      postScript: 'ReelForgePixel-Regular',
      version: '1.000',
      copyright:
        'Forge Display glyphs by the ReelForge contributors, dedicated to the public domain.',
      license: 'CC0 1.0 Universal (public domain dedication).',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
  );
}

export async function run(context: { readonly appRoot: string }): Promise<void> {
  const file = path.join(context.appRoot, PIXEL_FACE_FILE);
  const bytes = buildPixelFace();
  await writeFile(file, bytes);
  process.stdout.write(`pixel face: ${file} (${String(bytes.length)} bytes)\n`);
}
