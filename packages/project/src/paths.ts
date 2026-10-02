/** Project layout (PLAN.md §3.1), the template location and path confinement. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { err, ok, projectError, type Result } from './result.js';

export const PROJECT_JSON = 'project.json';
export const PROJECT_CLAUDE_MD = 'CLAUDE.md';
export const PROJECT_GITIGNORE = '.gitignore';

/** Folders every new project gets; `.keep` makes the tracked ones visible in git. */
export const PROJECT_FOLDERS = ['scenes', 'audio', 'timing', 'out'] as const;
export const KEEP_FILES = ['scenes/.keep', 'audio/.keep', 'timing/.keep'] as const;

/** `templates/project/` of the repo (from src/ or dist/). Bundled apps pass their own copy. */
export const DEFAULT_TEMPLATE_DIR = fileURLToPath(
  new URL('../../../templates/project/', import.meta.url),
);

/** Folder of the style bibles inside a project: `styles/<style id>/STYLE.md`. */
export const PROJECT_STYLES_DIR = 'styles';
export const STYLE_BIBLE = 'STYLE.md';

/** `styles/` of the repo (one folder per style preset). Bundled apps pass their own copy. */
export const DEFAULT_STYLES_DIR = fileURLToPath(new URL('../../../styles/', import.meta.url));

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/**
 * A file inside the project as a project-relative path with forward slashes. Rejects the project
 * folder itself, anything outside it and anything inside `.git/`.
 */
export function toProjectRelative(dir: string, file: string): Result<string> {
  const root = path.resolve(dir);
  const absolute = path.resolve(root, file);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const outside = !isInside(root, absolute);
  if (outside || relative === '.git' || relative.startsWith('.git/')) {
    return err(
      projectError('invalid-argument', `"${file}" is not a file inside the project`, {
        path: file,
      }),
    );
  }
  return ok(relative);
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
const MAX_FOLDER_NAME = 80;

/**
 * Folder name for a new project from its title: keeps letters (incl. Polish), digits and spaces;
 * drops characters Windows forbids; avoids reserved device names and trailing dots/spaces.
 */
export function projectFolderName(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex -- control characters are invalid in file names
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FOLDER_NAME)
    .replace(/[. ]+$/, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '..') return 'Untitled video';
  return WINDOWS_RESERVED.test(cleaned) ? `${cleaned} video` : cleaned;
}
