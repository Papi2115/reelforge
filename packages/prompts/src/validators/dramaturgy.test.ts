/** Pattern-interrupt and open-loop checks of the storyboard turn (PLAN.md#12.25–12.26). */
import type { Interrupt, StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkInterrupts, interruptTarget, validateLoops } from './dramaturgy.js';
import { validateStoryboard } from './storyboard.js';

function shot(
  id: string,
  t0: number,
  t1: number,
  extra: Partial<StoryboardShot> = {},
): StoryboardShot {
  return {
    id,
    t0,
    t1,
    treatment: 'metaphor-object',
    intent: 'x',
    scene: `scenes/${id}.js`,
    ...extra,
  };
}

/** 3 minutes of 6-second shots, alternating voxel and retro-ui. */
function film(marks: Readonly<Record<number, Partial<StoryboardShot>>>): StoryboardShot[] {
  return Array.from({ length: 30 }, (_, index) =>
    shot(`s${String(index + 1).padStart(2, '0')}`, index * 6, index * 6 + 6, {
      look: index % 2 === 0 ? 'voxel' : 'retro-ui',
      ...marks[index],
    }),
  );
}

const SCALE = { interrupt: { kind: 'scale-shift' as const, note: 'the room shrinks' } };
const codes = (shots: readonly StoryboardShot[], options = {}) =>
  checkInterrupts(shots, options).map((entry) => `${entry.severity}:${entry.code}`);

describe('checkInterrupts', () => {
  it('accepts 1-2 planned interrupts per minute, spaced and valid for their looks', () => {
    const shots = film({ 4: SCALE, 10: SCALE, 16: SCALE, 22: SCALE });
    expect(codes(shots)).toEqual([]);
  });

  it('rejects one in the first 5 s, two closer than 15 s and a kind the look forbids', () => {
    const shots = film({ 0: SCALE, 2: SCALE, 3: SCALE, 12: SCALE, 20: SCALE });
    expect(codes(shots)).toEqual([
      'error:interrupt-too-early',
      'error:interrupt-spacing',
      'error:interrupt-spacing',
      'error:interrupt-kind',
    ]);
  });

  it('needs crt-zoom to enter a screen, warns about a cut look-switch', () => {
    const enter = { interrupt: { kind: 'enter-screen' as const, note: 'into the CRT' } };
    const look = { interrupt: { kind: 'look-switch' as const, note: 'blueprint now' } };
    const withZoom = {
      ...enter,
      transitionIn: { type: 'glitch' as const, duration: 0.7, style: 'crt-zoom' },
    };
    expect(codes(film({ 5: enter, 11: look, 17: withZoom, 24: SCALE }))).toEqual([
      'error:interrupt-transition',
      'warning:interrupt-transition',
    ]);
  });

  it('warns when the density misses the range; the tension curve moves the target', () => {
    expect(codes(film({ 10: SCALE }))).toEqual(['warning:interrupt-density']);
    const calm = [
      { t: 0, v: 0 },
      { t: 180, v: 0 },
    ];
    const tense = [
      { t: 0, v: 1 },
      { t: 180, v: 1 },
    ];
    expect(interruptTarget(180, calm)).toEqual({ min: 3, max: 4 });
    expect(interruptTarget(180, tense)).toEqual({ min: 4, max: 6 });
    expect(interruptTarget(180, undefined)).toEqual({ min: 3, max: 6 });
  });

  it('keeps the marker of a locked shot as it was', () => {
    const shots = film({ 4: SCALE, 10: SCALE, 16: SCALE });
    const locked = new Map<string, Interrupt | undefined>([
      ['s05', SCALE.interrupt],
      ['s23', undefined],
      ['s11', { kind: 'perspective-shift' as const, note: 'orbit' }],
    ]);
    expect(codes(shots, { locked })).toEqual(['error:interrupt-locked']);
  });

  it('runs inside the storyboard validator only when asked', () => {
    const shots = film({ 0: SCALE });
    const text = JSON.stringify({ version: 1, shots });
    const off = validateStoryboard(text);
    expect(off.issues.some((entry) => entry.code.startsWith('interrupt-'))).toBe(false);
    const on = validateStoryboard(text, { interrupts: {} });
    expect(on.issues.some((entry) => entry.code === 'interrupt-too-early')).toBe(true);
  });
});

describe('validateLoops', () => {
  const loop = {
    id: 'why-red',
    question: 'why does red bend the least?',
    openedAt: { t: 4 },
    plannedCloseAt: { t: 30 },
    foreshadowed: true,
    status: 'open',
  };

  it('reports a loop that never closes as a ⚠ warning, never an error', () => {
    const result = validateLoops(JSON.stringify({ version: 1, loops: [loop] }));
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'loop-unclosed' }),
    ]);
    expect(result.issues[0]?.message).toMatch(/^⚠ loop why-red/);
  });

  it('turns an invalid file into warnings', () => {
    const result = validateLoops('{ "version": 1, "loops": [{ "id": "X" }] }');
    expect(result.value).toBeUndefined();
    expect(result.issues.every((entry) => entry.severity === 'warning')).toBe(true);
    expect(validateLoops('not json').issues[0]?.severity).toBe('warning');
  });
});
