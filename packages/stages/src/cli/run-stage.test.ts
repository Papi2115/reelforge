import { describe, expect, it } from 'vitest';
import { envWithPathFirst, variantOp } from './run-stage.js';

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
