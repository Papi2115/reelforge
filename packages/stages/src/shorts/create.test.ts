/** Creating the two shorts of a film (PLAN.md#13.18): settings, brief, copied assets, git. */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  briefFileSchema,
  DEFAULT_SHORT_ANGLES,
  projectFileSchema,
  SHORTS_UNSUPPORTED_MESSAGE,
  type ProjectFile,
} from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { TestProjects, readProject } from '../testing/project.js';
import { createShortsForFilm } from './create.js';
import { CHANNELS, createFilm, createShorts } from './testing.js';

const projects = new TestProjects();
afterAll(() => {
  projects.dispose();
});

function project(dir: string): ProjectFile {
  return projectFileSchema.parse(JSON.parse(readProject(dir, 'project.json')));
}

describe('createShortsForFilm', { timeout: 60_000 }, () => {
  it('creates a 30 s and a 60 s short with the film settings and only reusable assets', async () => {
    const filmDir = await createFilm(projects, 'film');
    const filmBefore = readProject(filmDir, 'project.json');
    const shorts = await createShorts(projects, filmDir);
    const film = project(filmDir);

    expect(shorts.map((short) => [short.lengthS, short.title])).toEqual([
      [30, 'A rainbow in a glass of water — Short 30s'],
      [60, 'A rainbow in a glass of water — Short 60s'],
    ]);
    for (const short of shorts) {
      const value = project(short.dir);
      expect(path.basename(short.dir)).toBe(short.title);
      expect(value).toMatchObject({
        title: short.title,
        kind: 'short',
        format: 'portrait',
        style: film.style,
        language: film.language,
        channelId: 'voxplain',
        genrePreset: 'science',
        characters: film.characters,
        mascot: film.mascot,
        lookMode: 'voxel-only',
        researchMode: 'off',
        tensionMap: 'off',
        patternInterrupts: 'off',
        openLoops: 'off',
        revealMoments: 'off',
        parentProject: { folder: path.resolve(filmDir), title: film.title },
        short: {
          lengthS: short.lengthS,
          captions: false,
          endCardText: 'Full video on YT: Voxplain',
          angle: DEFAULT_SHORT_ANGLES[short.lengthS],
        },
      });
      expect(value.shotsPerMinute).toBeUndefined();
      expect(value.seed).toBe(film.seed + short.lengthS);

      // Props and roles come along; scenes, storyboard, words, audio and the script never do.
      expect(short.copied).toEqual(['kit-ext/props/prism.js', 'characters/roles/optician.json']);
      expect(readProject(short.dir, 'kit-ext/props/prism.js')).toBe(
        readProject(filmDir, 'kit-ext/props/prism.js'),
      );
      for (const absent of [
        'scenes/s06_red_violet.js',
        'storyboard.json',
        'timing/words.json',
        'script.txt',
        'research.md',
      ]) {
        expect(existsSync(path.join(short.dir, ...absent.split('/'))), absent).toBe(false);
      }

      const brief = briefFileSchema.parse(JSON.parse(readProject(short.dir, 'brief.json')));
      expect(brief).toMatchObject({
        language: 'en',
        targetMinutes: short.lengthS / 60,
        tone: 'friendly, hands-on',
      });
      expect(brief.notes).toContain(path.join(path.resolve(filmDir), 'script.txt'));
      const other = short.lengthS === 30 ? 60 : 30;
      expect(brief.notes).toContain(
        `(${String(other)} s) takes the angle: ${DEFAULT_SHORT_ANGLES[other]}`,
      );

      const history = await projects.history(short.dir);
      expect(history.map((entry) => [entry.kind, entry.step])).toEqual([
        ['pipeline-step', 'short-setup'],
        ['create', 'create'],
      ]);
    }
    // The film is only read.
    expect(readProject(filmDir, 'project.json')).toBe(filmBefore);
  });

  it('takes custom angles, captions and a free folder when the name is taken', async () => {
    const filmDir = await createFilm(projects, 'film again');
    await createShorts(projects, filmDir, 'taken');
    const created = await createShortsForFilm({
      parentDir: filmDir,
      projectsRoot: path.join(projects.root, 'taken'),
      channels: CHANNELS,
      options: {
        angles: { 60: 'what Newton could not see' },
        captions: true,
        create: { git: projects.git },
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.map((short) => path.basename(short.dir))).toEqual([
      'A rainbow in a glass of water — Short 30s 2',
      'A rainbow in a glass of water — Short 60s 2',
    ]);
    const sixty = project(created.value[1]?.dir ?? '');
    expect(sixty.short).toMatchObject({ captions: true, angle: 'what Newton could not see' });
  });

  it('refuses to make a short from a short', async () => {
    const filmDir = await createFilm(projects, 'film for refusal');
    const [short] = await createShorts(projects, filmDir, 'refusal');
    const again = await createShortsForFilm({
      parentDir: short?.dir ?? '',
      projectsRoot: path.join(projects.root, 'refusal'),
      channels: CHANNELS,
    });
    expect(again).toEqual({
      ok: false,
      error: 'a short is made from a film, not from another short',
    });
  });

  it('refuses a film of a world without shorts (only voxel styles and Comic have them)', async () => {
    const filmDir = await createFilm(projects, 'sketchbook film');
    const file = path.join(filmDir, 'project.json');
    writeFileSync(file, JSON.stringify({ ...project(filmDir), style: 'sketchbook' }, null, 2));
    const refused = await createShortsForFilm({
      parentDir: filmDir,
      projectsRoot: path.join(projects.root, 'sketchbook shorts'),
      channels: CHANNELS,
    });
    expect(refused).toEqual({ ok: false, error: SHORTS_UNSUPPORTED_MESSAGE });
    expect(existsSync(path.join(projects.root, 'sketchbook shorts'))).toBe(false);
  });
});
