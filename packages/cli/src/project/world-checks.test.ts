/** World variety in `reelforge validate` (real run Sketchbook 2: quota errors only at the stage). */
import { WORLDS } from '@reelforge/kit';
import type { ProjectFile, StoryboardFile, StoryboardShot } from '@reelforge/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPERIMENTAL_WORLDS_ENV } from '../commands/kit-docs-world.js';
import { copyFixtureProject, runCli } from '../testing/fixture.js';
import { worldVarietyProblems } from './world-checks.js';

const LOOK = { A: 'sketch-story', B: 'sketch-graph', C: 'sketch-loud' } as const;
type Roll = keyof typeof LOOK;

/** A shot plan: roll, optional moment, page transition and continuity link. */
type Plan = readonly [Roll, (string | undefined)?, (string | undefined)?, boolean?];

/** Ten shots of 5 s (50 s): rolls alternate, no moments, no links, cut everywhere. */
const PLAIN: readonly Plan[] = [
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
];

/** The same film with a pop-up, three page transitions and a continuity link. */
const VARIED: readonly Plan[] = [
  ['A'],
  ['C', 'popup', 'page-flip'],
  ['A', undefined, undefined, true],
  ['B', undefined, 'riffle'],
  ['A'],
  ['C', undefined, 'tape-peel'],
  ['A'],
  ['B'],
  ['A'],
  ['C'],
];

function storyboard(plans: readonly Plan[]): StoryboardFile {
  const shots = plans.map(([roll, moment, style, link], index): StoryboardShot => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      t0: index * 5,
      t1: (index + 1) * 5,
      treatment: roll === 'B' ? 'data-chart-3d' : 'metaphor-object',
      intent: `shot ${id} with the taped scrap`,
      scene: `scenes/${id}.js`,
      roll,
      look: LOOK[roll],
      ...(style === undefined
        ? {}
        : { transitionIn: { type: 'wipe', duration: 0.8, style: `sketchbook-${style}` } }),
      ...(moment === undefined ? {} : { worldMoment: moment }),
      ...(link === true ? { continuity: { kind: 'shared-object', object: 'taped scrap' } } : {}),
    };
  });
  return { version: 1, shots };
}

const PROJECT: ProjectFile = {
  version: 1,
  title: 'Dancing plague',
  language: 'en',
  style: 'sketchbook',
  fps: 30,
  seed: 1,
  continuityLinks: true,
};

const codes = (project: ProjectFile, plans: readonly Plan[], experimental = true): string[] =>
  worldVarietyProblems(project, storyboard(plans), experimental).map(
    (problem) => problem.message.split(':')[0] ?? '',
  );

describe('worldVarietyProblems', () => {
  it('reports the quotas of a plain world film and passes a varied one', () => {
    expect(codes(PROJECT, PLAIN)).toEqual([
      'moment-quota',
      'transition-variety',
      'continuity-quota',
    ]);
    expect(codes(PROJECT, VARIED)).toEqual([]);
  });

  it('asks for continuity links only with the project switch on', () => {
    const unlinked = VARIED.map(([roll, moment, style]): Plan => [roll, moment, style]);
    expect(codes(PROJECT, unlinked)).toEqual(['continuity-quota']);
    expect(codes({ ...PROJECT, continuityLinks: false }, unlinked)).toEqual([]);
  });

  it('checks nothing outside a world or in a world that is off', () => {
    expect(codes({ ...PROJECT, style: 'voxel-pixel-crisp640' }, PLAIN)).toEqual([]);
    expect(codes(PROJECT, PLAIN, false)).toEqual([]);
  });

  it('checks nothing in a world that is not wired yet (styleProblems reports it)', () => {
    const unwired = WORLDS.map((world) => ({ ...world, wired: false }));
    expect(worldVarietyProblems(PROJECT, storyboard(PLAIN), true, unwired)).toEqual([]);
  });

  it('points at storyboard.json with the validator message', () => {
    const [problem] = worldVarietyProblems(PROJECT, storyboard(PLAIN), true);
    expect(problem).toMatchObject({ severity: 'error', file: 'storyboard.json', at: 'shots' });
    expect(problem?.message).toContain('this film needs at least 1');
  });
});

describe('reelforge validate on a world film', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the variety errors so Claude fixes them before the stage does', async () => {
    const project = await copyFixtureProject();
    try {
      await project.edit(
        'project.json',
        '"voxel-pixel-crisp640"',
        '"sketchbook",\n  "continuityLinks": true',
      );
      vi.stubEnv(EXPERIMENTAL_WORLDS_ENV, '1');
      await project.write('storyboard.json', JSON.stringify(storyboard(PLAIN), null, 2));
      const plain = await runCli(project.root, 'validate');
      expect(plain.code).toBe(1);
      expect(plain.stdout).toContain('moment-quota');
      expect(plain.stdout).toContain('continuity-quota');
      await project.write('storyboard.json', JSON.stringify(storyboard(VARIED), null, 2));
      const varied = await runCli(project.root, 'validate');
      expect(varied.stdout).toContain('0 errors');
      expect(varied.code).toBe(0);
    } finally {
      await project.remove();
    }
  });
});
