/**
 * The pace of `page.write` (real test film 2: lettering too slow for 4-5 s shots, so content was
 * cut or drawn as home-made strokes): a 12-letter word in <= 1.2 s at cap heights up to 40 in
 * every hand and pen, `speed` up to 2x, a quick label pace, seeded uneven gaps kept, `until`
 * unchanged; and the source check that flags letters drawn as strokes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeMarks, writePace, type Mark, type ToolName } from '../draw/marks.js';
import type { HandName } from '../draw/lettering.js';
import { strokeLetteringFindings } from '../lint.js';

const WORD = 'MUSICIANSHIP';

function duration(
  text: string,
  size: number,
  hand: HandName,
  tool: ToolName,
  extra: { speed?: number; quick?: boolean; until?: number } = {},
): { end: number; marks: Mark[] } {
  const marks: Mark[] = [];
  const pace = extra.until === undefined ? writePace(size, hand, extra.speed, extra.quick) : {};
  const end = writeMarks(marks, text, {
    x: 0,
    y: 0,
    size,
    hand,
    tool,
    seed: 3,
    t0: 0,
    t1: extra.until,
    ...pace,
  });
  return { end, marks };
}

describe('page.write pace', () => {
  const hands: [HandName, ToolName][] = [
    ['print', 'felt'],
    ['print', 'bic'],
    ['print', 'red'],
    ['scrawl', 'pencil'],
    ['scrawl', 'fine'],
    ['marker', 'marker'],
  ];
  it.each(hands)('writes a 12-letter word in <= 1.2 s at sizes 14-40 (%s, %s)', (hand, tool) => {
    for (const size of [14, 20, 30, 40]) {
      const { end } = duration(WORD, size, hand, tool);
      expect(end, `${hand} ${tool} ${String(size)}`).toBeLessThanOrEqual(1.2);
      expect(end).toBeGreaterThan(0.5);
    }
  });

  it('goes up to twice as fast with speed 2, faster still with quick', () => {
    const normal = duration(WORD, 30, 'print', 'felt').end;
    expect(duration(WORD, 30, 'print', 'felt', { speed: 2 }).end).toBeCloseTo(normal / 2, 5);
    expect(duration(WORD, 30, 'print', 'felt', { quick: true }).end).toBeLessThan(normal * 0.65);
  });

  it('keeps the hand-written feel: uneven seeded gaps, the same every time', () => {
    const { marks } = duration('OVER HEATED', 30, 'print', 'felt');
    const gaps = marks.slice(1).map((mark, i) => {
      const previous = marks[i];
      return previous ? mark.t0 - (previous.t0 + previous.dur) : 0;
    });
    expect(new Set(gaps.map((gap) => gap.toFixed(4))).size).toBeGreaterThan(gaps.length / 2);
    expect(duration('OVER HEATED', 30, 'print', 'felt').marks).toEqual(marks);
  });

  it('leaves the pace inside an explicit until budget as it was', () => {
    const { end, marks } = duration(WORD, 30, 'print', 'felt', { until: 2.5 });
    expect(end).toBe(2.5);
    const legacy: Mark[] = [];
    writeMarks(legacy, WORD, {
      x: 0,
      y: 0,
      size: 30,
      hand: 'print',
      tool: 'felt',
      seed: 3,
      t0: 0,
      t1: 2.5,
    });
    expect(marks).toEqual(legacy);
  });
});

describe('letters drawn as strokes (source check)', () => {
  const kitRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
  const read = (...parts: string[]): string => readFileSync(path.join(kitRoot, ...parts), 'utf8');

  it('flags the glyph table and the per-character stroke loop of real film 2 (s09)', () => {
    const findings = strokeLetteringFindings(
      read('test', 'fixtures', 'sketchbook-run2', 's09_fifteen_a_day.js'),
    );
    expect(findings.map((finding) => finding.rule)).toEqual(['glyph-table', 'char-strokes']);
    expect(findings[0]?.message).toMatch(/use page.write/);
  });

  it('passes every example scene and the other real scenes', () => {
    const files = [
      ...readdirSync(path.join(kitRoot, 'examples', 'sketchbook'))
        .filter((name) => name.endsWith('.js'))
        .map((name) => ['examples', 'sketchbook', name]),
      ...readdirSync(path.join(kitRoot, 'examples', 'sketchbook', 'open')).map((name) => [
        'examples',
        'sketchbook',
        'open',
        name,
      ]),
      ...readdirSync(path.join(kitRoot, 'test', 'fixtures', 'sketchbook-run2'))
        .filter((name) => name.endsWith('.js') && !name.startsWith('s09'))
        .map((name) => ['test', 'fixtures', 'sketchbook-run2', name]),
    ];
    for (const parts of files)
      expect(strokeLetteringFindings(read(...parts)), parts.join('/')).toEqual([]);
  });
});
