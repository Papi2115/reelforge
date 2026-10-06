/**
 * Page-native transitions of the Sketchbook world (PLAN.md#13.6) between real sketchbook pages in
 * the engine harness (SwiftShader): one film of six template scenes (looks A, B, C) joined by the
 * five `sketchbook-*` styles; frames at p = 0.35 and 0.65 of every transition (the riffle: 0.2
 * and 0.5) are goldens
 * `transition-<style>-p<35|65>` (style = sketchbook-...) with the sketchbook vibe guard, and seeking them twice
 * (in reverse) gives the same pixels. Contact sheet: packages/kit/out/contact/transition-sketchbook.png.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { WORLD_TRANSITIONS, type SketchbookTransitionId } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const STYLE = 'sketchbook';
/** Each shot's scene and the page-native transition into the next one. */
const FILM: readonly (readonly [string, SketchbookTransitionId])[] = [
  ['examples/sketchbook/a1_quarter.js', 'sketchbook-page-flip'],
  ['examples/sketchbook/b1_maths.js', 'sketchbook-crumple-toss'],
  ['examples/sketchbook/c1_hook.js', 'sketchbook-tape-peel'],
  ['examples/sketchbook/b2_envelope.js', 'sketchbook-riffle'],
  ['examples/sketchbook/a2_caesar.js', 'sketchbook-torn-strip'],
];
const LAST = 'examples/sketchbook/b3_rule.js';
const SHOT_S = 6;
const PROGRESS = [0.35, 0.65] as const;
/** The riffle's middle frames are blank over blank: show its first flip and a blank one. */
const PROGRESS_OF: Partial<Record<SketchbookTransitionId, readonly number[]>> = {
  'sketchbook-riffle': [0.2, 0.5],
};

function progressOf(id: SketchbookTransitionId): readonly number[] {
  return PROGRESS_OF[id] ?? PROGRESS;
}

function film(): RenderManifest {
  const files = [...FILM.map(([file]) => file), LAST];
  return {
    version: 1,
    style: STYLE,
    fps: 30,
    seed: 2115,
    shots: files.map((file, index) => {
      const into = FILM[index - 1]?.[1];
      const style = into === undefined ? undefined : WORLD_TRANSITIONS[into];
      return {
        id: `p${String(index).padStart(2, '0')}`,
        t0: index * SHOT_S,
        t1: (index + 1) * SHOT_S,
        scene: { file, source: sceneSource(file) },
        ...(style === undefined
          ? {}
          : { transitionIn: { type: style.type, duration: style.duration, style: style.id } }),
      };
    }),
  };
}

function frameTime(index: number, p: number, id: SketchbookTransitionId): number {
  return (index + 1) * SHOT_S + p * WORLD_TRANSITIONS[id].duration;
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('sketchbook page-native transitions (SwiftShader)', () => {
  it('flip, crumple, peel, riffle and tear between real pages, in the palette, as the goldens', async () => {
    const tiles: (RgbaImage & { readonly name: string })[] = [];
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(film());
      expect([info.width, info.height]).toEqual([960, 540]);
      const hashes: string[] = [];
      for (const [index, [, id]] of FILM.entries()) {
        for (const p of progressOf(id)) {
          const t = frameTime(index, p, id);
          const data = await page.frameAt(t);
          hashes.push(await page.hashAt(t));
          const name = `transition-${id}-p${String(Math.round(p * 100))}`;
          tiles.push({ width: info.width, height: info.height, data, name });
        }
      }
      const again: string[] = [];
      for (const [index, [, id]] of [...FILM.entries()].reverse()) {
        for (const p of [...progressOf(id)].reverse())
          again.push(await page.hashAt(frameTime(index, p, id)));
      }
      expect(again.reverse()).toEqual(hashes);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
    const dir = path.join(KIT_OUT_DIR, 'contact');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'transition-sketchbook.png'), encodePng(composeSheet(tiles, 2)));
    expect(new Set(tiles.map((tile) => tile.name)).size).toBe(FILM.length * PROGRESS.length);
    for (const tile of tiles) {
      expectVibe(tile, tile.name, STYLE);
      await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
    }
  }, 600_000);
});
