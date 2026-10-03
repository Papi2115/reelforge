/** Static scene checks: unknown kit names, phone legibility of text calls. */
import { describe, expect, it } from 'vitest';
import { findTextCalls, legibilityFindings, unknownKitNames } from './source-checks.js';
import { kitNamesFromCatalog } from './tools.js';

const SOURCE = `export const meta = { id: 's01' };
export function build(ctx) {
  const desk = ctx.kit.env.desk({});
  const calc = ctx.kit.props.calculator({}).on(desk);
  const prism = ctx.kit.props.prism({ color: 1 });
  const again = ctx.kit . props . prism ({});
  return { calc, prism, again };
}
export function update(t, s, ctx) {
  const size = 1 + t;
  ctx.text.title('BIG', { id: 'a', scale: 3 });
  ctx.text.title('TINY', { id: 'b', scale: 1 });
  ctx.text.kinetic('mono words', { font: 'mono' });
  ctx.text.title('DYNAMIC', { scale: size });
  ctx.text.lowerThird('61 KB', 'of memory', { side: 'left' });
  ctx.text.lowerThird('ONLY ONE', { side: 'right' });
  const { text } = ctx;
  text.title('DEFAULT');
}
`;

const ANNOTATED = `export function update(t, s, ctx) {
  ctx.annotate.pin({ target: s.calc, text: 'LCD' });
  ctx.annotate.callout({ text: 'Tiny', scale: 1 });
  ctx.annotate.badge({ value: 2, target: s.calc, size: 0.03 });
  ctx.annotate.badge({ value: 3, target: s.calc });
  ctx.annotate.ring({ target: s.calc });
}
`;

describe('unknownKitNames', () => {
  it('lists kit calls the catalogue does not have, once each', () => {
    const kit = kitNamesFromCatalog();
    expect(kit.props.has('calculator')).toBe(true);
    expect(unknownKitNames(SOURCE, kit)).toEqual(['prism']);
  });
});

describe('legibility', () => {
  it('reads literal scales and fonts of ctx.text calls', () => {
    expect(
      findTextCalls(SOURCE).map((call) => [
        call.kind,
        call.line,
        call.scale,
        call.font,
        call.secondary,
      ]),
    ).toEqual([
      ['title', 11, 3, undefined, false],
      ['title', 12, 1, undefined, false],
      ['kinetic', 13, undefined, 'mono', false],
      ['title', 14, undefined, undefined, false],
      ['lowerThird', 15, undefined, undefined, true],
      ['lowerThird', 16, undefined, undefined, false],
      ['title', 18, undefined, undefined, false],
    ]);
    expect(findTextCalls('export const = ;')).toEqual([]);
  });

  it('flags scale 1, default mono and lower-third secondary lines', () => {
    const findings = legibilityFindings(SOURCE, 'scenes/s01.js', {
      minScale: 2,
      minGlyphPx: 14,
      frameWidth: 640,
    });
    expect(findings.map((entry) => entry.message.split(':').slice(0, 2).join(':'))).toEqual([
      'scenes/s01.js:12 ctx.text.title',
      'scenes/s01.js:13 ctx.text.kinetic',
      'scenes/s01.js:15 ctx.text.lowerThird',
    ]);
    expect(findings[0]?.message).toContain('scale 1 is 7 px high');
    // At 1280 wide the glyphs must be 28 px: scale 3 (21 px) is too small too.
    const wide = legibilityFindings(SOURCE, 'scenes/s01.js', {
      minScale: 2,
      minGlyphPx: 14,
      frameWidth: 1280,
    });
    expect(wide.map((entry) => entry.message.split(' ')[0])).toContain('scenes/s01.js:11');
  });

  it('checks annotation labels and badge numbers too', () => {
    expect(findTextCalls(ANNOTATED).map((call) => call.kind)).toEqual([
      'annotate.pin',
      'annotate.callout',
      'annotate.badge',
      'annotate.badge',
    ]);
    const findings = legibilityFindings(ANNOTATED, 'scenes/s02.js', {
      minScale: 2,
      minGlyphPx: 14,
      frameWidth: 640,
    });
    expect(findings.map((entry) => entry.message.split(':').slice(0, 2).join(':'))).toEqual([
      'scenes/s02.js:3 ctx.annotate.callout',
      'scenes/s02.js:4 ctx.annotate.badge',
    ]);
    expect(findings[1]?.message).toContain('Make the badge bigger');
  });
});
