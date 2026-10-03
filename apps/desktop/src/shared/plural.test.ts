import { describe, expect, it } from 'vitest';
import { plural } from './plural.js';

describe('plural', () => {
  it('uses the singular for one and the plural otherwise', () => {
    expect(plural(1, 'shot')).toBe('1 shot');
    expect(plural(0, 'shot')).toBe('0 shots');
    expect(plural(16, 'shot')).toBe('16 shots');
    expect(plural(2, 'new reply', 'new replies')).toBe('2 new replies');
  });
});
