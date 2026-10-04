/**
 * Reveal moments keep the sync (PLAN.md#12.27): a slow motion proposed on an anchored word never
 * has an anchor strictly inside its window, so after accepting it every anchor and cue of the shot
 * renders at the same scene time, and the `reelforge anchors` checks (checkAnchors / checkCues)
 * give exactly the same report. The engine side (anchors and cues of a loaded video unchanged by
 * a time remap) is covered by packages/engine/test/render/moments.test.ts.
 */
import { momentRenderEffects, proposeMoments, remapTime, type Moment } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkAnchors, checkCues, countSyncProblems } from './anchors-check.js';

const SHOT = { id: 's02', t0: 48, t1: 58 };
const SHOTS = [{ id: 's01', t0: 0, t1: 48 }, SHOT, { id: 's03', t0: 58, t1: 120 }];
const WORDS = [
  { text: 'It', t: 50, tEnd: 50.2 },
  { text: 'was', t: 50.3, tEnd: 50.5 },
  { text: 'gone,', t: 50.6, tEnd: 51.55 },
  { text: 'forever.', t: 51.6, tEnd: 52.2 },
  { text: 'Then', t: 54.4, tEnd: 54.7 },
  { text: 'silence.', t: 54.8, tEnd: 55.4 },
];
const ANCHORS = [
  { shotId: 's02', phrase: 'forever', nth: 1, t: 51.6, tEnd: 52.2 },
  { shotId: 's02', phrase: 'silence', nth: 1, t: 54.8, tEnd: 55.4 },
];
const CUES = [
  { shotId: 's02', name: 'hit', t: 51.62 },
  { shotId: 's02', name: 'whoosh', t: 54.8 },
];
const CURVE = [
  { t: 0, v: 0.2 },
  { t: 51.6, v: 0.95 },
  { t: 120, v: 0.2 },
];

function report(anchors: typeof ANCHORS, cues: typeof CUES) {
  const anchorChecks = checkAnchors(SHOT, anchors, cues, undefined);
  const cueChecks = checkCues(SHOT, cues, anchors);
  return { anchorChecks, cueChecks, problems: countSyncProblems(anchorChecks, cueChecks) };
}

/** Film time at which scene time `scene` is shown (inverse of the monotone remap, bisection). */
function shownAt(windows: Parameters<typeof remapTime>[0], scene: number): number {
  let low = scene - 5;
  let high = scene + 5;
  for (let step = 0; step < 80; step += 1) {
    const middle = (low + high) / 2;
    if (remapTime(windows, middle) < scene) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

describe('accepting a slow-motion moment', () => {
  it('leaves the anchors report of the shot exactly as it was', () => {
    const [proposal] = proposeMoments({
      shots: SHOTS,
      tension: CURVE,
      words: WORDS,
      anchors: [...ANCHORS, ...CUES].map(({ shotId, t }) => ({ shotId, t })),
    });
    expect(proposal).toMatchObject({ kind: 'slow-motion', shotId: 's02', from: 51.6 });
    const accepted: Moment[] = proposal === undefined ? [] : [{ ...proposal, status: 'accepted' }];
    const windows = momentRenderEffects(accepted, SHOTS).get('s02')?.timeRemap ?? [];
    expect(windows).toHaveLength(1);
    // Anchors are resolved from the words: the remap never moves them, and none lies inside.
    for (const anchor of ANCHORS) expect(remapTime(windows, anchor.t)).toBe(anchor.t);
    // The visual of every cue still shows within a frame of its sound (audio is not remapped).
    for (const cue of CUES) expect(Math.abs(shownAt(windows, cue.t) - cue.t)).toBeLessThan(1 / 60);
    const before = report(ANCHORS, CUES);
    const remapped = ANCHORS.map((anchor) => ({ ...anchor, t: remapTime(windows, anchor.t) }));
    expect(report(remapped, CUES)).toEqual(before);
    expect(before.problems).toBe(0);
  });
});
