import { describe, expect, it } from 'vitest';
import * as kit from './index.js';

describe('@reelforge/kit', () => {
  it('exposes its package name and the public entry points', () => {
    expect(kit.packageName).toBe('@reelforge/kit');
    expect(typeof kit.createKit).toBe('function');
    expect(typeof kit.voxelFromGrid).toBe('function');
    expect(typeof kit.defineProp).toBe('function');
    expect(kit.KIT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
