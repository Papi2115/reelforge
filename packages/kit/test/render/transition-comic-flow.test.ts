/**
 * The flowing panel transitions of the Comic world (docs/worlds/comic-panels-v2 `slide`, `push`,
 * `collapse`; Papi: "the comic transitions feel dry") between real comic pages in the engine
 * harness (SwiftShader): one film of five template scenes joined by `comic-page-slide`,
 * `comic-page-scroll`, `comic-panel-push` and `comic-gutter-collapse`, as in the showcase's story
 * order; frames at p = 0.35 and 0.65 of every transition are goldens `transition-<style>-p<35|65>`
 * with the comic vibe guard, and seeking them again (in reverse) gives the same pixels. Contact
 * sheet: packages/kit/out/contact/transition-comic-flow.png.
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
import { WORLD_TRANSITIONS, type ComicTransitionId } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const STYLE = 'comic';
type Focus = { readonly x: number; readonly y: number };
/** Each shot's scene, the flowing transition into the next one and its focus. */
const FILM: readonly (readonly [string, ComicTransitionId, Focus?])[] = [
  ['examples/comic/a1_hook.js', 'comic-page-slide'],
  ['examples/comic/a2_descent.js', 'comic-page-scroll'],
  ['examples/comic/b2_checklist.js', 'comic-panel-push'],
  ['examples/comic/a3_squeeze.js', 'comic-gutter-collapse', { x: 0.5, y: 0.55 }],
];
const LAST = 'examples/comic/c1_pause.js';
const SHOT_S = 7;
const PROGRESS = [0.35, 0.65] as const;

function film(): RenderManifest {
  const files = [...FILM.map(([file]) => file), LAST];
  return {
    version: 1,
    style: STYLE,
    fps: 30,
    seed: 2116,
    shots: files.map((file, index) => {
      const into = FILM[index - 1];
      const style = into === undefined ? undefined : WORLD_TRANSITIONS[into[1]];
      const focus = into?.[2];
      return {
        id: `f${String(index).padStart(2, '0')}`,
        t0: index * SHOT_S,
        t1: (index + 1) * SHOT_S,
        scene: { file, source: sceneSource(file) },
        ...(style === undefined
          ? {}
          : {
              transitionIn: {
                type: style.type,
                duration: style.duration,
                style: style.id,
                ...(focus === undefined ? {} : { focus }),
              },
            }),
      };
    }),
  };
}

function frameTime(index: number, p: number, id: ComicTransitionId): number {
  return (index + 1) * SHOT_S + p * WORLD_TRANSITIONS[id].duration;
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('comic flowing transitions (SwiftShader)', () => {
  it('slide, slide down, push and gutter collapse between real pages, as the goldens', async () => {
    const tiles: (RgbaImage & { readonly name: string })[] = [];
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(film());
      expect([info.width, info.height]).toEqual([640, 360]);
      const hashes: string[] = [];
      for (const [index, [, id]] of FILM.entries()) {
        for (const p of PROGRESS) {
          const t = frameTime(index, p, id);
          const data = await page.frameAt(t);
          hashes.push(await page.hashAt(t));
          const name = `transition-${id}-p${String(Math.round(p * 100))}`;
          tiles.push({ width: info.width, height: info.height, data, name });
        }
      }
      const again: string[] = [];
      for (const [index, [, id]] of [...FILM.entries()].reverse()) {
        for (const p of [...PROGRESS].reverse())
          again.push(await page.hashAt(frameTime(index, p, id)));
      }
      expect(again.reverse()).toEqual(hashes);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
    const dir = path.join(KIT_OUT_DIR, 'contact');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'transition-comic-flow.png'), encodePng(composeSheet(tiles, 2)));
    expect(new Set(tiles.map((tile) => tile.name)).size).toBe(FILM.length * PROGRESS.length);
    for (const tile of tiles) {
      expectVibe(tile, tile.name, STYLE);
      await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
    }
  }, 600_000);
});
