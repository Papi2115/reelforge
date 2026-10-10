/**
 * Grim Ink people and places of a `render:frames --scene` render (PLAN.md#14.8, #14.12): the
 * modules next to the scene (`<scene dir>/people/*.js`, `<scene dir>/places/*.js`: the kit's
 * examples) and those of the scene's project (`<scene dir>/../kit-ext/people|places/*.js`: a
 * project's `scenes/` folder), inlined into the manifest as `kitExtensions` so `ctx.kit.people` /
 * `ctx.kit.places` resolve exactly as in the app. Only camelCase file names count (ids = file
 * names); the first module of a kind and name wins. The engine imports them for the c-cam style
 * only; other styles ignore them.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROP_NAME_PATTERN, kitExtensionFile, type KitExtensionSource } from '@reelforge/shared';

type InkKind = 'people' | 'places';

const INK_KINDS: readonly InkKind[] = ['people', 'places'];

/** Folders searched for one kind, in priority order. */
function foldersOf(sceneDir: string, kind: InkKind): readonly string[] {
  return [path.join(sceneDir, kind), path.join(path.dirname(sceneDir), 'kit-ext', kind)];
}

async function modulesIn(folder: string, kind: InkKind): Promise<KitExtensionSource[]> {
  if (!existsSync(folder)) return [];
  const names = (await readdir(folder))
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.slice(0, -'.js'.length))
    .filter((name) => PROP_NAME_PATTERN.test(name))
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      kind,
      name,
      file: kitExtensionFile(kind, name),
      source: await readFile(path.join(folder, `${name}.js`), 'utf8'),
    })),
  );
}

/** The people and places a scene file can see (empty when it has none). */
export async function sceneInkModules(sceneFile: string): Promise<KitExtensionSource[]> {
  const sceneDir = path.dirname(sceneFile);
  const found: KitExtensionSource[] = [];
  const seen = new Set<string>();
  for (const kind of INK_KINDS) {
    for (const folder of foldersOf(sceneDir, kind)) {
      for (const module of await modulesIn(folder, kind)) {
        const key = `${kind}/${module.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(module);
      }
    }
  }
  return found;
}
