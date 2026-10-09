/**
 * Test support for shorts (not exported from the package index): a film made from the golden
 * eval case (script, beats, research, a project prop, a built role, a storyboard, words and a
 * scene), a channels file with the film's channel, its two shorts, and a short's words.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  channelsFileSchema,
  type ChannelsFile,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';
import { TEMPLATE_DIR, readProject, writeProject, type TestProjects } from '../testing/project.js';
import { createShortsForFilm, type CreatedShort } from './create.js';

export const FILM_GOLDEN = [
  'brief.json',
  'research.md',
  'beats.md',
  'script.txt',
  'storyboard.json',
  'timing/words.json',
  'scenes/s06_red_violet.js',
  'kit-ext/props/prism.js',
  'characters/roles/optician.json',
] as const;

export const SHORT_SCRIPT = `Your kitchen glass is hiding a rainbow.

Fill it with water, shine a flashlight through it at an angle, and a tiny band of colors appears on the wall. No prism, no lab, nothing special.

But why does plain water do this? Isaac Newton studied the same effect in 1672 with a prism in a dark room. And one color always bends more than all the others.

The full answer is in the full video.
`;

export const SHORT_HOOKS = `## Hooks
1. Your kitchen glass is hiding a rainbow. — a familiar object with a secret
2. Water can split white light apart. — a bold physical claim
3. Newton needed a dark room for this. — a famous name and a mystery
Chosen: 1
`;

export const CHANNELS: ChannelsFile = channelsFileSchema.parse({
  version: 1,
  defaultChannelId: 'default',
  channels: [
    { id: 'default', name: 'Default', createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'voxplain', name: 'Voxplain', createdAt: '2026-10-01T00:00:00.000Z' },
  ],
});

/** The golden film on the `voxplain` channel, voxel-only, research off (simple storyboard checks). */
export async function createFilm(projects: TestProjects, name: string): Promise<string> {
  const dir = await projects.create(name, FILM_GOLDEN);
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  writeProject(
    dir,
    'project.json',
    JSON.stringify(
      {
        ...project,
        channelId: 'voxplain',
        genrePreset: 'science',
        shotsPerMinute: { min: 8, max: 12 },
        lookMode: 'voxel-only',
        researchMode: 'off',
      },
      null,
      2,
    ),
  );
  return dir;
}

export async function createShorts(
  projects: TestProjects,
  filmDir: string,
  folder = 'shorts',
): Promise<readonly CreatedShort[]> {
  const projectsRoot = path.join(projects.root, folder);
  mkdirSync(projectsRoot, { recursive: true });
  const created = await createShortsForFilm({
    parentDir: filmDir,
    projectsRoot,
    channels: CHANNELS,
    options: { create: { templateDir: TEMPLATE_DIR, git: projects.git } },
  });
  if (!created.ok) throw new Error(created.error);
  return created.value;
}

/** Seconds per word of the synthetic short narration. */
const WORD_S = 0.37;

/** `timing/words.json` of a script: one word every 0.37 s. */
export function syntheticWords(script: string): WordsFile {
  const texts = script.split(/\s+/).filter((token) => token !== '');
  return {
    version: 1,
    words: texts.map((text, index) => {
      const t = Math.round(index * WORD_S * 1000) / 1000;
      return { text, t, tEnd: Math.round((t + 0.3) * 1000) / 1000 };
    }),
  };
}

const TREATMENTS = ['title-card', 'metaphor-object', '3d-reconstruction', 'kinetic-text'] as const;

/** A short storyboard: a shot every `wordsPerShot` words (the remainder joins the last shot). */
export function shortStoryboard(words: WordsFile, wordsPerShot: number): string {
  const starts: number[] = [];
  for (let index = 0; index + wordsPerShot <= words.words.length; index += wordsPerShot) {
    starts.push(index);
  }
  const end = (words.words.at(-1)?.tEnd ?? 0) + 0.2;
  const shots: StoryboardShot[] = starts.map((start, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const next = starts[index + 1];
    return {
      id,
      t0: words.words[start]?.t ?? 0,
      t1: next === undefined ? Math.round(end * 1000) / 1000 : (words.words[next]?.t ?? 0),
      treatment: TREATMENTS[index % TREATMENTS.length] ?? 'title-card',
      intent: `Shot ${String(index + 1)}: a bold vertical image that moves.`,
      scene: `scenes/${id}.js`,
      ...(index === 0 ? { hook: true } : {}),
    };
  });
  return JSON.stringify({ version: 1, shots }, null, 2);
}
