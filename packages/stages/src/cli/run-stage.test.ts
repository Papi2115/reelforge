import { describe, expect, it } from 'vitest';
import { envWithPathFirst } from './run-stage.js';

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
