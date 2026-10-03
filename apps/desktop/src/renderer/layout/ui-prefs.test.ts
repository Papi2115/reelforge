import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parsePref } from './ui-prefs.js';

describe('parsePref', () => {
  const schema = z.object({ open: z.boolean() });
  const fallback = { open: false };

  it('reads a stored value and falls back for missing, broken or foreign data', () => {
    expect(parsePref('{"open":true}', schema, fallback)).toEqual({ open: true });
    expect(parsePref(null, schema, fallback)).toBe(fallback);
    expect(parsePref('{oops', schema, fallback)).toBe(fallback);
    expect(parsePref('{"open":"yes"}', schema, fallback)).toBe(fallback);
  });
});
