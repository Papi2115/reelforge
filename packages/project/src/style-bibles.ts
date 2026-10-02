/**
 * Style bibles of new projects: every `<stylesDir>/<id>/STYLE.md` is copied to
 * `<project>/styles/<id>/STYLE.md`, where the runtime Claude reads it (templates/project/CLAUDE.md,
 * the storyboard and scene-build prompts). All presets are copied so a later style change still
 * finds its bible.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { writeAtomic } from './atomic.js';
import { PROJECT_STYLES_DIR, STYLE_BIBLE } from './paths.js';
import { describeUnknown, err, errorCode, ok, projectError, type Result } from './result.js';

export interface StyleBible {
  /** Style preset id (folder name). */
  readonly id: string;
  readonly file: string;
}

async function hasBible(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

/** The bibles in `stylesDir`; fails when the folder is unreadable or `requiredStyle` has none. */
export async function findStyleBibles(
  stylesDir: string,
  requiredStyle: string,
): Promise<Result<StyleBible[]>> {
  const bibles: StyleBible[] = [];
  try {
    const entries = await readdir(stylesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const file = path.join(stylesDir, entry.name, STYLE_BIBLE);
      if (await hasBible(file)) bibles.push({ id: entry.name, file });
    }
  } catch (error) {
    return err(
      projectError('io', `style bibles ${stylesDir}: ${describeUnknown(error)}`, {
        path: stylesDir,
      }),
    );
  }
  if (!bibles.some((bible) => bible.id === requiredStyle)) {
    const missing = path.join(stylesDir, requiredStyle, STYLE_BIBLE);
    return err(
      projectError('io', `the style bible of "${requiredStyle}" is missing (${missing})`, {
        path: missing,
      }),
    );
  }
  bibles.sort((first, second) => first.id.localeCompare(second.id));
  return ok(bibles);
}

/** Copies the bibles into `<projectDir>/styles/<id>/STYLE.md` (atomic writes). */
export async function copyStyleBibles(
  projectDir: string,
  bibles: readonly StyleBible[],
): Promise<void> {
  for (const bible of bibles) {
    await writeAtomic(
      path.join(projectDir, PROJECT_STYLES_DIR, bible.id, STYLE_BIBLE),
      await readFile(bible.file),
    );
  }
}
