import { describe, expect, it } from 'vitest';
import { formatValue, parseTemplate, renderTemplate, type TemplateVars } from './template.js';

function render(template: string, vars: TemplateVars): ReturnType<typeof renderTemplate> {
  const parsed = parseTemplate(template);
  if (!parsed.ok) throw new Error(`parse failed: ${JSON.stringify(parsed.error)}`);
  return renderTemplate(parsed.value, vars);
}

describe('parseTemplate', () => {
  it('collects required (outside sections) and optional variables', () => {
    const parsed = parseTemplate('A {{a}} {{#b}}B {{b}} {{c}}{{/b}} {{a}} {{#d}}{{a}}{{/d}}');
    expect(parsed.ok && parsed.value.required).toEqual(['a']);
    expect(parsed.ok && parsed.value.optional).toEqual(['b', 'c', 'd']);
  });

  it('leaves lone braces and JSON-like text alone', () => {
    const text = '{"a":{"b":1}} and } or { and {"x":[{"y":2}]}}';
    expect(render(text, {})).toEqual({ ok: true, value: text });
  });

  it.each([
    ['{{a', 'unclosed {{'],
    ['{{ a b }}', 'invalid tag'],
    ['{{#a}}x', 'never closed'],
    ['x{{/a}}', 'does not close anything'],
    ['{{#a}}{{#b}}{{/a}}{{/b}}', 'expected {{/b}}'],
    ['{{{a}}}', 'invalid tag'],
  ])('rejects %s', (template, message) => {
    const parsed = parseTemplate(template);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.kind === 'template-syntax') {
      expect(parsed.error.message).toContain(message);
    }
  });

  it('reports the line of a syntax error', () => {
    const parsed = parseTemplate('one\ntwo\n{{#open}} three');
    expect(parsed).toMatchObject({ ok: false, error: { kind: 'template-syntax', line: 3 } });
  });
});

describe('renderTemplate', () => {
  it('inserts strings verbatim, scalars via String() and objects/arrays as JSON', () => {
    const result = render('{{s}}|{{n}}|{{b}}|{{o}}|{{l}}', {
      s: 'a "quoted" <b>',
      n: 2.5,
      b: false,
      o: { id: 's01', t0: 0 },
      l: [1, 'two'],
    });
    expect(result).toEqual({
      ok: true,
      value: 'a "quoted" <b>|2.5|false|{"id":"s01","t0":0}|[1,"two"]',
    });
  });

  it('renders a section only for set, non-empty values', () => {
    const template = '[{{#x}}X={{x}}{{/x}}]';
    expect(render(template, { x: 'yes' })).toEqual({ ok: true, value: '[X=yes]' });
    for (const empty of [undefined, null, false, '', []]) {
      expect(render(template, { x: empty })).toEqual({ ok: true, value: '[]' });
    }
    expect(render(template, {})).toEqual({ ok: true, value: '[]' });
    expect(render(template, { x: 0 })).toEqual({ ok: true, value: '[X=0]' });
  });

  it('supports nested sections', () => {
    const template = '{{#a}}A{{#b}}B{{/b}}{{/a}}';
    expect(render(template, { a: 1, b: 1 })).toEqual({ ok: true, value: 'AB' });
    expect(render(template, { a: 1 })).toEqual({ ok: true, value: 'A' });
    expect(render(template, { b: 1 })).toEqual({ ok: true, value: '' });
  });

  it('renders an inverted section only for unset or empty values', () => {
    const template = '[{{^world}}voxel{{/world}}{{#world}}{{world}}{{/world}}]';
    expect(render(template, {})).toEqual({ ok: true, value: '[voxel]' });
    for (const empty of [undefined, null, false, '', []]) {
      expect(render(template, { world: empty })).toEqual({ ok: true, value: '[voxel]' });
    }
    expect(render(template, { world: 'Sketchbook' })).toEqual({ ok: true, value: '[Sketchbook]' });
    const parsed = parseTemplate('{{^a}}{{b}}{{/a}}');
    expect(parsed.ok && parsed.value.optional).toEqual(['a', 'b']);
    expect(parseTemplate('{{^a}}x{{/b}}').ok).toBe(false);
  });

  it('returns every missing required variable as a typed error', () => {
    expect(render('{{a}} {{b}} {{a}} {{c}}', { b: 'ok', c: null })).toEqual({
      ok: false,
      error: { kind: 'missing-vars', names: ['a', 'c'] },
    });
  });

  it('requires variables inside a section only when it renders', () => {
    expect(render('{{#on}}{{detail}}{{/on}}', { on: true })).toMatchObject({
      ok: false,
      error: { names: ['detail'] },
    });
    expect(render('{{#on}}{{detail}}{{/on}}', { on: false })).toEqual({ ok: true, value: '' });
  });

  it('never re-interprets braces that come from values (injection safety)', () => {
    const result = render('{{a}} / {{b}}', {
      a: '{{b}} {{#secret}}x{{/secret}}',
      b: { nested: '{{a}}' },
    });
    expect(result).toEqual({
      ok: true,
      value: '{{b}} {{#secret}}x{{/secret}} / {"nested":"{{a}}"}',
    });
  });

  it('ignores inherited properties of the vars object', () => {
    expect(render('{{toString}}', {})).toMatchObject({ ok: false, error: { names: ['toString'] } });
  });
});

describe('formatValue', () => {
  it('formats bigint and nested values', () => {
    expect(formatValue(10n)).toBe('10');
    expect(formatValue([{ a: [1] }])).toBe('[{"a":[1]}]');
  });
});
