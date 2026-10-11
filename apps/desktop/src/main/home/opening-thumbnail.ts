/**
 * "Thumbnail from the opening frame" (PLAN.md#14.18, brief 11 addendum): a Grim Ink film opens on
 * a title card that is a ready thumbnail. Each export saves it as `out/opening-frame.png`
 * (1280x720); when the project has no thumbnail yet, it becomes `publish/thumbnail.png` (an
 * uploaded thumbnail always wins and is never replaced). The overview tells the two apart by
 * content: the thumbnail is "from the opening frame" while it is byte-identical to that still.
 */
import { copyFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { OPENING_THUMBNAIL_FILE } from '@reelforge/pipeline';

/** Uploaded thumbnail files, best first (the same list the overview reads). */
const THUMBNAIL_FILES = [
  'publish/thumbnail.png',
  'publish/thumbnail.jpg',
  'publish/thumbnail.jpeg',
] as const;

/** Project-relative path of the export's opening still. */
export const OPENING_FRAME = `out/${OPENING_THUMBNAIL_FILE}`;

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false; // missing
  }
}

/**
 * Makes the export's opening still the project thumbnail when there is none; true when it did.
 * Copy next to it, then rename: the thumbnail never exists half-written.
 */
export async function adoptOpeningThumbnail(projectDir: string, still: string): Promise<boolean> {
  for (const relative of THUMBNAIL_FILES) {
    if (await exists(path.join(projectDir, relative))) return false;
  }
  const target = path.join(projectDir, 'publish', 'thumbnail.png');
  const temporary = `${target}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await copyFile(still, temporary);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return true;
}

/** Where a thumbnail came from: the opening frame (still identical to it) or an upload. */
export async function thumbnailOrigin(
  projectDir: string,
  thumbnail: string,
): Promise<'opening-frame' | 'uploaded'> {
  const still = path.join(projectDir, OPENING_FRAME);
  if (path.extname(thumbnail).toLowerCase() !== '.png' || !(await exists(still))) {
    return 'uploaded';
  }
  const [left, right] = await Promise.all([readFile(thumbnail), readFile(still)]);
  return left.equals(right) ? 'opening-frame' : 'uploaded';
}
