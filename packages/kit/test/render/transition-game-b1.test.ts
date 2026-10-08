/**
 * Game-native transitions of the Game B1 world (PLAN.md#13.5 part b) between real game-b1 shots
 * in the engine harness (SwiftShader): one film of nine template scenes (looks A, B, C) joined by
 * the eight `game-b1-*` styles (into the calendar, attract mode, cartridge in, room shake,
 * cartridge out, the page sliding in, the page turn, the scanline redraw); two frames of every
 * transition (where it shows itself: the roll and the garbage, the collapse and the power-on, ...)
 * are goldens `transition-<style>-p<n>` with the game-b1 vibe guard, and seeking them again in
 * reverse gives the same pixels. Contact sheet: packages/kit/out/contact/transition-game-b1.png.
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
import { WORLD_TRANSITIONS, type GameB1TransitionId } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import {
  KIT_GOLDEN_DIR,
  KIT_OUT_DIR,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const STYLE = 'game-b1';
/** Each shot's scene and the game-native transition into the next one. */
const FILM: readonly (readonly [string, GameB1TransitionId])[] = [
  ['examples/game-b1/a2_xmas.js', 'game-b1-calendar-zoom'],
  ['examples/game-b1/a3_deadline.js', 'game-b1-attract-cycle'],
  ['examples/game-b1/b1_scores.js', 'game-b1-cartridge-in'],
  ['examples/game-b1/b2_market.js', 'game-b1-room-shake'],
  ['examples/game-b1/c1_flood.js', 'game-b1-cartridge-out'],
  ['examples/game-b1/c2_landfill.js', 'game-b1-page-slide'],
  ['examples/game-b1/b3_manual.js', 'game-b1-page-turn'],
  ['examples/game-b1/b6_level_select.js', 'game-b1-scanline-wipe'],
];
const LAST = 'examples/game-b1/c3_continue.js';
const SHOT_S = 6;
const PROGRESS = [0.35, 0.65] as const;
/** Where each one shows itself (the ones that cover the whole frame midway: coming and going). */
const PROGRESS_OF: Partial<Record<GameB1TransitionId, readonly number[]>> = {
  'game-b1-calendar-zoom': [0.35, 0.75],
  'game-b1-attract-cycle': [0.25, 0.7],
  'game-b1-cartridge-in': [0.15, 0.5],
  'game-b1-room-shake': [0.2, 0.7],
  'game-b1-cartridge-out': [0.4, 0.8],
};
/** The wall calendar in the Christmas room (the zoom's anchor). */
const FOCUS: Partial<Record<GameB1TransitionId, { x: number; y: number }>> = {
  'game-b1-calendar-zoom': { x: 0.57, y: 0.26 },
};

function progressOf(id: GameB1TransitionId): readonly number[] {
  return PROGRESS_OF[id] ?? PROGRESS;
}

function film(): RenderManifest {
  const files = [...FILM.map(([file]) => file), LAST];
  return {
    version: 1,
    style: STYLE,
    fps: 30,
    seed: 1982,
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
          : {
              transitionIn: {
                type: style.type,
                duration: style.duration,
                style: style.id,
                ...(FOCUS[style.id as GameB1TransitionId] === undefined
                  ? {}
                  : { focus: FOCUS[style.id as GameB1TransitionId] }),
              },
            }),
      };
    }),
  };
}

function frameTime(index: number, p: number, id: GameB1TransitionId): number {
  return (index + 1) * SHOT_S + p * WORLD_TRANSITIONS[id].duration;
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('game-b1 game-native transitions (SwiftShader)', () => {
  it('calendar zoom, attract, cartridge in / out, shake, page slide / turn, scanlines between shots', async () => {
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
    await writeFile(path.join(dir, 'transition-game-b1.png'), encodePng(composeSheet(tiles, 2)));
    expect(new Set(tiles.map((tile) => tile.name)).size).toBe(FILM.length * PROGRESS.length);
    for (const tile of tiles) {
      expectVibe(tile, tile.name, STYLE);
      await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
    }
  }, 600_000);
});
