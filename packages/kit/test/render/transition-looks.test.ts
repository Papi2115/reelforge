/**
 * Transition kit between looks (PLAN.md#12.15, ADR-011) in the engine harness (SwiftShader): one
 * film walks every ordered pair of the looks voxel, retro-ui, diorama and blueprint (13 shots,
 * an Eulerian circuit of the 12 pairs), each joined by a transition-kit style; frames at p = 0.35
 * and 0.65 of every transition are goldens `transition-look-<from>-<to>-p<35|65>` with the vibe
 * guard (contact sheet: packages/kit/out/contact/transition-looks.png).
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
import { LOOK_SCENES as SCENES, type LookId } from './transition-look-scenes.js';

type TransitionStyleId = keyof typeof TRANSITIONS;

/** Every ordered look pair once: the look of each shot, then the style into the next one. */
const CIRCUIT: readonly (readonly [LookId, TransitionStyleId])[] = [
  ['voxel', 'crt-zoom'],
  ['retro-ui', 'glitch-cut'],
  ['voxel', 'tile-flip'],
  ['diorama', 'dither-dissolve'],
  ['voxel', 'draw-over'],
  ['blueprint', 'crt-zoom'],
  ['retro-ui', 'pixel-sort-melt'],
  ['diorama', 'scanline-sweep'],
  ['retro-ui', 'draw-over'],
  ['blueprint', 'mosaic-reveal'],
  ['diorama', 'tile-flip'],
  ['blueprint', 'pixel-sort-melt'],
];
const LAST_LOOK: LookId = 'voxel';
const SHOT_S = 2;
const PROGRESS = [0.35, 0.65] as const;

interface Join {
  readonly from: LookId;
  readonly to: LookId;
  readonly t0: number;
  readonly style: TransitionStyleId;
}

function joins(): Join[] {
  return CIRCUIT.map(([from, style], index) => ({
    from,
    to: CIRCUIT[index + 1]?.[0] ?? LAST_LOOK,
    t0: (index + 1) * SHOT_S,
    style,
  }));
}

function circuitManifest(): RenderManifest {
  const looks: LookId[] = [...CIRCUIT.map(([look]) => look), LAST_LOOK];
  const words = blueprintManifest('graph').words;
  return {
    version: 1,
    width: 640,
    height: 360,
    fps: 30,
    seed: 2115,
    ...(words === undefined ? {} : { words }),
    shots: looks.map((look, index) => {
      const into = CIRCUIT[index - 1]?.[1];
      const style = into === undefined ? undefined : TRANSITIONS[into];
      return {
        id: `s${String(index).padStart(2, '0')}`,
        t0: index * SHOT_S,
        t1: (index + 1) * SHOT_S,
        scene: SCENES[look],
        ...(style === undefined
          ? {}
          : {
              transitionIn: {
                type: style.type,
                duration: style.duration.default,
                style: style.id,
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

describe('transition kit between looks (SwiftShader)', () => {
  it('walks every look pair in the palette and matches the goldens', async () => {
    const tiles: (RgbaImage & { readonly name: string })[] = [];
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(circuitManifest());
      for (const join of joins()) {
        const { duration } = TRANSITIONS[join.style];
        for (const p of PROGRESS) {
          const data = await page.frameAt(join.t0 + p * duration.default);
          const name = `transition-look-${join.from}-${join.to}-p${String(Math.round(p * 100))}`;
          tiles.push({ width: info.width, height: info.height, data, name });
        }
      }
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
    const dir = path.join(KIT_OUT_DIR, 'contact');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'transition-looks.png'), encodePng(composeSheet(tiles, 4)));
    expect(new Set(tiles.map((tile) => tile.name)).size).toBe(24);
    for (const tile of tiles) {
      expectVibe(tile, tile.name);
      await compareWithGolden(tile.name, tile, undefined, { goldenDir: KIT_GOLDEN_DIR });
    }
  }, 300_000);
});
