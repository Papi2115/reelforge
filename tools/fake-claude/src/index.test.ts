import { describe, expect, it } from 'vitest';
import { packageName } from './index.js';

describe('@reelforge/fake-claude', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@reelforge/fake-claude');
  });
});
