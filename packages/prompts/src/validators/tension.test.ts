/** tension.json validation and the `tension-tempo` storyboard check (PLAN.md#12.22). */
import type { StoryboardShot, TensionFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt } from '../catalog.js';
import { checkStoryboard } from './storyboard.js';
import { checkTensionTempo, validateTension } from './tension.js';

const CURVE: TensionFile = {
  version: 1,
  source: 'claude',
  points: [
    { t: 0, v: 0.15 },
    { t: 30, v: 0.2 },
    { t: 31, v: 0.9 },
    { t: 60, v: 0.9 },
  ],
  segments: [
    { from: 0, to: 30, kind: 'calm', label: 'the setup' },
    { from: 30, to: 60, kind: 'peak', label: 'the reveal' },
  ],
};

function shots(lengths: readonly number[]): StoryboardShot[] {
  let t = 0;
  return lengths.map((length, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const shot: StoryboardShot = {
      id,
      t0: t,
      t1: t + length,
      treatment: index % 2 === 0 ? 'title-card' : 'metaphor-object',
      intent: 'x',
      scene: `scenes/${id}.js`,
    };
    t += length;
    return shot;
  });
}

const codes = (issues: readonly { code: string; severity: string }[]): string[] =>
  issues.map((entry) => `${entry.severity}:${entry.code}`);

describe('validateTension', () => {
  it('accepts a curve over the narration', () => {
    const report = validateTension(JSON.stringify(CURVE), { durationS: 60 });
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it('rejects a curve that stops early or starts late; warns on a flat or sparse one', () => {
    const short = validateTension(JSON.stringify(CURVE), { durationS: 90 });
    expect(codes(short.issues)).toEqual(['error:tension-coverage']);
    const late = { ...CURVE, points: [{ t: 5, v: 0.2 }, ...CURVE.points.slice(1)] };
    expect(codes(validateTension(JSON.stringify(late), { durationS: 60 }).issues)).toContain(
      'error:tension-coverage',
    );
    const flat = {
      ...CURVE,
      points: [
        { t: 0, v: 0.4 },
        { t: 60, v: 0.45 },
      ],
    };
    expect(codes(validateTension(JSON.stringify(flat), { durationS: 60 }).issues)).toEqual([
      'warning:tension-points',
      'warning:tension-flat',
    ]);
    expect(validateTension('{"version":1}', { durationS: 60 }).valid).toBe(false);
    expect(validateTension('not json', { durationS: 60 }).valid).toBe(false);
  });
});

describe('tension-tempo', () => {
  it('passes cuts that follow the curve', () => {
    // Calm half: 7 s shots (target ~6.8 s); peak half: 3 s shots (target ~3.5 s).
    const good = shots([7, 7, 7, 9, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(checkTensionTempo(good, CURVE).filter((entry) => entry.severity === 'error')).toEqual(
      [],
    );
  });

  it('errors on slow cuts at the peak and fast cuts in the calm, warns on milder misses', () => {
    const slowPeak = shots([7, 7, 7, 9, 7.5, 7.5, 7.5, 7.5]);
    expect(codes(checkTensionTempo(slowPeak, CURVE))).toEqual(['error:tension-tempo']);
    const fastCalm = shots([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(codes(checkTensionTempo(fastCalm, CURVE))).toEqual(['error:tension-tempo']);
    expect(checkTensionTempo(fastCalm, CURVE)[0]?.message).toContain('let the calm breathe');
    const mild = shots([7, 7, 7, 9, 5, 5, 5, 5, 5, 5]);
    expect(codes(checkTensionTempo(mild, CURVE))).toEqual(['warning:tension-tempo']);
  });

  it('runs inside the storyboard check only with a curve', () => {
    const slowPeak = shots([7, 7, 7, 9, 7.5, 7.5, 7.5, 7.5]);
    const storyboard = { version: 1 as const, shots: slowPeak };
    expect(codes(checkStoryboard(storyboard))).not.toContain('error:tension-tempo');
    expect(codes(checkStoryboard(storyboard, { tension: CURVE }))).toContain('error:tension-tempo');
  });
});

describe('prompts', () => {
  it('the storyboard prompt gets the curve table only when given one', () => {
    const plain = renderPrompt('storyboard', { styleId: 'voxel-pixel-crisp640' });
    const table =
      '- 0.0–30.0 s (0:00–0:30): calm "the setup", tension 0.18, target shot length ~6.7 s';
    const steered = renderPrompt('storyboard', { styleId: 'voxel-pixel-crisp640', tension: table });
    if (!plain.ok || !steered.ok) throw new Error('storyboard prompt does not render');
    expect(plain.value).not.toContain('Tension map');
    expect(steered.value).toContain(`Segments:\n${table}\n`);
    expect(steered.value).toContain('about 7.5 s at tension 0 down to about 3 s at tension 1');
    expect(steered.value.replace(/\{\{|\}\}/g, '')).toBe(steered.value);
  });

  it('the tension prompt asks for tension.json over the narration', () => {
    const rendered = renderPrompt('tension', { durationS: '36.7', minPoints: 4, maxPoints: 8 });
    if (!rendered.ok) throw new Error('tension prompt does not render');
    expect(rendered.value).toContain('Write `tension.json`');
    expect(rendered.value).toContain('the last at 36.7');
    expect(rendered.value).toContain('4–8 points');
    expect(rendered.value).not.toContain('You are the director/storyboard artist');
  });
});
