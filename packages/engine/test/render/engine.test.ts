import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findStylePreset, STYLE_PRESET_IDS } from '../../src/index.js';
import { computeFrameStats } from '../../src/cli/frame-stats.js';
import { compareWithGolden } from '../../src/cli/goldens.js';
import {
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../src/cli/harness-session.js';
import {
  helloManifest,
  manifest,
  TRANSITION_CASES,
  transitionsManifest,
} from '../support/manifests.js';

const SAMPLE_TIMES = [0, 1.234, 2.5, 4.9];

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

async function withPage<T>(run: (page: HarnessPage) => Promise<T>): Promise<T> {
  const page = await browser.open();
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}

/** Throws on the first pixel that is not a colour of the style's palette. */
function expectPaletteOnly(frame: Uint8Array, styleId: string): void {
  const palette = findStylePreset(styleId)?.palette ?? {};
  const allowed = new Set(Object.values(palette).map((hex) => Number.parseInt(hex.slice(1), 16)));
  expect(allowed.size).toBeGreaterThan(1);
  for (let offset = 0; offset < frame.length; offset += 4) {
    const key =
      ((frame[offset] ?? 0) << 16) | ((frame[offset + 1] ?? 0) << 8) | (frame[offset + 2] ?? 0);
    if (!allowed.has(key))
      throw new Error(`non-palette colour #${key.toString(16)} at byte ${String(offset)}`);
  }
}

describe('engine harness in a sandboxed iframe (SwiftShader)', () => {
  it('loads the example scene and renders a non-blank, palette-only frame', async () => {
    await withPage(async (page) => {
      const info = await page.load(helloManifest());
      expect(info).toMatchObject({
        duration: 5,
        style: 'voxel-pixel-crisp640',
        width: 640,
        height: 360,
        fps: 30,
      });
      expect(info.cues).toEqual([{ t: 1, name: 'pop', shotId: 's00' }]);
      expect(info.anchors).toEqual([
        { shotId: 's00', phrase: 'hello world', nth: 1, t: 1, tEnd: 1.6 },
      ]);
      expect(await page.checkCards('s00')).toEqual([]);
      expect(info.gpu.renderer).toMatch(/SwiftShader/);

      const frame = await page.frameAt(2.5);
      expect(frame.length).toBe(640 * 360 * 4);
      const stats = computeFrameStats(frame);
      expect(stats.uniqueColors).toBeGreaterThanOrEqual(6);
      expect(stats.dominantColorShare).toBeLessThan(0.6);
      expectPaletteOnly(frame, 'voxel-pixel-crisp640');
      expect(page.errors).toEqual([]);
    });
  });

  it('renders the same frame for the same t, in any seek order', async () => {
    await withPage(async (page) => {
      await page.load(helloManifest());
      const forward = [];
      for (const t of SAMPLE_TIMES) forward.push(await page.hashAt(t));
      const backward = [];
      for (const t of [...SAMPLE_TIMES].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      expect(await page.hashAt(2.5)).toBe(await page.hashAt(2.5));
      expect(new Set(forward).size).toBe(SAMPLE_TIMES.length);
    });
  });

  it('renders identical frames after two fresh loads, and different ones for another seed', async () => {
    const hashes = async (seed?: number): Promise<string[]> =>
      withPage(async (page) => {
        await page.load(helloManifest(seed));
        const result = [];
        for (const t of SAMPLE_TIMES) result.push(await page.hashAt(t));
        return result;
      });
    const first = await hashes();
    expect(await hashes()).toEqual(first);
    expect(await hashes(7)).not.toEqual(first);
  });

  it('keeps transition midpoints stable and actually blends both shots', async () => {
    const midpointHashes = async (): Promise<string[]> =>
      withPage(async (page) => {
        await page.load(transitionsManifest());
        const result = [];
        for (const { midpoint } of TRANSITION_CASES) {
          const start = await page.hashAt(midpoint - 0.5);
          const end = await page.hashAt(midpoint + 0.5);
          const middle = await page.hashAt(midpoint);
          expect(middle).not.toBe(start);
          expect(middle).not.toBe(end);
          expect(await page.hashAt(midpoint)).toBe(middle);
          result.push(middle);
        }
        return result;
      });
    expect(await midpointHashes()).toEqual(await midpointHashes());
  });

  it('matches the SwiftShader goldens', async () => {
    await withPage(async (page) => {
      await page.load(transitionsManifest());
      const frames = [
        { name: 'hello-t2.5', t: 2.5 },
        ...TRANSITION_CASES.map(({ type, midpoint }) => ({ name: `${type}-mid`, t: midpoint })),
      ];
      for (const { name, t } of frames) {
        const data = await page.frameAt(t);
        await compareWithGolden(name, { width: 640, height: 360, data });
      }
    });
  });
});

describe('style presets (post-fx) on the example scene', () => {
  it.each(STYLE_PRESET_IDS)(
    '%s: palette-only, non-blank, stable and matching its golden',
    async (styleId) => {
      await withPage(async (page) => {
        const info = await page.load(helloManifest(undefined, styleId));
        const size = findStylePreset(styleId)?.resolution ?? { width: 0, height: 0 };
        expect(info).toMatchObject({ style: styleId, ...size });
        const data = await page.frameAt(2.5);
        expect(data.length).toBe(size.width * size.height * 4);
        expectPaletteOnly(data, styleId);
        const stats = computeFrameStats(data);
        expect(stats.uniqueColors).toBeGreaterThanOrEqual(6);
        expect(stats.dominantColorShare).toBeLessThan(0.6);
        expect(await page.hashAt(2.5)).toBe(await page.hashAt(2.5));
        await compareWithGolden(`style-${styleId}-t2.5`, { ...size, data });
        expect(page.errors).toEqual([]);
      });
    },
  );

  it('rejects an unknown style and a size that contradicts the style', async () => {
    await withPage(async (page) => {
      await expect(page.load(helloManifest(undefined, 'vaporwave'))).rejects.toThrow(
        /style "vaporwave" is unknown; available: voxel-pixel-crisp640, noir-voxel, soft-480/,
      );
      await expect(page.load({ ...helloManifest(), style: 'soft-480' })).rejects.toThrow(
        /do not match style "soft-480"/,
      );
    });
  });
});

describe('scene isolation and errors', () => {
  const probeSource = `
export const meta = { id: 'probe' };
export function build(ctx) {
  let parent = 'open';
  try { void window.parent.document.body; } catch { parent = 'blocked'; }
  let evaluation = 'allowed';
  try { (0, eval)('1'); } catch { evaluation = 'blocked'; }
  ctx.sfx.at(0, 'parent:' + parent);
  ctx.sfx.at(0, 'eval:' + evaluation);
  ctx.sfx.at(0, 'node:' + typeof process + '/' + typeof require);
  ctx.sfx.at(0, 'origin:' + self.origin);
  return null;
}
export function update() {}
`;

  it('runs scenes in an opaque origin without parent, eval or Node access', async () => {
    await withPage(async (page) => {
      const info = await page.load(
        manifest([
          { id: 'probe', t0: 0, t1: 1, scene: { file: 'scenes/probe.js', source: probeSource } },
        ]),
      );
      expect(info.cues.map((cue) => cue.name)).toEqual([
        'parent:blocked',
        'eval:blocked',
        'node:undefined/undefined',
        'origin:null',
      ]);
    });
  });

  it('rejects broken scenes with actionable messages and recovers on the next load', async () => {
    await withPage(async (page) => {
      const broken = (source: string): ReturnType<typeof manifest> =>
        manifest([{ id: 'bad', t0: 0, t1: 1, scene: { file: 'scenes/bad.js', source } }]);
      await expect(page.load(broken("export const meta = { id: 'bad' };"))).rejects.toThrow(
        /\[shot bad\] scenes\/bad\.js: missing "export function build\(ctx\)"/,
      );
      await expect(page.load(broken("import * as THREE from 'three';"))).rejects.toThrow(
        /scenes\/bad\.js failed to load: .*must not import/,
      );
      await expect(
        page.load(
          broken(
            "export const meta = { id: 'bad' }; export function build(ctx) { ctx.anchor('nope'); } export function update() {}",
          ),
        ),
      ).rejects.toThrow(/anchor\("nope", 1\) is not spoken/);
      await expect(page.frameAt(0)).rejects.toThrow(/seek\(\) before a successful load\(\)/);
      const info = await page.load(helloManifest());
      expect(info.duration).toBe(5);
      expect(await page.frameAt(1)).toHaveLength(640 * 360 * 4);
    });
  });
});
