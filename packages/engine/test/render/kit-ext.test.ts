/**
 * Project-local props (PLAN.md#7.4): a hand-written `kit-ext/props/fridge.js` loads in the
 * sandboxed engine before the scenes, is callable as `ctx.kit.props.fridge()` and renders a
 * non-blank, deterministic turntable; broken prop modules are rejected with clear errors.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { KitExtensionSource, RenderManifest } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeFrameStats } from '../../src/cli/frame-stats.js';
import {
  launchHarnessBrowser,
  sha256,
  type HarnessBrowser,
} from '../../src/cli/harness-session.js';
import { manifest } from '../support/manifests.js';

const FRIDGE: KitExtensionSource = {
  name: 'fridge',
  file: 'kit-ext/props/fridge.js',
  source: readFileSync(
    path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'kit-ext', 'fridge.js'),
    'utf8',
  ),
};

/** Fridge on a plate, a quarter turn per second, door opening in the last second. */
const TURNTABLE = {
  file: 'scenes/turntable.js',
  source: `export const meta = { id: 'tt', title: 'Fridge turntable', treatment: 'metaphor-object' };
export function build(ctx) {
  const { kit, scene, three, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights());
  const plate = kit.voxel.mesh(kit.voxel.box([24, 1, 24], 'groundAlt'), { voxelSize: 0.1 });
  const fridge = kit.props.fridge({ body: 'heroTrim' }).on(plate);
  scene.add(plate);
  return { plate, fridge };
}
export function update(t, s, ctx) {
  s.plate.rotation.y = (Math.floor(t) * Math.PI) / 2;
  s.fridge.open(Math.max(0, t - 4));
  ctx.camera.set({ position: [0, 1.6, 4.2], target: [0, 0.9, 0] });
}
`,
};

function fridgeManifest(extensions: KitExtensionSource[] = [FRIDGE]): RenderManifest {
  return {
    ...manifest([{ id: 'tt', t0: 0, t1: 5, scene: TURNTABLE }]),
    kitExtensions: extensions,
  };
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('project props in the sandboxed engine', () => {
  it('renders a non-blank, deterministic turntable of a kit-ext prop', async () => {
    const page = await browser.open({ lint: true });
    try {
      await expect(page.load(fridgeManifest())).resolves.toMatchObject({ duration: 5 });
      const hashes: string[] = [];
      for (const t of [0.5, 1.5, 2.5, 3.5, 4.9]) {
        const frame = await page.frameAt(t);
        const stats = computeFrameStats(frame);
        expect(stats.dominantColorShare, `t=${String(t)}`).toBeLessThan(0.9);
        hashes.push(sha256(frame));
      }
      expect(new Set(hashes).size).toBe(5);
      expect(await page.hashAt(0.5)).toBe(hashes[0]);
      expect(await page.hashAt(4.9)).toBe(hashes[4]);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
    const again = await browser.open();
    try {
      await again.load(fridgeManifest());
      expect(await again.hashAt(1.5)).toBe(await again.hashAt(1.5));
    } finally {
      await again.close();
    }
  });

  it('rejects prop modules that fail the prop lint, the contract or shadow a kit prop', async () => {
    const page = await browser.open({ lint: true });
    try {
      const random = {
        ...FRIDGE,
        source: FRIDGE.source.replace('const s = 1 / 22;', 'const s = Math.random();'),
      };
      await expect(page.load(fridgeManifest([random]))).rejects.toThrow(
        /\[kit-ext:fridge\]\nkit-ext\/props\/fridge\.js:\d+:\d+ {2}error {2}no-random/,
      );
    } finally {
      await page.close();
    }
    const unchecked = await browser.open();
    try {
      const renamed = { ...FRIDGE, name: 'cooler', file: 'kit-ext/props/cooler.js' };
      await expect(unchecked.load(fridgeManifest([renamed]))).rejects.toThrow(
        /kit-ext\/props\/cooler\.js: prop\.name is "fridge" but the file registers kit\.props\.cooler/,
      );
      const shadow = {
        name: 'calculator',
        file: 'kit-ext/props/calculator.js',
        source: FRIDGE.source.replace("name: 'fridge'", "name: 'calculator'"),
      };
      await expect(unchecked.load(fridgeManifest([shadow]))).rejects.toThrow(
        /kit-ext prop "calculator" has the name of a kit prop/,
      );
    } finally {
      await unchecked.close();
    }
  });
});
