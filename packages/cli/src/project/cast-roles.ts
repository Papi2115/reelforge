/**
 * The project's roles and accessory extensions (`characters/roles/<id>.json`,
 * `characters/accessories/<id>.json`, PLAN.md#12.20, ADR-026): read once per command and inlined
 * into every render manifest (`castRoles`), so preview, export and the CLI resolve the same
 * `kit.cast.person('<id>')`. Only regular `.json` files with camelCase names inside the project.
 */
import { existsSync, realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CAST_ACCESSORIES_DIR,
  CAST_FILE_ID_PATTERN,
  CAST_ROLES_DIR,
  type CastFileSourceEntry,
  type ManifestCastRoles,
} from '@reelforge/shared';
import { describeUnknown, ProjectError } from '../errors.js';
import { isInside, projectPath } from './paths.js';

export interface CastRoleFiles {
  readonly roles: readonly CastFileSourceEntry[];
  readonly accessories: readonly CastFileSourceEntry[];
  /** Project-relative `.json` files skipped because their name is not a camelCase id. */
  readonly ignored: readonly string[];
}

export const NO_CAST_ROLES: CastRoleFiles = { roles: [], accessories: [], ignored: [] };

async function readFolder(
  root: string,
  folder: string,
): Promise<{ files: CastFileSourceEntry[]; ignored: string[] }> {
  const directory = projectPath(root, folder);
  if (!existsSync(directory)) return { files: [], ignored: [] };
  if (!isInside(realpathSync(root), realpathSync(directory))) {
    throw new ProjectError(
      `${folder} points outside the project folder`,
      `make ${folder} a normal folder inside the project`,
    );
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const files: CastFileSourceEntry[] = [];
  const ignored: string[] = [];
  for (const name of names) {
    const id = name.slice(0, -'.json'.length);
    const file = `${folder}/${name}`;
    if (!CAST_FILE_ID_PATTERN.test(id)) {
      ignored.push(file);
      continue;
    }
    let source: string;
    try {
      source = await readFile(path.join(directory, name), 'utf8');
    } catch (error) {
      throw new ProjectError(`cannot read ${file}: ${describeUnknown(error)}`, 'check the file');
    }
    if (source.trim() !== '') files.push({ id, file, source });
  }
  return { files, ignored };
}

export async function readCastRoles(root: string): Promise<CastRoleFiles> {
  const [roles, accessories] = await Promise.all([
    readFolder(root, CAST_ROLES_DIR),
    readFolder(root, CAST_ACCESSORIES_DIR),
  ]);
  return {
    roles: roles.files,
    accessories: accessories.files,
    ignored: [...roles.ignored, ...accessories.ignored],
  };
}

/** The manifest field, or undefined without any file (manifests stay byte-identical). */
export function manifestCastRoles(files: CastRoleFiles): ManifestCastRoles | undefined {
  if (files.roles.length === 0 && files.accessories.length === 0) return undefined;
  return { roles: [...files.roles], accessories: [...files.accessories] };
}
