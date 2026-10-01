import { describe, expect, it } from 'vitest';
import { packageName } from './index.js';

describe('@reelforge/claude-bridge', () => {
  it('exposes its package name', () => {
    expect(packageName).toBe('@reelforge/claude-bridge');
  });
});
