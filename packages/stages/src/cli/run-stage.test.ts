import { describe, expect, it } from 'vitest';
import { envWithPathFirst, experimentalWorldsSetup, variantOp } from './run-stage.js';

describe('run-stage child env', () => {
  it('puts the reelforge launchers first on PATH, keeping the Windows variable name', () => {
    const env = envWithPathFirst({ Path: 'C:\\Windows', OTHER: '1' }, 'C:\\rf bin', 'win32');
    expect(env).toEqual({ Path: 'C:\\rf bin;C:\\Windows', OTHER: '1' });
    expect(envWithPathFirst({}, '/rf', 'linux')).toEqual({ PATH: '/rf' });
    expect(envWithPathFirst({ PATH: '/usr/bin' }, '/rf', 'linux')).toEqual({
      PATH: '/rf:/usr/bin',
    });
  });
});

describe('run-stage experimental worlds', () => {
  it('turns the worlds on for the stages and the runtime CLI only with the flag', () => {
    expect(experimentalWorldsSetup(true, { PATH: '/usr/bin' })).toEqual({
      settings: { experimentalWorlds: true },
      env: { PATH: '/usr/bin', REELFORGE_EXPERIMENTAL_WORLDS: '1' },
    });
    expect(experimentalWorldsSetup(false, { PATH: '/usr/bin' })).toEqual({
      settings: {},
      env: { PATH: '/usr/bin' },
    });
  });
});

describe('run-stage variants', () => {
  it('generates 3 variants by default, with a count, a note or a pick', () => {
    expect(variantOp({})).toEqual({ kind: 'generate', count: 3 });
    expect(variantOp({ count: '2', note: 'calmer' })).toEqual({
      kind: 'generate',
      count: 2,
      note: 'calmer',
    });
    expect(variantOp({ pick: '2', lock: true })).toEqual({ kind: 'pick', index: 2, lock: true });
  });
});
