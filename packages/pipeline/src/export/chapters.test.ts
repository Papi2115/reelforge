import { describe, expect, it } from 'vitest';
import { buildChaptersTxt, formatChapterTime } from './chapters.js';
import { safeOutputName } from './output-name.js';

describe('buildChaptersTxt', () => {
  it('formats YouTube chapter lines', () => {
    const text = buildChaptersTxt(
      [
        { title: 'Intro', t: 0 },
        { title: '  The   calculator ', t: 12.7 },
        { title: 'Doom runs', t: 75 },
      ],
      600,
    );
    expect(text).toEqual({ ok: true, value: '0:00 Intro\n0:12 The calculator\n1:15 Doom runs\n' });
  });

  it('uses hours for videos of an hour or more', () => {
    const text = buildChaptersTxt(
      [
        { title: 'A', t: 0 },
        { title: 'B', t: 65 },
        { title: 'C', t: 3725 },
      ],
      3800,
    );
    expect(text.ok && text.value).toBe('0:00:00 A\n0:01:05 B\n1:02:05 C\n');
  });

  it.each([
    [
      'fewer than 3 chapters',
      [
        { title: 'A', t: 0 },
        { title: 'B', t: 20 },
      ],
      /at least 3/,
    ],
    [
      'a first chapter after 0:00',
      [
        { title: 'A', t: 2 },
        { title: 'B', t: 20 },
        { title: 'C', t: 40 },
      ],
      /0:00/,
    ],
    [
      'a chapter shorter than 10 s',
      [
        { title: 'A', t: 0 },
        { title: 'B', t: 20 },
        { title: 'C', t: 25 },
      ],
      /"B" lasts under 10 s/,
    ],
    [
      'a last chapter shorter than 10 s',
      [
        { title: 'A', t: 0 },
        { title: 'B', t: 20 },
        { title: 'C', t: 55 },
      ],
      /"C"/,
    ],
    [
      'an empty title',
      [
        { title: 'A', t: 0 },
        { title: ' ', t: 20 },
        { title: 'C', t: 40 },
      ],
      /empty title/,
    ],
  ])('rejects %s', (_label, chapters, message) => {
    const text = buildChaptersTxt(chapters, 60);
    expect(text.ok).toBe(false);
    expect(!text.ok && text.error.message).toMatch(message);
  });

  it('formats times', () => {
    expect(formatChapterTime(0, false)).toBe('0:00');
    expect(formatChapterTime(599.9, false)).toBe('9:59');
    expect(formatChapterTime(4000, false)).toBe('66:40');
    expect(formatChapterTime(4000, true)).toBe('1:06:40');
  });
});

describe('safeOutputName', () => {
  it.each([
    ['How Doom runs on a calculator', 'How Doom runs on a calculator'],
    ['What? A <bad>: name/with\\slashes*|', 'What A bad name with slashes'],
    ['trailing dots...', 'trailing dots'],
    ['con', 'video'],
    ['NUL.part', 'video'],
    ['   ', 'video'],
    ['Zażółć gęślą jaźń', 'Zażółć gęślą jaźń'],
  ])('%j -> %j', (title, expected) => {
    expect(safeOutputName(title)).toBe(expected);
  });

  it('clips long titles', () => {
    expect(safeOutputName('a'.repeat(300))).toHaveLength(120);
  });
});
