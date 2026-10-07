/**
 * Genre preset tendencies in the stages (PLAN.md#13.8 part b, ADR-035) on fake-claude: a preset
 * project's storyboard prompt names the favoured looks and the genre's wow pace, its sound-cues
 * prompt the preferred moods; the same project without a preset gets exactly the prompts it got
 * before. Plus the pure helpers of genre.ts.
 */
import { listLooks } from '@reelforge/kit';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  soundGenrePromptVars,
  storyboardGenreCheckOptions,
  storyboardGenrePromptVars,
} from './genre.js';
import { storyboardLookVars } from './looks.js';
import { StageRunner } from './runner.js';
import { FakeAudioTools } from './testing/fake-audio.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import { TestProjects, readProject, writeProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

async function setup(name: string, inputs: readonly string[], preset: string | undefined) {
  const dir = await projects.create(name, inputs);
  if (preset !== undefined) {
    const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
    writeProject(dir, 'project.json', JSON.stringify({ ...project, genrePreset: preset }, null, 2));
  }
  // The turn writes nothing: only the prompt of the first turn matters here.
  const harness = new FakeClaudeHarness([writes({}), writes({})]);
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    audio: new FakeAudioTools(),
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
  });
  return { harness, runner };
}

async function firstPrompt(
  stage: 'storyboard' | 'sound-cues',
  name: string,
  preset: string | undefined,
): Promise<string> {
  const inputs = stage === 'storyboard' ? ['script.txt'] : ['storyboard.json'];
  const { harness, runner } = await setup(name, [...inputs, 'timing/words.json'], preset);
  await runner.run({ stage });
  return harness.specs[0]?.prompt ?? '';
}

describe('genre preset in the stages', { timeout: 60_000 }, () => {
  it('storyboard: favoured looks and the wow pace only with a preset', async () => {
    const plain = await firstPrompt('storyboard', 'storyboard plain', undefined);
    const crime = await firstPrompt('storyboard', 'storyboard crime', 'true-crime');
    expect(plain).toContain('about one per 40–90 s');
    expect(plain).not.toContain("this film's genre");
    expect(crime).toContain(
      "Looks that suit this film's genre (True crime): `blueprint`, `retro-ui`.",
    );
    expect(crime).toContain('at most 1 in this film, about one per 80–180 s');
    const hint =
      "Looks that suit this film's genre (True crime): `blueprint`, `retro-ui`. Favour them where they tell the shot as well as another look; the roll and rhythm rules below still decide.\n";
    // Everything else is the prompt of the project without a preset.
    expect(
      crime
        .replace(hint, '')
        .replace('about one per 80–180 s (the pace of this genre)', 'about one per 40–90 s'),
    ).toBe(plain);
  });

  it('sound cues: the preferred moods only with a preset', async () => {
    const plain = await firstPrompt('sound-cues', 'cues plain', undefined);
    const tech = await firstPrompt('sound-cues', 'cues tech', 'tech-explainer');
    expect(plain).not.toContain("film's genre");
    const hint =
      " This film's genre (Tech explainer) suits these moods, best first: bright-explainer, calm-tech, retro-wave; prefer them where they fit an act (the other moods stay allowed).";
    expect(tech).toContain(hint);
    expect(tech.replace(hint, '')).toBe(plain);
  });
});

describe('genre.ts helpers', () => {
  const looks = listLooks();
  const lookVars = storyboardLookVars('mixed', looks, 480);

  it('adds nothing without a known preset', () => {
    for (const project of [{}, { genrePreset: 'retired-genre' }]) {
      expect(soundGenrePromptVars(project, 'voxel-pixel-crisp640', true)).toEqual({});
      expect(storyboardGenrePromptVars(project, lookVars, looks, 480)).toEqual({});
      expect(storyboardGenreCheckOptions(project)).toEqual({});
    }
  });

  it("keeps a world's moods and skips the hint without music", () => {
    const history = { genrePreset: 'history' };
    expect(soundGenrePromptVars(history, 'sketchbook', true)).toEqual({
      genreName: 'History',
      genreMoods: 'lofi-chill, calm-tech',
    });
    expect(soundGenrePromptVars({ genrePreset: 'pop-culture' }, 'sketchbook', true)).toEqual({});
    expect(soundGenrePromptVars(history, 'voxel-pixel-crisp640', false)).toEqual({});
  });

  it('gives the storyboard hints only where the prompt has the sections', () => {
    const science = { genrePreset: 'science' };
    // Science: wow ×1 (no pace, no validator change), looks hint where 2+ looks are offered.
    expect(storyboardGenreCheckOptions(science)).toEqual({});
    expect(storyboardGenrePromptVars(science, lookVars, looks, 480)).toEqual({
      genreName: 'Science',
      genreLooks: '`diorama`, `whiteboard`, `blueprint`',
    });
    // voxel-only: no look variables, no hints.
    expect(
      storyboardGenrePromptVars(science, storyboardLookVars('voxel-only'), looks, 480),
    ).toEqual({});
    const crime = { genrePreset: 'true-crime' };
    expect(storyboardGenreCheckOptions(crime)).toEqual({ wowScale: 0.5 });
    // A world lists its own transitions (no wow list): no pace.
    const worldVars = storyboardLookVars('mixed', looks, 480, true);
    expect(storyboardGenrePromptVars(crime, worldVars, looks, 480)).not.toHaveProperty(
      'genreWowPace',
    );
    expect(storyboardGenrePromptVars(crime, lookVars, looks, 480)).toMatchObject({
      genreWowPace: 'about one per 80–180 s (the pace of this genre)',
      wowBudget: '6',
    });
  });
});
