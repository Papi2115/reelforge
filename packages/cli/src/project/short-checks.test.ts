/** A short's cut rules in `reelforge validate` (PLAN.md#13.18); a film is checked as before. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  endCardShot,
  type ProjectFile,
  type StoryboardFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli } from '../testing/fixture.js';
import { appWrittenScene, shortCutProblems } from './short-checks.js';

const END_CARD_TEXT = 'Full video on YT: Voxplain';

const FILM: ProjectFile = {
  version: 1,
  title: 'Doom on a calculator',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 2115,
};

const SHORT: ProjectFile = {
  ...FILM,
  kind: 'short',
  short: { lengthS: 30, captions: false, endCardText: END_CARD_TEXT },
};

/** Contiguous shots of the given lengths (the first one flagged as the hook) + the end card. */
function storyboard(lengths: readonly number[], hook = true): StoryboardFile {
  let t = 0;
  const shots = lengths.map((length, index): StoryboardShot => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const shot: StoryboardShot = {
      id,
      t0: t,
      t1: Math.round((t + length) * 1000) / 1000,
      treatment: 'title-card',
      intent: `shot ${id}`,
      scene: `scenes/${id}.js`,
      ...(index === 0 && hook ? { hook: true } : {}),
    };
    t = shot.t1;
    return shot;
  });
  return { version: 1, shots: [...shots, endCardShot(t, END_CARD_TEXT)] };
}

const codes = (problems: readonly { message: string }[]): string[] =>
  problems.map((problem) => problem.message.split(':')[0] ?? '');

describe('shortCutProblems', () => {
  it('passes a fast-cut short (its end card exempt) and checks nothing in a film', () => {
    const fast = storyboard([2, 2.5, 2, 3, 2, 2.5, 2, 2, 3, 2.5, 2.5, 2]);
    expect(shortCutProblems(SHORT, fast)).toEqual([]);
    expect(shortCutProblems(FILM, storyboard([6, 8, 9]))).toEqual([]);
  });

  it('reports the cut rules of a slow short at storyboard.json', () => {
    const problems = shortCutProblems(SHORT, storyboard([4, 2, 6], false));
    expect(codes(problems)).toEqual([
      'shot-length',
      'shot-length',
      'short-hook-length',
      'short-hook-flag',
      'short-shot-rate',
    ]);
    expect(problems[0]).toMatchObject({
      severity: 'error',
      file: 'storyboard.json',
      at: 'shots[0]',
    });
    expect(problems[0]?.fix).toContain('never add or edit the end card');
  });

  it('marks only a short end card as a scene the app writes', () => {
    const card = endCardShot(10, END_CARD_TEXT);
    expect(appWrittenScene(SHORT, card)).toBe(true);
    expect(appWrittenScene(FILM, card)).toBe(false);
    expect(appWrittenScene(SHORT, { ...card, endCard: false })).toBe(false);
    expect(appWrittenScene(undefined, card)).toBe(false);
  });
});

describe('reelforge validate on a short', () => {
  it('reports the cut rules and never asks for the end card scene', async () => {
    const project = await copyFixtureProject();
    try {
      await project.edit(
        'project.json',
        '"seed": 2115',
        `"seed": 2115,\n  "kind": "short",\n  "short": { "lengthS": 30, "captions": false, "endCardText": "${END_CARD_TEXT}" }`,
      );
      // The fixture's two shots (2.2 s, 5.3 s) are a film's cuts.
      const film = JSON.parse(
        await readFile(path.join(project.root, 'storyboard.json'), 'utf8'),
      ) as StoryboardFile;
      const lastT1 = film.shots.at(-1)?.t1 ?? 0;
      const withCard = { ...film, shots: [...film.shots, endCardShot(lastT1, END_CARD_TEXT)] };
      await project.write('storyboard.json', JSON.stringify(withCard, null, 2));
      const slow = await runCli(project.root, 'validate');
      expect(slow.code).toBe(1);
      expect(slow.stdout).toContain('short-shot-rate');
      expect(slow.stdout).toContain('shot-length');
      expect(slow.stdout).not.toContain('end_card.js does not exist');

      const [first, second] = film.shots;
      if (first === undefined || second === undefined) throw new Error('fixture shots');
      const recut: StoryboardFile = {
        version: 1,
        shots: [
          { ...first, hook: true },
          { ...second, t1: 4.8 },
          { ...second, id: 's03', t0: 4.8, t1: 7.5, scene: 'scenes/s03.js' },
          endCardShot(7.5, END_CARD_TEXT),
        ],
      };
      await project.write('storyboard.json', JSON.stringify(recut, null, 2));
      const fast = await runCli(project.root, 'validate');
      expect(fast.stdout).toContain('0 errors');
      expect(fast.stdout).toContain('scenes/s03.js does not exist yet');
      expect(fast.stdout).not.toContain('end_card.js does not exist');
      expect(fast.code).toBe(0);
    } finally {
      await project.remove();
    }
  });
});
