import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import { helloManifest, manifest } from '../support/manifests.js';

const RANDOM_SCENE = `export const meta = { id: 'rnd', title: 'Random', treatment: 'title-card' };
export function build(ctx) { return { x: Math.random() }; }
export function update(t, state, ctx) {}`;

const randomManifest = (): ReturnType<typeof manifest> =>
  manifest([{ id: 'rnd', t0: 0, t1: 1, scene: { file: 'scenes/rnd.js', source: RANDOM_SCENE } }]);

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('harness lint gate (lintScenes option)', () => {
  it('rejects scenes with lint errors before loading them, with the diagnostics', async () => {
    const page = await browser.open({ lint: true });
    try {
      await expect(page.load(randomManifest())).rejects.toThrow(
        /scene lint failed; fix these before the scene can load:\n\[shot rnd\]\nscenes\/rnd\.js:2:42 {2}error {2}no-random {2}Math\.random\(\) is non-deterministic/,
      );
      await expect(page.load(helloManifest())).resolves.toMatchObject({ duration: 5 });
    } finally {
      await page.close();
    }
  });

  it('loads the same scene when the option is off', async () => {
    const page = await browser.open();
    try {
      await expect(page.load(randomManifest())).resolves.toMatchObject({ duration: 1 });
    } finally {
      await page.close();
    }
  });
});
