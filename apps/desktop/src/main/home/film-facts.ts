/**
 * Facts of a project for its overview (PLAN.md#13.16 part B): where the voice came from, how many
 * shots the storyboard has and how many scenes are built, and the newest export (`out/*.mp4`).
 * Cheap reads only (a few stats and small JSON files); nothing is written. Electron-free.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { VOICEOVER_EXTENSIONS, voiceoverRecordSchema } from '@reelforge/shared';
import { z } from 'zod';
import type { FilmFacts } from '../../shared/overview-contract.js';
import { readProjectJson } from '../project-files.js';
import { GENERATED_FILE } from '../voice/vo-swap.js';

/** The name the Voiceover step records for a voice generated with ElevenLabs. */
const GENERATED_NAME = path.posix.basename(GENERATED_FILE);

const shotsSchema = z.object({ shots: z.array(z.unknown()) }).loose();

async function namesIn(folder: string): Promise<string[]> {
  try {
    return await readdir(folder);
  } catch {
    // A missing folder has no files.
    return [];
  }
}

async function voiceSource(dir: string): Promise<FilmFacts['voice']> {
  const record = await readProjectJson(dir, '.reelforge/voiceover.json', voiceoverRecordSchema);
  if (record.status === 'ok') {
    return record.data.sourceName === GENERATED_NAME ? 'elevenlabs' : 'recorded';
  }
  const audio = await namesIn(path.join(dir, 'audio'));
  return VOICEOVER_EXTENSIONS.some((extension) => audio.includes(`vo.original.${extension}`))
    ? 'recorded'
    : 'none';
}

export interface LatestExport {
  readonly file: string;
  readonly mtimeMs: number;
}

/** The newest `out/*.mp4` of the project; undefined when there is none. */
export async function latestExport(dir: string): Promise<LatestExport | undefined> {
  const out = path.join(dir, 'out');
  const videos = (await namesIn(out)).filter((name) => name.toLowerCase().endsWith('.mp4'));
  let latest: LatestExport | undefined;
  for (const name of videos) {
    const file = path.join(out, name);
    try {
      const info = await stat(file);
      if (info.isFile() && (latest === undefined || info.mtimeMs > latest.mtimeMs)) {
        latest = { file, mtimeMs: info.mtimeMs };
      }
    } catch {
      // Removed meanwhile: not an export any more.
      continue;
    }
  }
  return latest;
}

export async function filmFacts(dir: string): Promise<FilmFacts> {
  const [voice, storyboard, scenes, video] = await Promise.all([
    voiceSource(dir),
    readProjectJson(dir, 'storyboard.json', shotsSchema),
    namesIn(path.join(dir, 'scenes')),
    latestExport(dir),
  ]);
  return {
    voice,
    shots: storyboard.status === 'ok' ? storyboard.data.shots.length : 0,
    scenesBuilt: scenes.filter((name) => name.endsWith('.js')).length,
    exportFile: video === undefined ? null : path.basename(video.file),
    exportedAt: video === undefined ? null : new Date(video.mtimeMs).toISOString(),
  };
}
