import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import { isHarnessTimeout } from '../../src/cli/harness-timeouts.js';
import { helloManifest, manifest } from '../support/manifests.js';

/** update() never returns after t = 1 s: the page stops answering. */
const STUCK_SCENE = `export const meta = { id: 'stuck', title: 'Stuck', treatment: 'title-card' };
export function build(ctx) { return {}; }
export function update(t, state, ctx) { if (t > 1) { for (;;) { state.spin = 1; } } }`;

const stuckManifest = (): ReturnType<typeof manifest> =>
  manifest([
    { id: 'stuck', t0: 0, t1: 3, scene: { file: 'scenes/stuck.js', source: STUCK_SCENE } },
  ]);

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser({
    timeouts: { requestTimeoutMs: 3_000, coldRequestTimeoutMs: 30_000 },
  });
});

afterAll(async () => {
  await browser.close();
});

describe('harness request timeouts', () => {
  it('a page stuck in update() times out with a typed error; the next page renders on a fresh browser', async () => {
    const stuck = await browser.open();
    try {
      await stuck.load(stuckManifest());
      await stuck.frameAt(0.5); // warm: the first frame of a page has the cold timeout
      const started = Date.now();
      const error: unknown = await stuck.frameAt(2).catch((caught: unknown) => caught);
      expect(isHarnessTimeout(error) && error.reason).toBe('timeout');
      expect(Date.now() - started).toBeLessThan(15_000);
      await expect(stuck.frameAt(0.5)).rejects.toSatisfy(isHarnessTimeout);
    } finally {
      await stuck.close();
    }
    const fresh = await browser.open();
    try {
      await fresh.load(helloManifest());
      const frame = await fresh.frameAt(1);
      expect(frame.length).toBe(640 * 360 * 4);
    } finally {
      await fresh.close();
    }
  });
});
