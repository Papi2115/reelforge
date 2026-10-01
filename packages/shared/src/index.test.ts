import { describe, expect, it } from 'vitest';
import { packageName } from './index.js';

describe('@reelforge/shared', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@reelforge/shared');
  });
});
