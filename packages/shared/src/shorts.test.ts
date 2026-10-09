import { describe, expect, it } from 'vitest';
import { projectFileSchema } from './project.js';
import {
  captionsOn,
  endCardShot,
  isEndCardShot,
  isShort,
  shortEndCardText,
  shortTargetSeconds,
  shortTargetWords,
  supportsShorts,
  withoutEndCard,
} from './shorts.js';
import { storyboardShotSchema } from './storyboard.js';

const FILM = {
  version: 1,
  title: 'A film',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 7,
} as const;

describe('shorts in project.json', () => {
  it('parses a film without the fields (absent kind = film)', () => {
    const film = projectFileSchema.parse(FILM);
    expect(film.kind).toBeUndefined();
    expect(isShort(film)).toBe(false);
    expect(shortTargetSeconds(film)).toBeUndefined();
  });

  it('parses a short with its parent and settings', () => {
    const short = projectFileSchema.parse({
      ...FILM,
      kind: 'short',
      parentProject: { folder: 'C:/Videos/A film', title: 'A film' },
      short: { lengthS: 30, captions: false, endCardText: shortEndCardText(' Voxplain ') },
    });
    expect(isShort(short)).toBe(true);
    expect(shortTargetSeconds(short)).toBe(30);
    expect(short.short?.endCardText).toBe('Full video on YT: Voxplain');
  });

  it('rejects a length other than 30 or 60 and a short without settings is not a short', () => {
    const bad = {
      ...FILM,
      kind: 'short',
      short: { lengthS: 45, captions: false, endCardText: 'x' },
    };
    expect(projectFileSchema.safeParse(bad).success).toBe(false);
    expect(isShort(projectFileSchema.parse({ ...FILM, kind: 'short' }))).toBe(false);
  });

  it('plans about 2.6 words per second of narration (end card excluded)', () => {
    expect(shortTargetWords(30)).toBe(73);
    expect(shortTargetWords(60)).toBe(151);
  });
});

describe('end card shot', () => {
  it('is a valid 2 s shot after the narration, marked endCard', () => {
    const shot = endCardShot(27.84, 'Full video on YT: Voxplain');
    expect(storyboardShotSchema.parse(shot)).toMatchObject({
      id: 'end_card',
      t0: 27.84,
      t1: 29.84,
      scene: 'scenes/end_card.js',
      endCard: true,
    });
  });

  it('withoutEndCard drops only trailing end cards', () => {
    const shots = [
      { id: 'a' },
      { id: 'b', endCard: true },
      { id: 'c' },
      { id: 'd', endCard: true },
    ];
    expect(withoutEndCard(shots).map((shot) => shot.id)).toEqual(['a', 'b', 'c']);
    expect(withoutEndCard([])).toEqual([]);
  });

  it('isEndCardShot is true only for the marked end card', () => {
    expect(isEndCardShot(endCardShot(10, 'Full video on YT: Voxplain'))).toBe(true);
    expect(isEndCardShot({ endCard: false })).toBe(false);
    expect(isEndCardShot({})).toBe(false);
  });
});

describe('shorts support and captions', () => {
  it('offers shorts for the voxel styles and Comic only', () => {
    for (const style of ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480', 'comic']) {
      expect(supportsShorts(style), style).toBe(true);
    }
    for (const style of ['sketchbook', 'game-b1', 'game-b2']) {
      expect(supportsShorts(style), style).toBe(false);
    }
  });

  it('turns captions on only for a short that asks for them', () => {
    const settings = { lengthS: 30, captions: true, endCardText: 'Full video on YT: X' } as const;
    expect(captionsOn({ ...FILM, kind: 'film' })).toBe(false);
    expect(captionsOn({ ...FILM, short: settings })).toBe(false);
    expect(captionsOn({ ...FILM, kind: 'short', short: settings })).toBe(true);
    expect(captionsOn({ ...FILM, kind: 'short', short: { ...settings, captions: false } })).toBe(
      false,
    );
  });
});
