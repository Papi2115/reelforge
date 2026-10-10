/** A world that only cuts (Grim Ink) is not asked for a look-change transition (PLAN.md#14.18). */
import { describe, expect, it } from 'vitest';
import { interruptOptions } from './dramaturgy.js';

const SWITCHES = { patternInterrupts: 'auto', openLoops: 'off', revealMoments: 'off' } as const;

describe('interruptOptions', () => {
  it('passes cutsOnly for c-cam only', () => {
    const locked = new Map();
    expect(interruptOptions({ ...SWITCHES, style: 'c-cam' }, undefined, locked)).toMatchObject({
      cutsOnly: true,
    });
    expect(interruptOptions({ ...SWITCHES, style: 'voxel' }, undefined, locked)).toEqual({
      locked,
    });
    expect(interruptOptions(SWITCHES, undefined, locked)).toEqual({ locked });
  });
});
