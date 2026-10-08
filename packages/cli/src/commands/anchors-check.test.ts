import { AnchorIndex } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import {
  checkAnchors,
  checkCues,
  countSyncProblems,
  formatAnchorCheck,
  formatCueCheck,
} from './anchors-check.js';

const shot = { id: 's02', t0: 2, t1: 8 };
const anchor = (phrase: string, t: number) => ({ shotId: 's02', phrase, nth: 1, t, tEnd: t + 0.4 });
const cue = (name: string, t: number) => ({ shotId: 's02', name, t });

function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value');
  return value;
}

describe('checkAnchors', () => {
  it('classifies anchors by the nearest cue: lands (±150 ms), misses (≤500 ms), no cue, outside', () => {
    const checks = checkAnchors(
      shot,
      [anchor('one', 3), anchor('two', 5), anchor('three', 7), anchor('late', 9)],
      [cue('hit', 3.1), cue('click', 5.3)],
      undefined,
    );
    expect(checks.map((check) => check.verdict)).toEqual([
      'lands',
      'misses',
      'no-cue',
      'outside-shot',
    ]);
    const [lands, misses, , outside] = checks;
    expect(lands).toMatchObject({ local: 1, cue: { name: 'hit' } });
    expect(misses?.cue?.offset).toBeCloseTo(0.3);
    expect(formatAnchorCheck(defined(misses), shot)).toMatch(
      /^MISS .*"two".*\+0\.30s off \(allowed ±0\.15s\)/,
    );
    expect(formatAnchorCheck(defined(outside), shot)).toMatch(
      /^OUTSIDE .*spoken outside this shot \(2\.00–8\.00s\)/,
    );
  });

  it('notes when the fuzzy resolver disagrees with the engine', () => {
    const index = new AnchorIndex([{ text: 'boom', t: 4, tEnd: 4.4 }]);
    const check = defined(checkAnchors(shot, [anchor('boom', 3)], [], index)[0]);
    expect(check.fuzzyT).toBe(4);
    expect(formatAnchorCheck(check, shot)).toMatch(/fuzzy resolver puts it at 4\.00s/);
  });
});

describe('checkCues', () => {
  it('marks cues on anchors, near anchors, free and outside the shot', () => {
    const anchors = [anchor('one', 3)];
    const cues = checkCues(
      shot,
      [cue('a', 3.05), cue('b', 3.4), cue('c', 6), cue('d', 1)],
      anchors,
    );
    expect(cues.map((check) => check.verdict)).toEqual([
      'on-anchor',
      'near-anchor',
      'free',
      'outside-shot',
    ]);
    expect(formatCueCheck(defined(cues[3]), shot)).toMatch(/^OUTSIDE sfx "d" at 1\.00s/);
    const missing = checkAnchors(shot, anchors, [cue('x', 3.4)], undefined);
    expect(countSyncProblems(missing, cues)).toBe(2);
  });
});

describe('checkAnchors with a phrase spoken before and inside the shot', () => {
  it('compares with the occurrence the shot means (no false fuzzy note)', () => {
    const index = new AnchorIndex([
      { text: 'in', t: 0.61, tEnd: 0.7 },
      { text: 'in', t: 3.2, tEnd: 3.35 },
    ]);
    const [check] = checkAnchors(shot, [anchor('in', 3.2)], [], index);
    expect(check).toMatchObject({ verdict: 'no-cue', fuzzyT: null });
  });
});
