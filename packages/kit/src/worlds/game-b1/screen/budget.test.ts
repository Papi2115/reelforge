/**
 * Frame budget of the part-b template scenes (looks B and C, the calendar zoom and the cartridge
 * pull of look A) in plain Node: every scene builds through the real kit with its sound cues, and
 * the best batch of 30 frames (after a warm-up that builds the manual's printed page once) is
 * logged; the ceiling is generous for slow CI runners, the measured number goes in the README.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { B1_TABLE } from '../palette.js';
import { SCREEN_H, SCREEN_W } from './model.js';

interface SceneModule {
  build(ctx: unknown): unknown;
  update(t: number, state: unknown): void;
}

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'game-b1');
const PALETTE = Object.fromEntries(B1_TABLE.map(([, swatch, hex]) => [swatch, hex]));

describe('frame budget (part b template scenes, plain Node)', () => {
  it.each([
    ['a4_calendar_zoom.js', 6.5],
    ['a5_cartridge_pull.js', 3.2],
    ['b1_scores.js', 7.5],
    ['b2_market.js', 7.5],
    ['b3_manual.js', 8.5],
    ['b4_scores_moon.js', 7],
    ['b5_manual_pyramid.js', 8],
    ['b6_level_select.js', 3.6],
    ['c1_flood.js', 8],
    ['c2_landfill.js', 9],
    ['c3_continue.js', 4.75],
  ])('%s renders within the budget (<= 10 ms/frame measured)', async (file, duration) => {
    const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as SceneModule;
    const kit = createKit({ three: THREE, palette: PALETTE, rng: testRng(2115), style: 'game-b1' });
    const cues: number[] = [];
    const ctx = {
      kit: kit.api,
      shot: { width: SCREEN_W, height: SCREEN_H, duration },
      scene: { add: () => undefined },
      sfx: { at: (t: number) => cues.push(t) },
    };
    const state = scene.build(ctx);
    for (let i = 0; i < 20; i += 1) scene.update((i / 20) * duration, state);
    const batches = 5;
    const frames = 30;
    let best = Number.POSITIVE_INFINITY;
    for (let batch = 0; batch < batches; batch += 1) {
      const started = process.hrtime.bigint();
      for (let i = 0; i < frames; i += 1)
        scene.update(((batch * frames + i) / (batches * frames)) * duration, state);
      best = Math.min(best, Number(process.hrtime.bigint() - started) / 1e6 / frames);
    }
    process.stdout.write(`game-b1 ${file}: ${best.toFixed(2)} ms/frame (640x360, best batch)\n`);
    expect(best).toBeLessThan(30);
    expect(cues.every((t) => t >= -1 && t <= duration + 1)).toBe(true);
  });
});
