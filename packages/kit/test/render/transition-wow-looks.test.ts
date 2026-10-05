/**
 * Wow transitions between real looks (ADR-028) in the engine harness (SwiftShader): one film of
 * seven shots joins voxel, retro-ui, blueprint and diorama shots with six wow styles, each with a
 * focus on its subject; frames at p = 0.35 and 0.65 of every transition are goldens
 * `transition-wow-look-<style>-p<35|65>` with the vibe guard (contact sheet:
 * packages/kit/out/contact/transition-wow-looks.png).
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
import { TRANSITIONS } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, type RenderManifest } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';
import { blueprintManifest } from './look-blueprint-scenes.js';
import { LOOK_SCENES, type LookId } from './transition-look-scenes.js';

interface Join {
  readonly style: keyof typeof TRANSITIONS;
  /** Subject point (0..1 of the frame) the transition enters, breaks at or dives into. */
  readonly focus?: { readonly x: number; readonly y: number };
}

/** The look of each shot and the wow transition into the next one. */
const FILM: readonly (readonly [LookId, Join])[] = [
  ['voxel', { style: 'enter-lens', focus: { x: 0.47, y: 0.42 } }],
  ['retro-ui', { style: 'shatter', focus: { x: 0.3, y: 0.45 } }],
  ['blueprint', { style: 'paper-roll' }],
  ['diorama', { style: 'enter-keyhole', focus: { x: 0.35, y: 0.4 } }],
  ['voxel', { style: 'dive-out', focus: { x: 0.55, y: 0.5 } }],
  ['diorama', { style: 'cube-smash', focus: { x: 0.5, y: 0.45 } }],
];
const LAST_LOOK: LookId = 'voxel';
const SHOT_S = 3;
const PROGRESS = [0.35, 0.65] as const;

function wowFilm(): RenderManifest {
  const looks: LookId[] = [...FILM.map(([look]) => look), LAST_LOOK];
  const words = blueprintManifest('graph').words;
  return {
    version: 1,
    width: 640,
    height: 360,
    fps: 30,
    seed: 2115,
    ...(words === undefined ? {} : { words }),
    shots: looks.map((look, index) => {
      const into = FILM[index - 1]?.[1];
      const style = into === undefined ? undefined : TRANSITIONS[into.style];
      return {
        id: `w${String(index).padStart(2, '0')}`,
        t0: index * SHOT_S,
        t1: (index + 1) * SHOT_S,
        scene: LOOK_SCENES[look],
        ...(style === undefined || into === undefined
          ? {}
          : {
              transitionIn: {
                type: style.type,
                duration: style.duration.default,
                style: style.id,
                ...(into.focus === undefined ? {} : { focus: into.focus }),
              },
            }),
      };
    }),
  };
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('wow transitions between looks (SwiftShader)', () => {
  it('enters, breaks and dives between real looks in the palette, as the goldens', async () => {
    const tiles: (RgbaImage & { readonly name: string })[] = [];
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(wowFilm());
      for (const [index, [, join]] of FILM.entries()) {
        const { duration } = TRANSITIONS[join.style];
        for (const p of PROGRESS) {
          const data = await page.frameAt((index + 1) * SHOT_S + p * duration.default);
          const name = `transition-wow-look-${join.style}-p${String(Math.round(p * 100))}`;
          tiles.push({ width: info.width, height: info.height, data, name });
        }
      }
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
    const dir = path.join(KIT_OUT_DIR, 'contact');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'transition-wow-looks.png'), encodePng(composeSheet(tiles, 4)));
    expect(new Set(tiles.map((tile) => tile.name)).size).toBe(12);
    for (const tile of tiles) {
      expectVibe(tile, tile.name);
      await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
    }
  }, 300_000);
});
