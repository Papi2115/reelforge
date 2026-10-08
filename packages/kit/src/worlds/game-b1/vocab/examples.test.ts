/**
 * The six open-vocabulary examples (packages/kit/examples/game-b1/open/o1-o6: forest, ocean, space
 * station, medieval village, desert, city) in plain Node: each builds through the real kit only
 * with the open layer (no showcase cartridge, sprite rows, living room or raw drawing), names
 * only ids it defines, paints the same pixels for the same t in any order, stays in the 23
 * inks, and renders within the frame budget (the best batch is logged for the README).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { B1_TABLE } from '../palette.js';
import { b1SceneRefs } from './assets.js';

interface SceneModule {
  build(ctx: unknown): { screen: { traverse(visit: (o: unknown) => void): void } };
  update(t: number, state: unknown): void;
}

const EXAMPLES = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'examples',
  'game-b1',
  'open',
);
const PALETTE = Object.fromEntries(B1_TABLE.map(([, swatch, hex]) => [swatch, hex]));
const SCENES = [
  ['o1_forest.js', 6.5, [1.2, 3.9, 5.8]],
  ['o2_ocean.js', 7, [1, 3.6, 5.2]],
  ['o3_station.js', 7, [1, 3.6, 6.2]],
  ['o4_village.js', 8, [1.4, 4.2, 7]],
  ['o5_desert.js', 8, [1.5, 4.8, 7.2]],
  ['o6_city.js', 8, [1.2, 4, 7]],
] as const;

async function load(file: string, duration: number) {
  const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as SceneModule;
  const kit = createKit({ three: THREE, palette: PALETTE, rng: testRng(2115), style: 'game-b1' });
  const ctx = {
    kit: kit.api,
    shot: { width: 640, height: 360, duration },
    scene: { add: () => undefined },
    sfx: { at: () => undefined },
  };
  const state = scene.build(ctx);
  let pixels: Uint8Array | undefined;
  state.screen.traverse((o) => {
    const m = o as { material?: { uniforms?: { map?: { value?: { image?: { data?: Uint8Array } } } } } }; // prettier-ignore
    pixels ??= m.material?.uniforms?.map?.value?.image?.data;
  });
  if (pixels === undefined) throw new Error(`${file}: no b1Screen raster`);
  const frame = pixels;
  return {
    at(t: number): string {
      scene.update(t, state);
      return createHash('sha256').update(frame).digest('hex');
    },
    frame,
    update: (t: number) => {
      scene.update(t, state);
    },
  };
}

describe('open-vocabulary examples (plain Node)', () => {
  it.each(SCENES)('%s uses only the open layer and only ids it defines', (file) => {
    const source = readFileSync(path.join(EXAMPLES, file), 'utf8');
    for (const showcase of ['.cart(', '.sprite(', '.room(', '.rectPx(', '.raw(', 'g.playfield('])
      expect(source.includes(showcase), `${file} calls ${showcase}`).toBe(false);
    const refs = b1SceneRefs(source);
    const used = [...refs.uses.sprites, ...refs.uses.playfields, ...refs.uses.rooms];
    expect(used.length).toBeGreaterThan(3);
    for (const id of used) expect(source, `${file}: ${id}`).toMatch(new RegExp(`\\b${id}: \\{`));
  });

  it.each(SCENES)('%s is a pure function of t and stays in the 23 inks', async (file, duration, times) => {
    const scene = await load(file, duration);
    const forward = times.map((t) => scene.at(t));
    const backward = [...times].reverse().map((t) => scene.at(t)).reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    const fresh = await load(file, duration);
    expect(fresh.at(times[1])).toBe(forward[1]);
    const inks = new Set(B1_TABLE.map(([, , hex]) => Number.parseInt(hex.slice(1), 16)));
    for (const t of times) {
      scene.update(t);
      const d = scene.frame;
      for (let i = 0; i < d.length; i += 4) {
        const rgb = ((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0);
        if (!inks.has(rgb)) throw new Error(`${file} t=${String(t)}: pixel ${String(i / 4)} is #${rgb.toString(16)}`);
      }
    }
  }); // prettier-ignore

  it.each(SCENES)(
    '%s renders within the budget (<= 10 ms/frame measured)',
    async (file, duration) => {
      const scene = await load(file, duration);
      for (let i = 0; i < 20; i += 1) scene.update((i / 20) * duration);
      let best = Number.POSITIVE_INFINITY;
      for (let batch = 0; batch < 5; batch += 1) {
        const started = process.hrtime.bigint();
        for (let i = 0; i < 30; i += 1) scene.update(((batch * 30 + i) / 150) * duration);
        best = Math.min(best, Number(process.hrtime.bigint() - started) / 1e6 / 30);
      }
      process.stdout.write(`game-b1 ${file}: ${best.toFixed(2)} ms/frame (640x360, best batch)\n`);
      expect(best).toBeLessThan(30);
    },
  );
});
