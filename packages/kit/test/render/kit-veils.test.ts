/**
 * Open-loop veils (PLAN.md#12.26) in the engine harness (SwiftShader): examples/k11_veils.js
 * reveals at 2 s over 0.6 s. Every setup passes the determinism lint, renders the same frame for
 * the same t in any seek order, and keeps the style (vibe guard) veiled, half revealed and
 * revealed; voxel and retro-ui have goldens of the three states (`kit-veil-<setup>-<state>`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import {
  KIT_GOLDEN_DIR,
  sceneManifest,
  sceneSource,
  type RenderManifest,
} from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'examples/k11_veils.js';
const SETUPS = ['voxel', 'retro', 'blueprint'] as const;
type Setup = (typeof SETUPS)[number];
const STATES = { veiled: 1.5, half: 2.3, revealed: 3.5 } as const;
const GOLDEN_SETUPS: readonly Setup[] = ['voxel', 'retro'];
const SUITE_TIMEOUT = 300_000;

function setupSource(setup: Setup): string {
  const source = sceneSource(FILE);
  const declaration = "const SETUP = 'voxel';";
  if (!source.includes(declaration)) throw new Error(`${FILE} no longer declares ${declaration}`);
  return source.replace(declaration, `const SETUP = '${setup}';`);
}

function manifest(setup: Setup): RenderManifest {
  return sceneManifest(FILE, { source: setupSource(setup), style: 'voxel-pixel-crisp640' });
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

async function withPage<T>(run: (page: HarnessPage) => Promise<T>): Promise<T> {
  const page = await browser.open({ lint: true });
  try {
    return await run(page);
  } finally {
    await page.close();
  }
}

describe('open-loop veils (SwiftShader)', () => {
  it('every setup passes the determinism lint', () => {
    for (const setup of SETUPS) {
      expect(lintScene(setupSource(setup), { filename: FILE }), setup).toEqual([]);
    }
  });

  it(
    'veiled, half and revealed frames: deterministic, in the style, goldens for voxel and retro-ui',
    async () => {
      await withPage(async (page) => {
        for (const setup of SETUPS) {
          const info = await page.load(manifest(setup));
          const hashes: string[] = [];
          for (const [state, t] of Object.entries(STATES)) {
            const data = new Uint8Array(await page.frameAt(t));
            const frame = { width: info.width, height: info.height, data };
            expectVibe(frame, `${setup} ${state}`);
            hashes.push(await page.hashAt(t));
            if (GOLDEN_SETUPS.includes(setup)) {
              await compareWithGolden(`kit-veil-${setup}-${state}`, frame, undefined, {
                goldenDir: KIT_GOLDEN_DIR,
              });
            }
          }
          expect(new Set(hashes).size, `${setup} changes as it reveals`).toBe(3);
          const backward: string[] = [];
          for (const t of Object.values(STATES).reverse()) backward.push(await page.hashAt(t));
          expect(backward.reverse(), setup).toEqual(hashes);
        }
        expect(page.errors).toEqual([]);
      });
    },
    SUITE_TIMEOUT,
  );
});
