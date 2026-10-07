/**
 * The engine assembles straight into `audio/vo.original.wav`, but the app takes a new voice-over
 * in through the Voiceover step (archive of the previous take, `.reelforge/voiceover.json`, the
 * fit report, "out of date" downstream, autocommit) exactly like a manual import. So around an
 * engine run the current file is held aside (a copy) and put back afterwards; the assembled file
 * is moved to `.reelforge/voice/elevenlabs-voiceover.wav`, which the Voiceover step then imports.
 * Invariant: after `release`, `audio/vo.original.wav` is exactly what it was before `hold`. A held
 * copy left by a crash is put back by the next `hold`.
 */
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { VOICE_FILES } from '@reelforge/pipeline';
import { inProject } from '@reelforge/stages';

export const VOICE_WORK_DIR = '.reelforge/voice';
const HELD_FILE = `${VOICE_WORK_DIR}/held-vo.original.wav`;
/** The file name the Voiceover step records as the source ("imported elevenlabs-voiceover.wav"). */
export const GENERATED_FILE = `${VOICE_WORK_DIR}/elevenlabs-voiceover.wav`;

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    () => false,
  );
}

export interface HeldVoiceover {
  readonly dir: string;
  /** A copy of the previous vo.original.wav was taken. */
  readonly held: boolean;
}

/** Copies the current vo.original.wav aside (after restoring one a crash left behind). */
export async function holdOriginal(dir: string): Promise<HeldVoiceover> {
  const original = inProject(dir, VOICE_FILES.original);
  const heldFile = inProject(dir, HELD_FILE);
  await mkdir(path.dirname(heldFile), { recursive: true });
  if (await exists(heldFile)) await rename(heldFile, original);
  if (!(await exists(original))) return { dir, held: false };
  await copyFile(original, heldFile);
  return { dir, held: true };
}

/**
 * Puts the previous vo.original.wav back. On success the assembled file is moved to
 * GENERATED_FILE first; returns its absolute path (null on failure or when none was written).
 */
export async function releaseOriginal(
  hold: HeldVoiceover,
  assembled: boolean,
): Promise<string | null> {
  const original = inProject(hold.dir, VOICE_FILES.original);
  const heldFile = inProject(hold.dir, HELD_FILE);
  let generated: string | null = null;
  if (assembled && (await exists(original))) {
    generated = inProject(hold.dir, GENERATED_FILE);
    await rename(original, generated);
  }
  if (hold.held) await rename(heldFile, original);
  else await rm(original, { force: true });
  return generated;
}
