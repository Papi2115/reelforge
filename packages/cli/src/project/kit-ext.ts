/**
 * The project's own props (`kit-ext/props/<name>.js`, PLAN.md#7.4): read once per command and
 * inlined into every render manifest (`kitExtensions`), so preview, export and the CLI register
 * the same `ctx.kit.props.<name>`. Only regular files with camelCase names inside the project.
 */
import { existsSync, realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  KIT_EXT_PROPS_DIR,
  PROP_NAME_PATTERN,
  propExtensionFile,
  type KitExtensionSource,
} from '@reelforge/shared';
import { describeUnknown, ProjectError } from '../errors.js';
import { isInside, projectPath } from './paths.js';

export interface KitExtensionFiles {
  readonly extensions: readonly KitExtensionSource[];
  /** Project-relative `.js` files skipped because their name is not a camelCase prop name. */
  readonly ignored: readonly string[];
}

export const NO_KIT_EXTENSIONS: KitExtensionFiles = { extensions: [], ignored: [] };

export async function readKitExtensions(root: string): Promise<KitExtensionFiles> {
  const directory = projectPath(root, KIT_EXT_PROPS_DIR);
  if (!existsSync(directory)) return NO_KIT_EXTENSIONS;
  if (!isInside(realpathSync(root), realpathSync(directory))) {
    throw new ProjectError(
      `${KIT_EXT_PROPS_DIR} points outside the project folder`,
      `make ${KIT_EXT_PROPS_DIR} a normal folder inside the project`,
    );
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();
  const extensions: KitExtensionSource[] = [];
  const ignored: string[] = [];
  for (const fileName of files) {
    const name = fileName.slice(0, -'.js'.length);
    const file = propExtensionFile(name);
    if (!PROP_NAME_PATTERN.test(name)) {
      ignored.push(file);
      continue;
    }
    let source: string;
    try {
      source = await readFile(path.join(directory, fileName), 'utf8');
    } catch (error) {
      throw new ProjectError(`cannot read ${file}: ${describeUnknown(error)}`, 'check the file');
    }
    if (source.trim() !== '') extensions.push({ name, file, source });
  }
  return { extensions, ignored };
}
