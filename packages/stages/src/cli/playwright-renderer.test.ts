import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  guardHarnessPage,
  type HarnessBrowser,
  type HarnessBrowserOptions,
  type HarnessPage,
} from '@reelforge/engine/cli';
import { filmShots, writeFilm } from '../testing/film.js';
import { TestProjects } from '../testing/project.js';
import { HARNESS_START_ATTEMPTS, PlaywrightFrameRenderer } from './playwright-renderer.js';

const never = <T>(): Promise<T> =>
  new Promise<T>(() => {
    // a page that never answers
  });

type LoadInfo = Awaited<ReturnType<HarnessPage['load']>>;
const INFO = {
  duration: 2,
  style: 'test',
  width: 2,
  height: 2,
  fps: 30,
  cues: [],
  anchors: [],
  gpu: { vendor: 'fake', renderer: 'fake' },
} as unknown as LoadInfo;

/** `hang`: every request never answers; `no-harness`: the host page has no `__reelforge`. */
type PageMode = 'ok' | 'hang' | 'no-harness';

const NO_HARNESS = new Error(
  "page.evaluate: TypeError: Cannot read properties of undefined (reading 'load')\n    at eval",
);

function fakePage(mode: PageMode): HarnessPage {
  const answer = <T>(value: T): Promise<T> =>
    mode === 'hang' ? never<T>() : Promise.resolve(value);
  return {
    load: () => (mode === 'no-harness' ? Promise.reject(NO_HARNESS) : answer(INFO)),
    frameAt: () => answer(Buffer.alloc(16)),
    hashAt: () => answer('hash'),
    checkCards: () => answer([]),
    reloadShot: () => answer(INFO),
    pick: () => answer(null),
    setShotDirection: () => answer(undefined),
    errors: mode === 'no-harness' ? ['Uncaught SyntaxError: Unexpected end of input'] : [],
    close: () => Promise.resolve(),
  };
}

/** Fake harness browser: page n behaves as `modes[n]` (default ok); counts browser restarts. */
function fakeLaunch(modes: readonly PageMode[]) {
  const stats = { opened: 0, restarts: 0, options: undefined as HarnessBrowserOptions | undefined };
  const launch = (options: HarnessBrowserOptions): Promise<HarnessBrowser> => {
    stats.options = options;
    let generation = 0;
    return Promise.resolve({
      open: () => {
        const born = generation;
        const mode = modes[stats.opened] ?? 'ok';
        stats.opened += 1;
        return Promise.resolve(
          guardHarnessPage(fakePage(mode), {
            timeouts: { requestTimeoutMs: 20, coldRequestTimeoutMs: 20 },
            onTimeout: () => {
              generation += 1;
              stats.restarts += 1;
            },
            isStale: () => born !== generation,
          }),
        );
      },
      close: () => Promise.resolve(),
    });
  };
  return { launch, stats };
}

const projects = new TestProjects();
let dir: string;

beforeAll(async () => {
  dir = await projects.create('renderer timeout');
  writeFilm(dir, filmShots(1));
});

afterAll(() => {
  projects.dispose();
});

const request = () => ({ projectDir: dir, shotId: 's01', times: [0, 1], cards: true });

describe('PlaywrightFrameRenderer timeouts', () => {
  it('retries a render that timed out once on a fresh renderer', async () => {
    const { launch, stats } = fakeLaunch(['hang', 'ok']);
    const renderer = new PlaywrightFrameRenderer({ launch, timeouts: { requestTimeoutMs: 5 } });
    const result = await renderer.renderShot(request(), new AbortController().signal);
    expect(result.ok).toBe(true);
    expect(stats).toMatchObject({ opened: 2, restarts: 1 });
    expect(stats.options).toEqual({ timeouts: { requestTimeoutMs: 5 } });
    await renderer.close();
  });

  it('reports a render that timed out twice as timedOut instead of hanging', async () => {
    const { launch, stats } = fakeLaunch(['hang', 'hang']);
    const renderer = new PlaywrightFrameRenderer({ launch });
    const result = await renderer.renderShot(request(), new AbortController().signal);
    expect(result).toMatchObject({ ok: false, timedOut: true });
    expect(!result.ok && result.error).toMatch(
      /did not answer \(load\) within 20 ms \(retried once on a fresh renderer\)/,
    );
    expect(stats.opened).toBe(2);
    await renderer.close();
  });
});

describe('PlaywrightFrameRenderer harness start', () => {
  it('renders on a fresh page when the host page had no harness', async () => {
    const { launch, stats } = fakeLaunch(['no-harness', 'ok']);
    const renderer = new PlaywrightFrameRenderer({ launch }, 0);
    const result = await renderer.renderShot(request(), new AbortController().signal);
    expect(result.ok).toBe(true);
    expect(stats).toMatchObject({ opened: 2, restarts: 0 });
    await renderer.close();
  });

  it('reports a harness that never starts as a renderer problem, not a scene error', async () => {
    const { launch, stats } = fakeLaunch(['no-harness', 'no-harness', 'no-harness']);
    const renderer = new PlaywrightFrameRenderer({ launch }, 0);
    const result = await renderer.renderShot(request(), new AbortController().signal);
    expect(result).toMatchObject({
      ok: false,
      timedOut: true,
      errors: ['Uncaught SyntaxError: Unexpected end of input'],
    });
    expect(!result.ok && result.error).toMatch(
      /^the render harness page did not start \(TypeError: Cannot read properties of undefined \(reading 'load'\)\) on 3 fresh pages: a renderer problem/,
    );
    expect(stats.opened).toBe(HARNESS_START_ATTEMPTS);
    await renderer.close();
  });
});
