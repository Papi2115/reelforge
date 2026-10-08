/**
 * Comic asset files of a project (PLAN.md#13.15a): `assets/comic/<name>.json` (or `.js`
 * exporting `comicAssets`, whose specs may carry a `draw` painter) - the film's own props,
 * characters and backdrops, built once and drawn by every shot (`page.art.load(file)`).
 * Stable format, version 1:
 *   { "version": 1, "world": "comic",
 *     "props": { "<id>": spec }, "characters": { "<id>": spec }, "backdrops": { "<id>": spec } }
 * where a spec is `{ parts }`, `{ sprite }`, `{ gen, ...knobs }`, `{ layers }` (backdrops) or
 * `{ draw }` (JS only). `parseComicAssets` returns every problem at once; `unknownComicArtIds`
 * finds the ids a scene draws that neither the project nor the scene defines.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { ArtRegistry, ASSET_KINDS, MAX_ASSETS, type AssetKind } from './registry.js';

export const COMIC_ASSET_VERSION = 1;

const section = z.record(z.string(), z.unknown()).default({});

export const comicAssetFileSchema = z.strictObject({
  version: z.literal(COMIC_ASSET_VERSION),
  world: z.literal('comic'),
  props: section,
  characters: section,
  backdrops: section,
});
export type ComicAssets = z.output<typeof comicAssetFileSchema>;

export type ComicAssetsResult =
  | { readonly ok: true; readonly assets: ComicAssets; readonly ids: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

const SECTION: Readonly<Record<AssetKind, 'props' | 'characters' | 'backdrops'>> = {
  prop: 'props',
  character: 'characters',
  backdrop: 'backdrops',
};

/** Defines every spec of a file into a registry; returns the problems (empty = all defined). */
function defineAll(registry: ArtRegistry, assets: ComicAssets, file: string): string[] {
  const errors: string[] = [];
  const total = ASSET_KINDS.reduce(
    (sum, kind) => sum + Object.keys(assets[SECTION[kind]]).length,
    0,
  );
  if (total > MAX_ASSETS)
    errors.push(`${file}: ${String(total)} things; at most ${String(MAX_ASSETS)}`);
  for (const kind of ASSET_KINDS) {
    for (const [id, spec] of Object.entries(assets[SECTION[kind]])) {
      try {
        registry.define(kind, id, spec);
      } catch (error) {
        errors.push(
          `${file} ${SECTION[kind]}.${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  return errors;
}

/** Validates an asset file (parsed JSON or a JS module's `comicAssets`). */
export function parseComicAssets(value: unknown, file = 'assets/comic'): ComicAssetsResult {
  const result = comicAssetFileSchema.safeParse(value);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) => `${file}: ${issue.path.join('.') || '(file)'}: ${issue.message}`,
      ),
    };
  }
  const registry = new ArtRegistry(file);
  const errors = defineAll(registry, result.data, file);
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, assets: result.data, ids: registry.ids };
}

/** Loads a file into a page's registry, or throws one readable error listing every problem. */
export function loadComicAssets(
  registry: ArtRegistry,
  value: unknown,
  file = 'assets/comic',
): readonly string[] {
  const parsed = comicAssetFileSchema.safeParse(value);
  const errors = parsed.success
    ? defineAll(registry, parsed.data, file)
    : parsed.error.issues.map(
        (issue) => `${file}: ${issue.path.join('.') || '(file)'}: ${issue.message}`,
      );
  if (errors.length > 0)
    throw new KitError('invalid-params', `page.art.load: ${errors.join('; ')}`);
  return parsed.success
    ? ASSET_KINDS.flatMap((kind) => Object.keys(parsed.data[SECTION[kind]]))
    : [];
}

const DRAWN = /\.draw\(\s*[\w$.]+\s*,\s*['"]([a-z][a-z0-9-]{0,39})['"]/g;
const USED = /shape:\s*['"]use['"][^}]*?\bid:\s*['"]([a-z][a-z0-9-]{0,39})['"]/g;
const DEFINED = /\.define(?:Prop|Character|Backdrop)\(\s*['"]([a-z][a-z0-9-]{0,39})['"]/g;

export interface UnknownArtId {
  readonly id: string;
  readonly line: number;
}

/**
 * Ids a scene draws (`art.draw(g, 'id')`, parts `{ shape: 'use', id }`) that are neither in the
 * project's asset files (`known`) nor defined by the scene itself (`defineProp('id', ...)`).
 */
export function unknownComicArtIds(source: string, known: Iterable<string>): UnknownArtId[] {
  const defined = new Set(known);
  for (const match of source.matchAll(DEFINED)) if (match[1] !== undefined) defined.add(match[1]);
  const out: UnknownArtId[] = [];
  for (const pattern of [DRAWN, USED]) {
    for (const match of source.matchAll(pattern)) {
      const id = match[1];
      if (id === undefined || defined.has(id)) continue;
      out.push({ id, line: source.slice(0, match.index).split('\n').length });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}
