import { describe, expect, it } from 'vitest';
import { packageName } from './index.js';

describe('@reelforge/desktop', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@reelforge/desktop');
  });
});
