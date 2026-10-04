import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  guardHarnessPage,
  type HarnessBrowser,
  type HarnessBrowserOptions,
  type HarnessPage,
} from '@reelforge/engine/cli';
import { filmShots, writeFilm } from '../testing/film.js';
import { TestProjects } from '../testing/project.js';
import { PlaywrightFrameRenderer } from './playwright-renderer.js';

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

/** A fake page: `hang` = every request never answers. */
function fakePage(hang: boolean): HarnessPage {
  const answer = <T>(value: T): Promise<T> => (hang ? never<T>() : Promise.resolve(value));
  return {
    load: () => answer(INFO),
    frameAt: () => answer(Buffer.alloc(16)),
    hashAt: () => answer('hash'),
    checkCards: () => answer([]),
    reloadShot: () => answer(INFO),
    pick: () => answer(null),
    setShotDirection: () => answer(undefined),
    errors: [],
    close: () => Promise.resolve(),
  };
}

/** Fake harness browser: page n hangs when `hangs[n]`; counts the browser restarts. */
function fakeLaunch(hangs: readonly boolean[]) {
  const stats = { opened: 0, restarts: 0, options: undefined as HarnessBrowserOptions | undefined };
  const launch = (options: HarnessBrowserOptions): Promise<HarnessBrowser> => {
    stats.options = options;
    let generation = 0;
    return Promise.resolve({
      open: () => {
        const born = generation;
        const hang = hangs[stats.opened] ?? false;
        stats.opened += 1;
        return Promise.resolve(
          guardHarnessPage(fakePage(hang), {
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
    const { launch, stats } = fakeLaunch([true, false]);
    const renderer = new PlaywrightFrameRenderer({ launch, timeouts: { requestTimeoutMs: 5 } });
    const result = await renderer.renderShot(request(), new AbortController().signal);
    expect(result.ok).toBe(true);
    expect(stats).toMatchObject({ opened: 2, restarts: 1 });
    expect(stats.options).toEqual({ timeouts: { requestTimeoutMs: 5 } });
    await renderer.close();
  });

  it('reports a render that timed out twice as timedOut instead of hanging', async () => {
    const { launch, stats } = fakeLaunch([true, true]);
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
