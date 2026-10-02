/**
 * Files of the Sound panel (PLAN.md#8.2): the library listing (built-in recipes + the user's files
 * in `audio/sfx`, `audio/ambience`, `audio/music`), importing picked files into those folders
 * (copied, never moved; a taken name gets ` (2)`), and the short preview WAVs of built-in recipes
 * (synthesized in main, cached under `.reelforge/cache/sound-preview/`).
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  MIX_SAMPLE_RATE,
  hashSeed,
  synthesizeAmbience,
  writeSfxWav,
  writeWavAtomic,
  type AmbienceRecipe,
  type SfxRecipe,
} from '@reelforge/pipeline';
import {
  BUILTIN_AMBIENCE_NAMES,
  SOUND_FILE_EXTENSIONS,
  SOUND_FOLDERS,
  SOUND_KINDS,
  type LibrarySound,
  type SoundKind,
} from '../../shared/sound-contract.js';
import { BUILTIN_SFX_NAMES } from '../../shared/timeline-contract.js';

export const SOUND_PREVIEW_DIR = '.reelforge/cache/sound-preview';
/** Length of a built-in ambience preview (s). */
export const AMBIENCE_PREVIEW_S = 4;

const AUDIO_FILE = new RegExp(`\\.(${SOUND_FILE_EXTENSIONS.join('|')})$`, 'i');

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function filesOf(dir: string, kind: SoundKind): Promise<LibrarySound[]> {
  const folder = SOUND_FOLDERS[kind];
  let names: string[];
  try {
    names = await readdir(path.join(dir, ...folder.split('/')));
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return names
    .filter((name) => AUDIO_FILE.test(name) && !/[\\/]/.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ source: 'file', kind, file: `${folder}/${name}` }));
}

/** Built-in recipes first, then the user's files per kind (sorted). */
export async function listLibrary(dir: string): Promise<LibrarySound[]> {
  const builtins: LibrarySound[] = [
    ...BUILTIN_SFX_NAMES.map((name): LibrarySound => ({ source: 'builtin', kind: 'sfx', name })),
    ...BUILTIN_AMBIENCE_NAMES.map((name): LibrarySound => ({
      source: 'builtin',
      kind: 'ambience',
      name,
    })),
  ];
  const files = await Promise.all(SOUND_KINDS.map((kind) => filesOf(dir, kind)));
  return [...builtins, ...files.flat()];
}

/** A file name that is safe on Windows and free in `folder` (`name (2).wav`, …). */
export async function freeName(folder: string, original: string): Promise<string> {
  const extension = path.extname(original).toLowerCase();
  const stem =
    path
      .basename(original, path.extname(original))
      .replace(/[<>:"/\\|?*]/g, ' ')
      // eslint-disable-next-line no-control-regex -- strips control characters from file names
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '') || 'sound';
  for (let index = 1; ; index += 1) {
    const name = index === 1 ? `${stem}${extension}` : `${stem} (${String(index)})${extension}`;
    try {
      await stat(path.join(folder, name));
    } catch (error) {
      if (isMissing(error)) return name;
      throw error;
    }
  }
}

/** Copies picked audio files into the kind's folder; returns project-relative paths. */
export async function importSoundFiles(
  dir: string,
  kind: SoundKind,
  sources: readonly string[],
): Promise<{ readonly files: string[]; readonly skipped: string[] }> {
  const relativeFolder = SOUND_FOLDERS[kind];
  const folder = path.join(dir, ...relativeFolder.split('/'));
  await mkdir(folder, { recursive: true });
  const files: string[] = [];
  const skipped: string[] = [];
  for (const source of sources) {
    if (!AUDIO_FILE.test(source)) {
      skipped.push(path.basename(source));
      continue;
    }
    const name = await freeName(folder, path.basename(source));
    await copyFile(source, path.join(folder, name));
    files.push(`${relativeFolder}/${name}`);
  }
  return { files, skipped };
}

function isSfxRecipe(name: string): name is SfxRecipe {
  return (BUILTIN_SFX_NAMES as readonly string[]).includes(name);
}

function isAmbienceRecipe(name: string): name is AmbienceRecipe {
  return (BUILTIN_AMBIENCE_NAMES as readonly string[]).includes(name);
}

/**
 * Project-relative WAV to play for a library sound: user files play as they are, built-in
 * recipes are synthesized once (same seed every time, so the preview is what a cue sounds like).
 */
export async function previewFile(
  dir: string,
  sound: LibrarySound,
): Promise<
  { readonly ok: true; readonly file: string } | { readonly ok: false; readonly message: string }
> {
  if (sound.source === 'file') return { ok: true, file: sound.file };
  const relative = `${SOUND_PREVIEW_DIR}/${sound.kind}-${sound.name}.wav`;
  const target = path.join(dir, ...relative.split('/'));
  try {
    await stat(target);
    return { ok: true, file: relative };
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  await mkdir(path.dirname(target), { recursive: true });
  const seed = hashSeed(`${sound.name}@preview`);
  if (sound.kind === 'sfx' && isSfxRecipe(sound.name)) {
    const written = await writeSfxWav(target, sound.name, { seed });
    return written.ok
      ? { ok: true, file: relative }
      : { ok: false, message: written.error.message };
  }
  if (sound.kind === 'ambience' && isAmbienceRecipe(sound.name)) {
    const loop = synthesizeAmbience(sound.name, { seed });
    const frames = AMBIENCE_PREVIEW_S * MIX_SAMPLE_RATE;
    const written = await writeWavAtomic(
      target,
      [loop.left.subarray(0, frames), loop.right.subarray(0, frames)],
      MIX_SAMPLE_RATE,
      'pcm16',
    );
    return written.ok
      ? { ok: true, file: relative }
      : { ok: false, message: written.error.message };
  }
  return { ok: false, message: `${sound.name} is not a built-in ${sound.kind} sound` };
}
