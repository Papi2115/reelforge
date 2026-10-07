/**
 * `ctx.worldAssets` (PLAN.md#13.15 phase 2): the project's world asset files
 * (`assets/<world>/*.json`, inlined in the manifest as texts) parsed and validated once per video
 * by the world's own parser, merged in file-name order into the value the world's scene API
 * takes, and deep-frozen: every shot of preview, export and `reelforge frames` sees the same
 * data. Invalid files are left out (their problems are listed); a world project without files
 * gets the world's empty set, a built-in style gets `undefined`.
 */
import {
  isWorldAssetWorld,
  type ManifestWorldAssets,
  type WorldAssetSource,
  type WorldAssetWorld,
} from '@reelforge/shared';
import { WORLD_ASSET_ADAPTERS, type WorldAssetIds } from './adapters.js';

export type { WorldAssetIds } from './adapters.js';

/** What scenes get as `ctx.worldAssets` and pass to their world's API (frozen). */
export type WorldAssetsValue = Readonly<Record<string, unknown>> | readonly unknown[];

export interface WorldAssetProblem {
  /** Project-relative asset file. */
  readonly file: string;
  readonly message: string;
}

export interface WorldAssetSet {
  readonly world: WorldAssetWorld;
  readonly value: WorldAssetsValue;
  readonly ids: WorldAssetIds;
  /** Files that made it into the set, in load order. */
  readonly files: readonly string[];
  /** Files left out and why (one entry per problem). */
  readonly problems: readonly WorldAssetProblem[];
}

/** Freezes plain objects and arrays all the way down (scenes cannot change shared data). */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function parseJson(source: string, file: string): { value: unknown } | { problem: string } {
  try {
    return { value: JSON.parse(source) as unknown };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return { problem: `${file}: not valid JSON (${why}); no comments, no trailing commas` };
  }
}

/** Parses, validates and merges a world's asset files (sorted by file name). */
export function buildWorldAssets(
  world: WorldAssetWorld,
  files: readonly WorldAssetSource[],
): WorldAssetSet {
  const state = WORLD_ASSET_ADAPTERS[world].start();
  const accepted: string[] = [];
  const problems: WorldAssetProblem[] = [];
  const sorted = [...files].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  for (const entry of sorted) {
    const parsed = parseJson(entry.source, entry.file);
    const errors = 'problem' in parsed ? [parsed.problem] : state.add(parsed.value, entry.file);
    if (errors.length === 0) accepted.push(entry.file);
    else problems.push(...errors.map((text) => ({ file: entry.file, message: text })));
  }
  return deepFreeze({
    world,
    value: state.value() as WorldAssetsValue,
    ids: state.ids(),
    files: accepted,
    problems,
  });
}

/** The empty set of a world (what its scenes get before any asset file exists). */
export function emptyWorldAssets(world: WorldAssetWorld): WorldAssetSet {
  return buildWorldAssets(world, []);
}

/**
 * The set a video's scenes see: the manifest's files, the empty set of the style's world, or
 * undefined for a built-in style.
 */
export function videoWorldAssets(
  style: string,
  manifest: ManifestWorldAssets | undefined,
): WorldAssetSet | undefined {
  if (manifest !== undefined) return buildWorldAssets(manifest.world, manifest.files);
  return isWorldAssetWorld(style) ? emptyWorldAssets(style) : undefined;
}
