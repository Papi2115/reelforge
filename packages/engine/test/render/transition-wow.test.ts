/**
 * Wow transitions (ADR-028) in the engine harness (SwiftShader): every wow style at p = 0.35 and
 * 0.65 between two synthetic shots (stripes -> hello; focus styles enter / break / dive at a
 * point off the centre) as goldens `transition-wow-<style>-p<35|65>`, each palette-only (vibe
 * guard) and byte-equal to `compositeTransition` of the two shots' own frames with the
 * storyboard's focus: the engine composites exactly the pure function, focus included.
 */
import {
  TRANSITION_STYLES,
  WOW_STYLE_IDS,
  type ManifestShot,
  type RenderManifest,
  type TransitionFocus,
  type WowStyleId,
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
const CUT_AT = 3;
const PROGRESS = [0.35, 0.65] as const;
const FOCUS: TransitionFocus = { x: 0.4, y: 0.42 };
const STYLE = resolveStyle({ style: 'voxel-pixel-crisp640' });

function shots(transitionIn: ManifestShot['transitionIn'] | 'none'): ManifestShot[] {
  if (transitionIn === 'none') return [{ id: 'a', t0: 0, t1: 6, scene: STRIPES_SCENE }];
  return [
    { id: 'a', t0: 0, t1: CUT_AT, scene: STRIPES_SCENE },
    { id: 'b', t0: CUT_AT, t1: 6, transitionIn, scene: HELLO_SCENE },
  ];
}

function focusOf(style: WowStyleId): TransitionFocus | undefined {
  return TRANSITION_STYLES[style].wow?.focus === true ? FOCUS : undefined;
}

function wowManifest(style: WowStyleId): RenderManifest {
  const { type, duration } = TRANSITION_STYLES[style];
  const focus = focusOf(style);
  return manifest(
    shots({ type, duration: duration.default, style, ...(focus === undefined ? {} : { focus }) }),
  );
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

describe('wow transitions in the engine (SwiftShader)', () => {
  it('composites every wow style with its focus, in the palette, as the goldens', async () => {
    const seed = shotSeed(manifest([]).seed, 'transition:b');
    const params = { palette: paletteNumbers(STYLE.swatches) };
    await withPage(async (page) => {
      for (const style of WOW_STYLE_IDS) {
        const { duration } = TRANSITION_STYLES[style];
        for (const p of PROGRESS) {
          const t = CUT_AT + p * duration.default;
          // A = the outgoing shot alone at t (its overhang), B = the incoming shot after a cut.
          await page.load(manifest(shots('none')));
          const frameA = new Uint8Array(await page.frameAt(t));
          await page.load(manifest(shots({ type: 'cut' })));
          const frameB = new Uint8Array(await page.frameAt(t));
          await page.load(wowManifest(style));
          const data = new Uint8Array(await page.frameAt(t));
          const expected = compositeTransition(
            style,
            { ...params, focus: focusOf(style) },
            { width: WIDTH, height: HEIGHT, data: frameA },
            { width: WIDTH, height: HEIGHT, data: frameB },
            (t - CUT_AT) / duration.default,
            seed,
          );
          const name = `transition-wow-${style}-p${String(Math.round(p * 100))}`;
          expect(Buffer.from(data).equals(Buffer.from(expected)), name).toBe(true);
          expect(vibeGuard({ width: WIDTH, height: HEIGHT, data }, STYLE).issues, name).toEqual([]);
          await compareWithGolden(name, { width: WIDTH, height: HEIGHT, data });
        }
      }
      expect(page.errors).toEqual([]);
    });
  }, 300_000);
});
