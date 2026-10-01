import { describe, expect, it } from 'vitest';
import { packageName } from './index.js';

describe('@reelforge/pipeline', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@reelforge/pipeline');
  });
});
