/**
 * The gameplay examples (packages/kit/examples/game-b1/play/p1-p4: a level, the inventory, the
 * shop, the split timer; PLAN.md#13.15 B1 rework) in plain Node: each builds through the real kit
 * from its own vocabulary, paints the same pixels for the same t in any order, changes over its
 * beats and stays in the 23 inks.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { B1_TABLE } from '../palette.js';

interface SceneModule {
  build(ctx: unknown): { screen: { traverse(visit: (o: unknown) => void): void } };
  update(t: number, state: unknown): void;
}

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'game-b1', 'play'); // prettier-ignore
const PALETTE = Object.fromEntries(B1_TABLE.map(([, swatch, hex]) => [swatch, hex]));
export const PLAY_SCENES = [
  ['p1_level.js', 6, [0.5, 1.95, 2.8, 4.9]],
  ['p2_inventory.js', 6, [0.2, 1.5, 3.2, 4.3]],
  ['p3_shop.js', 6.5, [0.3, 2.1, 2.9, 3.8]],
  ['p4_splits.js', 6, [0.25, 1.9, 2.7, 4.3]],
] as const;

export async function loadPlayScene(file: string, duration: number) {
  const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as SceneModule;
  const kit = createKit({ three: THREE, palette: PALETTE, rng: testRng(2115), style: 'game-b1' });
  const cues: { t: number; name: string }[] = [];
  const ctx = {
    kit: kit.api,
    shot: { width: 640, height: 360, duration },
    scene: { add: () => undefined },
    sfx: { at: (t: number, name: string) => cues.push({ t, name }) },
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
    cues,
    frame,
    at(t: number): string {
      scene.update(t, state);
      return createHash('sha256').update(frame).digest('hex');
    },
  };
}

describe('gameplay examples (plain Node)', () => {
  it.each(PLAY_SCENES)('%s is a pure function of t, changes on its beats, stays in the inks', async (file, duration, times) => {
    const scene = await loadPlayScene(file, duration);
    expect(scene.cues.length).toBeGreaterThan(2);
    const forward = times.map((t) => scene.at(t));
    const backward = [...times].reverse().map((t) => scene.at(t)).reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    const fresh = await loadPlayScene(file, duration);
    expect(fresh.at(times[2])).toBe(forward[2]);
    const inks = new Set(B1_TABLE.map(([, , hex]) => Number.parseInt(hex.slice(1), 16)));
    for (const t of times) {
      scene.at(t);
      const d = scene.frame;
      for (let i = 0; i < d.length; i += 4) {
        const rgb = ((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0);
        if (!inks.has(rgb)) throw new Error(`${file} t=${String(t)}: pixel ${String(i / 4)} is #${rgb.toString(16)}`);
      }
    }
  }); // prettier-ignore
});
