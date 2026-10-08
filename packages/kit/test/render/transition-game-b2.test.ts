/**
 * Game-native transitions of the Game B2 world (PLAN.md#13.4) between real game-b2 shots in the
 * engine harness (SwiftShader): one film of eight template scenes (looks A, B, C) joined by the
 * seven `game-b2-*` styles (lights out, the map unfolding out of the minimap and folding back into
 * the next one, the screen melt, the door, the fog bank, the level card); frames at p = 0.35 and
 * 0.65 of every transition (0.2 / 0.25 and 0.8 for the ones that cover the whole frame midway)
 * are goldens `transition-<style>-p<n>` with the game-b2 vibe guard,
 * and seeking them again in reverse gives the same pixels. Contact sheet:
 * packages/kit/out/contact/transition-game-b2.png.
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
import { WORLD_TRANSITIONS, type GameB2TransitionId } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const STYLE = 'game-b2';
/** Each shot's scene and the game-native transition into the next one. */
const FILM: readonly (readonly [string, GameB2TransitionId])[] = [
  ['examples/game-b2/a1_corridor.js', 'game-b2-darkness'],
  ['examples/game-b2/a2_warehouse.js', 'game-b2-map-unfold'],
  ['examples/game-b2/b2_automap.js', 'game-b2-map-fold'],
  ['examples/game-b2/a4_throw.js', 'game-b2-melt'],
  ['examples/game-b2/b4_tally.js', 'game-b2-door'],
  ['examples/game-b2/c1_clone_aisle.js', 'game-b2-fog'],
  ['examples/game-b2/c2_throw_note.js', 'game-b2-level-card'],
];
const LAST = 'examples/game-b2/a3_returns.js';
const SHOT_S = 6;
const PROGRESS = [0.35, 0.65] as const;
/** These cover the whole frame in the middle: show them coming and going instead. */
const PROGRESS_OF: Partial<Record<GameB2TransitionId, readonly number[]>> = {
  'game-b2-darkness': [0.25, 0.8],
  'game-b2-fog': [0.2, 0.8],
  'game-b2-level-card': [0.2, 0.8],
};

function progressOf(id: GameB2TransitionId): readonly number[] {
  return PROGRESS_OF[id] ?? PROGRESS;
}

function film(): RenderManifest {
  const files = [...FILM.map(([file]) => file), LAST];
  return {
    version: 1,
    style: STYLE,
    fps: 30,
    seed: 1983,
    shots: files.map((file, index) => {
      const into = FILM[index - 1]?.[1];
      const style = into === undefined ? undefined : WORLD_TRANSITIONS[into];
      return {
        id: `g${String(index).padStart(2, '0')}`,
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

function frameTime(index: number, p: number, id: GameB2TransitionId): number {
  return (index + 1) * SHOT_S + p * WORLD_TRANSITIONS[id].duration;
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('game-b2 game-native transitions (SwiftShader)', () => {
  it('darkness, map unfold / fold, melt, door, fog and level card between real shots', async () => {
    const tiles: (RgbaImage & { readonly name: string })[] = [];
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(film());
      expect([info.width, info.height]).toEqual([640, 360]);
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
    await writeFile(path.join(dir, 'transition-game-b2.png'), encodePng(composeSheet(tiles, 2)));
    expect(new Set(tiles.map((tile) => tile.name)).size).toBe(FILM.length * PROGRESS.length);
    for (const tile of tiles) {
      expectVibe(tile, tile.name, STYLE);
      await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
    }
  }, 600_000);
});
