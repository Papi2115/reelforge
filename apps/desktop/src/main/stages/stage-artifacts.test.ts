import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { artifactPath, hasExportedVideo, latestVideo } from './stage-artifacts.js';
import { TempProjects } from './testing/fixtures.js';

const projects = new TempProjects();
afterEach(() => {
  projects.dispose();
});

describe('stage artifacts', () => {
  it('finds the newest exported video', async () => {
    const dir = projects.create({
      'out/old cut.mp4': 'a',
      'out/final ż.mp4': 'b',
      'out/thumb.png': 'c',
    });
    utimesSync(path.join(dir, 'out', 'old cut.mp4'), new Date(2020, 0, 1), new Date(2020, 0, 1));
    expect(await latestVideo(dir)).toBe('out/final ż.mp4');
    expect(await hasExportedVideo(dir)).toBe(true);
    expect(await hasExportedVideo(projects.create())).toBe(false);
  });

  it('resolves only existing outputs inside the project', async () => {
    const dir = projects.create({ 'audio/vo.original.m4a': 'x', 'audio/vo.clean.wav': 'y' });
    mkdirSync(path.join(dir, 'scenes'));
    const voiceover = await artifactPath(dir, 'voiceover');
    expect(voiceover.ok && path.basename(voiceover.value)).toBe('vo.original.m4a');
    expect((await artifactPath(dir, 'clean')).ok).toBe(true);
    const scenes = await artifactPath(dir, 'scenes');
    expect(scenes.ok && path.basename(scenes.value)).toBe('scenes');
    expect(await artifactPath(dir, 'mix')).toEqual({
      ok: false,
      error: 'The mix does not exist yet: run Sound design mixed.',
    });
    expect((await artifactPath(dir, 'video')).ok).toBe(false);
    writeFileSync(path.join(dir, 'audio', 'mix.wav'), '');
    mkdirSync(path.join(dir, 'audio', 'mixdir'));
    expect((await artifactPath(dir, 'mix')).ok).toBe(true);
  });

  it('opens the project folder itself', async () => {
    const dir = projects.create({ 'project.json': '{}' });
    const folder = await artifactPath(dir, 'project');
    expect(folder.ok && path.basename(folder.value)).toBe(path.basename(dir));
  });
});
