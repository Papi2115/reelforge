import { lintScene } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import {
  MAX_PLACEHOLDER_INTENT_CHARS,
  placeholderSceneSource,
  type PlaceholderShot,
} from './placeholder-scene.js';

const shot: PlaceholderShot = {
  id: 's005_unbelievable',
  t0: 12,
  t1: 15.4,
  treatment: 'title-card',
  intent: 'The “unbelievable” part: it’s 61 KB and it still runs Doom.',
};

describe('placeholderSceneSource', () => {
  it('passes the determinism and contract lint', () => {
    const source = placeholderSceneSource(shot);
    expect(lintScene(source, { filename: 'scenes/s005_unbelievable.js' })).toEqual([]);
  });

  it('is the same text for the same shot and shows its id, intent and treatment', () => {
    const source = placeholderSceneSource(shot);
    expect(placeholderSceneSource({ ...shot })).toBe(source);
    expect(source).toContain('export const meta = {"id":"s005_unbelievable"');
    expect(source).toContain('const LABEL = "s005 unbelievable";');
    expect(source).toContain(
      `const INTENT = ${JSON.stringify('The "unbelievable" part: it\'s 61 KB and it still runs Doom.')};`,
    );
    expect(source).toContain('const DETAIL = "title-card · 3.4 s";');
    expect(source).toContain("'not built yet'");
  });

  it('keeps hostile intents inside string literals and cuts long ones', () => {
    const hostile = placeholderSceneSource({
      ...shot,
      intent: `"; Math.random(); fetch("x"); // ${'long words '.repeat(40)}`,
    });
    expect(lintScene(hostile, { filename: 'scenes/s.js' })).toEqual([]);
    const intent = /const INTENT = (".*");/.exec(hostile)?.[1];
    if (intent === undefined) throw new Error('no INTENT literal');
    const text: unknown = JSON.parse(intent);
    if (typeof text !== 'string') throw new Error('INTENT is not a string');
    expect(text.length).toBeLessThanOrEqual(MAX_PLACEHOLDER_INTENT_CHARS);
    expect(text.length).toBeGreaterThan(MAX_PLACEHOLDER_INTENT_CHARS - 10);
    expect(text.endsWith('...')).toBe(true);
    expect(text.startsWith('"; Math.random();')).toBe(true);
  });
});
