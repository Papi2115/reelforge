import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import { HELLO_SCENE, manifest, STRIPES_SCENE, transitionsManifest } from '../support/manifests.js';

/** Global times fully inside shots a (hello), b (stripes) and c (hello) of transitionsManifest. */
const IN_A = 1;
const IN_B = 4.5;
const IN_C = 7.5;

const LINT_BROKEN = {
  file: 'scenes/b.js',
  source: `export const meta = { id: 'b' };
export function build(ctx) { return { x: Math.random() }; }
export function update(t, state, ctx) {}`,
};

const BUILD_BROKEN = {
  file: 'scenes/b.js',
  source: `export const meta = { id: 'b' };
export function build(ctx) { throw new Error('boom'); }
export function update(t, state, ctx) {}`,
};

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('reloadShot (hot reload of one shot)', () => {
  it('rebuilds only that shot, matching a fresh load of the edited video', async () => {
    const edited = transitionsManifest();
    const shotB = edited.shots[1];
    if (!shotB) throw new Error('fixture needs shot b');
    edited.shots[1] = { ...shotB, scene: HELLO_SCENE };
    const fresh = await browser.open();
    let expected: string;
    try {
      await fresh.load(edited);
      expected = await fresh.hashAt(IN_B);
    } finally {
      await fresh.close();
    }

    const page = await browser.open({ lint: true });
    try {
      await page.load(transitionsManifest());
      const before = {
        a: await page.hashAt(IN_A),
        b: await page.hashAt(IN_B),
        c: await page.hashAt(IN_C),
      };
      const info = await page.reloadShot('b', HELLO_SCENE);
      // The hello scene schedules its cue on the spoken "hello world" (global t = 1).
      expect(info.cues.filter((cue) => cue.shotId === 'b')).toEqual([
        { t: 1, name: 'pop', shotId: 'b' },
      ]);
      expect(info.duration).toBe(12);
      const after = await page.hashAt(IN_B);
      expect(after).not.toBe(before.b);
      expect(after).toBe(expected);
      expect(await page.hashAt(IN_A)).toBe(before.a);
      expect(await page.hashAt(IN_C)).toBe(before.c);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('rejects a broken scene with the engine message and keeps the previous shot', async () => {
    const page = await browser.open({ lint: true });
    try {
      await page.load(manifest([{ id: 'b', t0: 0, t1: 3, scene: STRIPES_SCENE }]));
      const before = await page.hashAt(1);
      await expect(page.reloadShot('b', LINT_BROKEN)).rejects.toThrow(
        /scene lint failed; fix these before the scene can load:\n\[shot b\]\nscenes\/b\.js:2:\d+ {2}error {2}no-random/,
      );
      await expect(page.reloadShot('b', BUILD_BROKEN)).rejects.toThrow(
        /\[shot b\] build\(\) threw Error: boom/,
      );
      await expect(page.reloadShot('zz', HELLO_SCENE)).rejects.toThrow(/no shot "zz"/);
      expect(await page.hashAt(1)).toBe(before);
      // The next good version replaces it.
      await page.reloadShot('b', HELLO_SCENE);
      expect(await page.hashAt(1)).not.toBe(before);
    } finally {
      await page.close();
    }
  });
});
