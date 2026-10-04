import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOOK_ID,
  renderManifestSchema,
  shotLook,
  storyboardFileSchema,
  wordsFileSchema,
  type RenderManifest,
} from './index.js';

const scene = { file: 'scenes/s01.js', source: 'export const meta = {};' };

function manifest(overrides: Partial<RenderManifest> = {}): unknown {
  return {
    version: 1,
    width: 640,
    height: 360,
    fps: 30,
    seed: 7,
    shots: [
      { id: 's01', t0: 0, t1: 2, scene },
      { id: 's02', t0: 2, t1: 5, transitionIn: { type: 'crossfade', duration: 0.5 }, scene },
    ],
    ...overrides,
  };
}

function issueMessages(input: unknown): string[] {
  const result = renderManifestSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('renderManifestSchema', () => {
  it('accepts a contiguous manifest', () => {
    expect(issueMessages(manifest())).toEqual([]);
  });

  it('rejects gaps, duplicates, a transition into the first shot and over-long transitions', () => {
    const messages = issueMessages(
      manifest({
        shots: [
          { id: 's01', t0: 0, t1: 2, transitionIn: { type: 'wipe', duration: 1 }, scene },
          { id: 's01', t0: 2.5, t1: 3, transitionIn: { type: 'glitch', duration: 1 }, scene },
        ],
      }),
    );
    expect(messages).toEqual([
      'the first shot cannot transition in (no previous shot)',
      'duplicate shot id "s01"',
      'shot "s01" must start at 2 (shots are contiguous from 0)',
      'transition into "s01" is longer than the shot',
    ]);
  });

  it('requires the first shot to start at 0 and a supported version', () => {
    expect(issueMessages(manifest({ shots: [{ id: 'a', t0: 1, t1: 2, scene }] }))).toEqual([
      'shot "a" must start at 0 (shots are contiguous from 0)',
    ]);
    expect(renderManifestSchema.safeParse({ ...(manifest() as object), version: 2 }).success).toBe(
      false,
    );
  });

  it('validates palette names and colours', () => {
    expect(issueMessages(manifest({ palette: { teal: '#2ec4b6', ink: '#000000' } }))).toEqual([]);
    expect(issueMessages(manifest({ palette: { teal: 'teal', ink: '#000000' } }))).toEqual([
      'expected #rrggbb',
    ]);
  });
});

describe('wordsFileSchema', () => {
  it('rejects words that end before they start', () => {
    const ok = { version: 1, words: [{ text: 'hi', t: 1, tEnd: 1.2 }] };
    expect(wordsFileSchema.safeParse(ok).success).toBe(true);
    const bad = { version: 1, words: [{ text: 'hi', t: 1, tEnd: 0.5 }] };
    expect(wordsFileSchema.safeParse(bad).success).toBe(false);
  });
});

describe('storyboardFileSchema', () => {
  it('accepts a shot with a known treatment and rejects unknown ones', () => {
    const shot = {
      id: 's03_calc_desk',
      t0: 0,
      t1: 4,
      treatment: 'metaphor-object',
      intent: 'Doom runs on a calculator',
      scene: 'scenes/s03_calc_desk.js',
    };
    expect(storyboardFileSchema.safeParse({ version: 1, shots: [shot] }).success).toBe(true);
    const unknown = { ...shot, treatment: 'explosion' };
    expect(storyboardFileSchema.safeParse({ version: 1, shots: [unknown] }).success).toBe(false);
  });

  it('keeps files without roll/look valid and accepts A/B/C rolls with kebab-case look ids', () => {
    const shot = {
      id: 's01',
      t0: 0,
      t1: 4,
      treatment: 'title-card',
      intent: 'Hook',
      scene: 'scenes/s01.js',
    };
    const old = storyboardFileSchema.parse({ version: 1, shots: [shot] });
    expect(old.shots[0]).toEqual(shot);
    expect(old.shots[0] && shotLook(old.shots[0])).toBe(DEFAULT_LOOK_ID);
    const tagged = { ...shot, roll: 'B', look: 'retro-ui' };
    const parsed = storyboardFileSchema.parse({ version: 1, shots: [tagged] });
    expect(parsed.shots[0]).toMatchObject({ roll: 'B', look: 'retro-ui' });
    expect(parsed.shots[0] && shotLook(parsed.shots[0])).toBe('retro-ui');
    for (const bad of [{ roll: 'D' }, { look: 'Retro UI' }, { look: '' }, { look: 'retro-' }]) {
      expect(
        storyboardFileSchema.safeParse({ version: 1, shots: [{ ...shot, ...bad }] }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});
