/**
 * The project's own modules, read once per command and inlined into every render manifest
 * (`kitExtensions`), so preview, export and the CLI register the same things: props
 * (`kit-ext/props/<name>.js` -> `ctx.kit.props.<name>`, PLAN.md#7.4) and the Grim Ink world's
 * people / places (`kit-ext/people|places/<id>.js` -> `kit.people|places.<id>`, PLAN.md#14.8,
 * manifest `kind`) and its shared libraries (`kit-ext/lib/<name>.js` -> `kit.lib.<name>`,
 * PLAN.md#14.19). Only regular files with camelCase names inside the project; people, places and
 * libraries are limited in count and size (INK_MODULE_LIMITS).
 */
import { existsSync, realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  INK_MODULE_LIMITS,
  KIT_EXTENSION_DIRS,
  KIT_EXTENSION_KINDS,
  kitExtensionFile,
  PROP_NAME_PATTERN,
  type KitExtensionKind,
  type KitExtensionSource,
} from '@reelforge/shared';
import { describeUnknown, ProjectError } from '../errors.js';
import { isInside, projectPath } from './paths.js';

export interface KitExtensionFiles {
  /** Props first (no `kind`, as before), then people, places and libraries (`kind` set). */
  readonly extensions: readonly KitExtensionSource[];
  /** Project-relative `.js` files skipped because their name is not a camelCase name. */
  readonly ignored: readonly string[];
}

export const NO_KIT_EXTENSIONS: KitExtensionFiles = { extensions: [], ignored: [] };

/** The modules of one kind of a module list (props: those without `kind`). */
export function extensionsOfKind(
  extensions: readonly KitExtensionSource[],
  kind: KitExtensionKind,
): KitExtensionSource[] {
  return extensions.filter((extension) => (extension.kind ?? 'props') === kind);
}

function checkLimits(kind: KitExtensionKind, files: readonly string[]): void {
  if (kind === 'props' || files.length <= INK_MODULE_LIMITS.maxModules) return;
  throw new ProjectError(
    `${KIT_EXTENSION_DIRS[kind]} has ${String(files.length)} modules (at most ${String(INK_MODULE_LIMITS.maxModules)})`,
    `merge or delete ${kind} modules the film does not use`,
  );
}

function checkSize(kind: KitExtensionKind, file: string, source: string): void {
  const bytes = Buffer.byteLength(source, 'utf8');
  if (kind === 'props' || bytes <= INK_MODULE_LIMITS.maxBytes) return;
  throw new ProjectError(
    `${file} is ${String(Math.ceil(bytes / 1024))} KB (at most ${String(INK_MODULE_LIMITS.maxBytes / 1024)} KB)`,
    'simplify the module: fewer, bolder shapes',
  );
}

async function readKind(
  root: string,
  kind: KitExtensionKind,
): Promise<{ extensions: KitExtensionSource[]; ignored: string[] }> {
  const folder = KIT_EXTENSION_DIRS[kind];
  const directory = projectPath(root, folder);
  if (!existsSync(directory)) return { extensions: [], ignored: [] };
  if (!isInside(realpathSync(root), realpathSync(directory))) {
    throw new ProjectError(
      `${folder} points outside the project folder`,
      `make ${folder} a normal folder inside the project`,
    );
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();
  const extensions: KitExtensionSource[] = [];
  const ignored: string[] = [];
  const named = files.filter((fileName) => PROP_NAME_PATTERN.test(fileName.slice(0, -3)));
  checkLimits(kind, named);
  for (const fileName of files) {
    const name = fileName.slice(0, -'.js'.length);
    const file = kitExtensionFile(kind, name);
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
    checkSize(kind, file, source);
    if (source.trim() === '') continue;
    extensions.push(kind === 'props' ? { name, file, source } : { name, file, source, kind });
  }
  return { extensions, ignored };
}

export async function readKitExtensions(root: string): Promise<KitExtensionFiles> {
  const kinds = await Promise.all(KIT_EXTENSION_KINDS.map((kind) => readKind(root, kind)));
  const extensions = kinds.flatMap((kind) => kind.extensions);
  const ignored = kinds.flatMap((kind) => kind.ignored);
  return extensions.length === 0 && ignored.length === 0
    ? NO_KIT_EXTENSIONS
    : { extensions, ignored };
}
