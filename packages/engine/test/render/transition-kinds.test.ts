/**
 * Transition kit (PLAN.md#12.15, ADR-011) in the engine harness (SwiftShader): every style at
 * p = 0.5 between two synthetic shots (stripes -> hello) as goldens `transition-kind-<style>`,
 * each palette-only (vibe guard) and byte-equal to `compositeTransition` of the two shots' own
 * frames, i.e. the engine composites exactly the pure function. Plain transitions (no style)
 * keep their goldens in engine.test.ts.
 */
import {
  TRANSITION_STYLE_IDS,
  TRANSITION_STYLES,
  type ManifestShot,
  type RenderManifest,
  type TransitionStyleId,
} from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareWithGolden } from '../../src/cli/goldens.js';
import {
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../src/cli/harness-session.js';
import {
  compositeTransition,
  paletteNumbers,
  resolveStyle,
  shotSeed,
  vibeGuard,
} from '../../src/index.js';
import { HELLO_SCENE, manifest, STRIPES_SCENE } from '../support/manifests.js';

const WIDTH = 640;
const HEIGHT = 360;
const DURATION = 0.5;
const CUT_AT = 3;
/** Midpoint of the transition: p = 0.5. */
const MID = CUT_AT + DURATION / 2;
const STYLE = resolveStyle({ style: 'voxel-pixel-crisp640' });

function shots(transitionIn: ManifestShot['transitionIn'] | 'none'): ManifestShot[] {
  if (transitionIn === 'none') return [{ id: 'a', t0: 0, t1: 6, scene: STRIPES_SCENE }];
  return [
    { id: 'a', t0: 0, t1: CUT_AT, scene: STRIPES_SCENE },
    { id: 'b', t0: CUT_AT, t1: 6, transitionIn, scene: HELLO_SCENE },
  ];
}

function styledManifest(style: TransitionStyleId): RenderManifest {
  const { type } = TRANSITION_STYLES[style];
  return manifest(shots({ type, duration: DURATION, style }));
}

function expectVibe(data: Uint8Array, label: string): void {
  expect(vibeGuard({ width: WIDTH, height: HEIGHT, data }, STYLE).issues, label).toEqual([]);
}

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

async function frameOf(input: RenderManifest, t: number): Promise<Uint8Array> {
  return withPage(async (page) => {
    await page.load(input);
    return new Uint8Array(await page.frameAt(t));
  });
}

describe('transition kit in the engine (SwiftShader)', () => {
  it('composites every style from the two post-fx frames, in the palette, as the goldens', async () => {
    // A = the outgoing shot alone at MID (its overhang), B = the incoming shot after a cut.
    const frameA = await frameOf(manifest(shots('none')), MID);
    const frameB = await frameOf(manifest(shots({ type: 'cut' })), MID);
    const seed = shotSeed(manifest([]).seed, 'transition:b');
    const params = { palette: paletteNumbers(STYLE.swatches) };
    await withPage(async (page) => {
      for (const style of TRANSITION_STYLE_IDS) {
        await page.load(styledManifest(style));
        const data = new Uint8Array(await page.frameAt(MID));
        const expected = compositeTransition(
          style,
          params,
          { width: WIDTH, height: HEIGHT, data: frameA },
          { width: WIDTH, height: HEIGHT, data: frameB },
          (MID - CUT_AT) / DURATION,
          seed,
        );
        expect(Buffer.from(data).equals(Buffer.from(expected)), style).toBe(true);
        expectVibe(data, style);
        await compareWithGolden(`transition-kind-${style}`, { width: WIDTH, height: HEIGHT, data });
      }
      expect(page.errors).toEqual([]);
    });
  });

  it('renders the same transition frame whatever was seeked before', async () => {
    await withPage(async (page) => {
      await page.load(styledManifest('tile-flip'));
      const times = [CUT_AT + 0.1, CUT_AT + 0.3, CUT_AT + 0.45];
      const forward = [];
      for (const t of times) forward.push(await page.hashAt(t));
      await page.hashAt(5);
      const backward = [];
      for (const t of [...times].reverse()) backward.push(await page.hashAt(t));
      expect(backward.reverse()).toEqual(forward);
      expect(new Set(forward).size).toBe(times.length);
    });
  });

  it('shows the shots exactly as after a cut outside the transition', async () => {
    for (const t of [CUT_AT - 0.5, CUT_AT + DURATION, CUT_AT + 1]) {
      const styled = await frameOf(styledManifest('crt-zoom'), t);
      const cut = await frameOf(manifest(shots({ type: 'cut' })), t);
      expect(Buffer.from(styled).equals(Buffer.from(cut)), `t=${String(t)}`).toBe(true);
    }
  });
});
