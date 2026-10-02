import { describe, expect, it } from 'vitest';
import { escapeFilterOptionValue, escapeFiltergraphText, filterPathValue } from './filtergraph.js';

describe('filtergraph escaping', () => {
  it('escapes option-level specials', () => {
    expect(escapeFilterOptionValue("a:b'c\\d")).toBe("a\\:b\\'c\\\\d");
  });

  it('escapes graph-level specials', () => {
    expect(escapeFiltergraphText('a,b;c[d]e\\f')).toBe('a\\,b\\;c\\[d\\]e\\\\f');
  });

  it('turns a Windows path into the C\\\\: form verified in spike 03', () => {
    expect(filterPathValue('C:\\Users\\Papi\\Creatorize Suite\\models\\sh.rnnn')).toBe(
      'C\\\\:/Users/Papi/Creatorize Suite/models/sh.rnnn',
    );
  });

  it('keeps non-ASCII and escapes commas/quotes in file names', () => {
    expect(filterPathValue("D:\\głos żółć\\it's, [v1].rnnn")).toBe(
      "D\\\\:/głos żółć/it\\\\\\'s\\, \\[v1\\].rnnn",
    );
  });
});
