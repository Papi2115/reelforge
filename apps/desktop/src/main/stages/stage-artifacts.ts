/**
 * Stage outputs the sidebar's Open button hands to the system (PLAN.md#6.8): the recording, the
 * cleaned audio, the scenes folder, the mix and the newest exported video. Main resolves the
 * path from the artifact name (the renderer never sends paths) and refuses anything that is
 * missing or links out of the project, so `shell.openPath` only ever sees these files.
 */
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { FILES, inProject, readProjectSnapshot } from '@reelforge/stages';
import type { StageArtifact } from '../../shared/stages-contract.js';
import { isInsideFolder } from '../project-files.js';

const VIDEO_FILE = /\.mp4$/i;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Newest `out/*.mp4` (project-relative), if any. */
export async function latestVideo(dir: string): Promise<string | undefined> {
  let names: string[];
  try {
    names = (await readdir(path.join(dir, 'out'))).filter((name) => VIDEO_FILE.test(name));
  } catch {
    return undefined; // no out/ folder yet
  }
  const dated = await Promise.all(
    names.map(async (name) => {
      try {
        const info = await stat(path.join(dir, 'out', name));
        return info.isFile() ? { name, time: info.mtimeMs } : undefined;
      } catch {
        return undefined; // removed meanwhile
      }
    }),
  );
  const newest = dated
    .filter((entry) => entry !== undefined)
    .sort((a, b) => b.time - a.time || a.name.localeCompare(b.name))[0];
  return newest === undefined ? undefined : `out/${newest.name}`;
}

export async function hasExportedVideo(dir: string): Promise<boolean> {
  return (await latestVideo(dir)) !== undefined;
}

async function relativeOf(dir: string, artifact: StageArtifact): Promise<string | undefined> {
  switch (artifact) {
    case 'voiceover':
      return (await readProjectSnapshot(dir)).voiceover?.file;
    case 'clean':
      return FILES.voClean;
    case 'scenes':
      return FILES.scenesDir;
    case 'mix':
      return FILES.mix;
    case 'video':
      return latestVideo(dir);
  }
}

const MISSING: Readonly<Record<StageArtifact, string>> = {
  voiceover: 'No voice-over imported yet.',
  clean: 'The cleaned audio does not exist yet: run Audio cleaned.',
  scenes: 'There is no scenes folder yet.',
  mix: 'The mix does not exist yet: run Sound design mixed.',
  video: 'No exported video yet.',
};

/** Absolute (link-resolved) path of an artifact inside the project. */
export async function artifactPath(
  dir: string,
  artifact: StageArtifact,
): Promise<Result<string, string>> {
  const relative = await relativeOf(dir, artifact);
  if (relative === undefined) return err(MISSING[artifact]);
  try {
    const [root, real] = await Promise.all([realpath(dir), realpath(inProject(dir, relative))]);
    if (!isInsideFolder(root, real)) return err(`${relative} links outside the project folder.`);
    const info = await stat(real);
    const wanted = artifact === 'scenes' ? info.isDirectory() : info.isFile();
    return wanted
      ? ok(real)
      : err(`${relative} is not a ${artifact === 'scenes' ? 'folder' : 'file'}.`);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return err(MISSING[artifact]);
    }
    return err(`Cannot open ${relative}: ${errorText(error)}`);
  }
}
