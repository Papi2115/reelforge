/**
 * Continuity links (PLAN.md#13.2) in the engine harness (SwiftShader): a test scene pair (an office
 * wall with a calendar -> the calendar page) linked by each kind at p = 0.25, 0.5 and 0.75 as
 * goldens `transition-continuity-<kind>-p<25|50|75>`, each palette-only (vibe guard), byte-equal to
 * `compositeTransition` of the two shots' own frames with the link's anchor (preview and export
 * both read `seek`), and the same bytes when the same time is rendered again.
 */
import {
  CONTINUITY_KINDS,
  continuityStyleId,
  continuityTransition,
  type ContinuityKind,
  type ContinuityLink,
  type ManifestShot,
  type RenderManifest,
} from '@reelforge/shared';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
import { manifest } from '../support/manifests.js';

const WIDTH = 640;
const HEIGHT = 360;
const CUT_AT = 3;
const PROGRESS = [0.25, 0.5, 0.75] as const;
/** Where the calendar sits in s02_calendar_room.js (fixed camera). */
const ANCHOR = { x: 0.644, y: 0.433 };
const STYLE = resolveStyle({ style: 'voxel-pixel-crisp640' });

function fixture(name: string): ManifestShot['scene'] {
  const file = `test/fixtures/${name}`;
  const root = path.resolve(import.meta.dirname, '..', '..');
  return { file, source: readFileSync(path.join(root, file), 'utf8') };
}

const ROOM = fixture('s02_calendar_room.js');
const PAGE = fixture('s03_calendar_page.js');

function link(kind: ContinuityKind): ContinuityLink {
  return { kind, object: 'wall calendar', anchor: ANCHOR };
}

function shots(transitionIn: ManifestShot['transitionIn'] | 'none'): ManifestShot[] {
  if (transitionIn === 'none') return [{ id: 'a', t0: 0, t1: 6, scene: ROOM }];
  return [
    { id: 'a', t0: 0, t1: CUT_AT, scene: ROOM },
    { id: 'b', t0: CUT_AT, t1: 6, transitionIn, scene: PAGE },
  ];
}

function linkedManifest(kind: ContinuityKind): RenderManifest {
  return manifest(shots(continuityTransition({ t0: CUT_AT, t1: 6 }, link(kind))));
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

describe('continuity links in the engine (SwiftShader)', () => {
  it('composites every link kind on its anchor, in the palette, as the goldens', async () => {
    const seed = shotSeed(manifest([]).seed, 'transition:b');
    const params = { palette: paletteNumbers(STYLE.swatches), focus: ANCHOR };
    await withPage(async (page) => {
      for (const kind of CONTINUITY_KINDS) {
        const transition = continuityTransition({ t0: CUT_AT, t1: 6 }, link(kind));
        if (transition.type === 'cut') throw new Error('a link is never a cut');
        for (const p of PROGRESS) {
          const t = CUT_AT + p * transition.duration;
          // A = the outgoing shot alone at t (its overhang), B = the incoming shot after a cut.
          await page.load(manifest(shots('none')));
          const frameA = new Uint8Array(await page.frameAt(t));
          await page.load(manifest(shots({ type: 'cut' })));
          const frameB = new Uint8Array(await page.frameAt(t));
          await page.load(linkedManifest(kind));
          const data = new Uint8Array(await page.frameAt(t));
          const expected = compositeTransition(
            continuityStyleId(kind),
            params,
            { width: WIDTH, height: HEIGHT, data: frameA },
            { width: WIDTH, height: HEIGHT, data: frameB },
            (t - CUT_AT) / transition.duration,
            seed,
          );
          const name = `transition-continuity-${kind}-p${String(Math.round(p * 100))}`;
          expect(Buffer.from(data).equals(Buffer.from(expected)), name).toBe(true);
          expect(vibeGuard({ width: WIDTH, height: HEIGHT, data }, STYLE).issues, name).toEqual([]);
          await compareWithGolden(name, { width: WIDTH, height: HEIGHT, data });
        }
      }
      expect(page.errors).toEqual([]);
    });
  }, 300_000);

  it('renders the same time to the same bytes twice', async () => {
    await withPage(async (page) => {
      await page.load(linkedManifest('zoom-through'));
      const t = CUT_AT + 0.5;
      const first = Buffer.from(await page.frameAt(t));
      await page.frameAt(CUT_AT + 0.9);
      await page.frameAt(1);
      const second = Buffer.from(await page.frameAt(t));
      expect(first.equals(second)).toBe(true);
      expect(page.errors).toEqual([]);
    });
  }, 120_000);
});
