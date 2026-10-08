/**
 * One adapter per world (PLAN.md#13.15 phase 2): how its project asset files are validated (the
 * world's own parser in the kit, every problem named by file and id), merged into the one value
 * its scene API takes (`sketchPage({ library })`, `page.art.load(…)`, `b2View({ assets })`,
 * `screen.assets(…)`) and which ids they define. A file is added only when the whole set stays
 * valid with it (ids unique across files, the world's caps), so one bad file never breaks the
 * others.
 */
import {
  b1AssetFileSchema,
  b2AssetPackSchema,
  checkAssets,
  checkB1Assets,
  parseComicAssets,
  parseSketchAsset,
  type SketchAsset,
} from '@reelforge/kit';
import type { WorldAssetWorld } from '@reelforge/shared';

type Sections = Record<string, Record<string, unknown>>;

/** Ids of a set, per kind (`sprites`, `props`, …) and all of them. */
export interface WorldAssetIds {
  readonly all: readonly string[];
  readonly byKind: Readonly<Record<string, readonly string[]>>;
}

export interface WorldAssetAdapter {
  readonly world: WorldAssetWorld;
  /** Mutable state of a set being built. */
  start(): WorldAssetState;
}

export interface WorldAssetState {
  /** Adds one parsed file; returns its problems (then nothing of it is added). */
  add(value: unknown, file: string): string[];
  /** The value scenes pass to the world API. */
  value(): unknown;
  ids(): WorldAssetIds;
}

/** Sketchbook `library`: at most 64 entries (`sketchPage` schema). */
const SKETCH_LIBRARY_MAX = 64;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function idsOf(sections: Sections, kinds: readonly string[]): WorldAssetIds {
  const byKind = Object.fromEntries(kinds.map((kind) => [kind, Object.keys(sections[kind] ?? {})]));
  return { all: Object.values(byKind).flat(), byKind };
}

/** Ids of `next` already defined by an accepted file. */
function duplicates(
  owners: Map<string, string>,
  next: Sections,
  kinds: readonly string[],
  file: string,
): string[] {
  return kinds.flatMap((kind) =>
    Object.keys(next[kind] ?? {})
      .filter((id) => owners.has(id))
      .map(
        (id) =>
          `${file}: "${id}" is already defined in ${owners.get(id) ?? '?'} (ids are unique across files)`,
      ),
  );
}

function merged(into: Sections, next: Sections, kinds: readonly string[]): Sections {
  return Object.fromEntries(kinds.map((kind) => [kind, { ...into[kind], ...next[kind] }]));
}

/** A world whose files are sections of id → spec (Comic, Game B2, Game B1). */
function sectionState(options: {
  readonly kinds: readonly string[];
  /** The file's sections, or its problems. */
  readonly parse: (value: unknown, file: string, accepted: Sections) => Sections | string[];
  /** Problems of the merged set (caps), named by the file being added. */
  readonly check: (candidate: Sections, file: string) => string[];
  readonly wrap: (sections: Sections) => unknown;
  readonly ids?: (sections: Sections) => WorldAssetIds;
}): WorldAssetState {
  let sections: Sections = Object.fromEntries(options.kinds.map((kind) => [kind, {}]));
  const owners = new Map<string, string>();
  return {
    add(value, file) {
      const parsed = options.parse(value, file, sections);
      if (Array.isArray(parsed)) return parsed;
      const dup = duplicates(owners, parsed, options.kinds, file);
      if (dup.length > 0) return dup;
      const candidate = merged(sections, parsed, options.kinds);
      const problems = options.check(candidate, file);
      if (problems.length > 0) return problems;
      sections = candidate;
      for (const kind of options.kinds)
        for (const id of Object.keys(parsed[kind] ?? {})) owners.set(id, file);
      return [];
    },
    value: () => options.wrap(sections),
    ids: () => (options.ids ?? ((all) => idsOf(all, options.kinds)))(sections),
  };
}

const COMIC_KINDS = ['props', 'characters', 'backdrops'] as const;

const comic: WorldAssetAdapter = {
  world: 'comic',
  start: () =>
    sectionState({
      kinds: COMIC_KINDS,
      parse: (value, file) => {
        const result = parseComicAssets(value, file);
        if (!result.ok) return [...result.errors];
        const { props, characters, backdrops } = result.assets;
        return { props, characters, backdrops };
      },
      check: (candidate, file) => {
        const result = parseComicAssets({ version: 1, world: 'comic', ...candidate }, file);
        return result.ok ? [] : [...result.errors];
      },
      wrap: (sections) => ({ version: 1, world: 'comic', ...sections }),
    }),
};

const B2_KINDS = ['sprites', 'textures', 'icons'] as const;

function prefixed(errors: readonly string[], file: string): string[] {
  return errors.map((error) => `${file}: ${error.replace(/^assets\.?/, '')}`);
}

const gameB2: WorldAssetAdapter = {
  world: 'game-b2',
  start: () =>
    sectionState({
      kinds: B2_KINDS,
      parse: (value, file) => {
        const pack = b2AssetPackSchema.safeParse(value);
        if (!pack.success || value === null || typeof value !== 'object') {
          return [
            `${file}: not a Game B2 asset pack { version: 1, world: 'game-b2', sprites, textures, icons }`,
          ];
        }
        const result = checkAssets(value);
        if (!result.ok) return prefixed(result.errors, file);
        return { sprites: pack.data.sprites, textures: pack.data.textures, icons: pack.data.icons };
      },
      check: (candidate, file) => {
        const result = checkAssets({ version: 1, world: 'game-b2', ...candidate });
        return result.ok ? [] : prefixed(result.errors, file);
      },
      wrap: (sections) => ({ version: 1, world: 'game-b2', ...sections }),
    }),
};

const B1_KINDS = ['sprites', 'playfields', 'generated', 'rooms'] as const;
/** `screen.assets(file)` takes at most 80 entries per file (kit game-b1 vocab/assets.ts). */
const B1_MAX_ENTRIES = 80;

function b1Ids(sections: Sections): WorldAssetIds {
  const report = checkB1Assets([
    { name: 'assets', content: { version: 1, world: 'game-b1', ...sections } },
  ]);
  const { sprites, playfields, rooms } = report.ids;
  return {
    all: [...sprites, ...playfields, ...rooms],
    byKind: { sprites: [...sprites], playfields: [...playfields], rooms: [...rooms] },
  };
}

const gameB1: WorldAssetAdapter = {
  world: 'game-b1',
  start: () =>
    sectionState({
      kinds: B1_KINDS,
      parse: (value, file, accepted) => {
        const known = b1Ids(accepted).byKind;
        const report = checkB1Assets([{ name: file, content: value }], {
          known: { sprites: known['sprites'] ?? [], playfields: known['playfields'] ?? [] },
        });
        if (report.errors.length > 0) return [...report.errors];
        const parsed = b1AssetFileSchema.parse(value);
        return {
          sprites: parsed.sprites,
          playfields: parsed.playfields,
          generated: parsed.generated,
          rooms: parsed.rooms,
        };
      },
      check: (candidate, file) => {
        const count = B1_KINDS.reduce(
          (sum, kind) => sum + Object.keys(candidate[kind] ?? {}).length,
          0,
        );
        return count > B1_MAX_ENTRIES
          ? [
              `${file}: the film's Game B1 assets would have ${String(count)} entries; at most ${String(B1_MAX_ENTRIES)} (a screen loads them all at once): fewer, simpler assets`,
            ]
          : [];
      },
      wrap: (sections) => ({ version: 1, world: 'game-b1', ...sections }),
      ids: b1Ids,
    }),
};

const sketchbook: WorldAssetAdapter = {
  world: 'sketchbook',
  start() {
    const library: SketchAsset[] = [];
    const owners = new Map<string, string>();
    return {
      add(value, file) {
        let asset: SketchAsset;
        try {
          asset = parseSketchAsset(value, file);
        } catch (error) {
          return [message(error)];
        }
        const owner = owners.get(asset.id);
        if (owner !== undefined) return [`${file}: "${asset.id}" is already defined in ${owner}`];
        if (library.length >= SKETCH_LIBRARY_MAX) {
          return [`${file}: at most ${String(SKETCH_LIBRARY_MAX)} sketchbook assets per film`];
        }
        library.push(asset);
        owners.set(asset.id, file);
        return [];
      },
      value: () => [...library],
      ids: () => {
        const figures = library.filter((asset) => asset.kind === 'figure').map((asset) => asset.id);
        const props = library.filter((asset) => asset.kind === 'prop').map((asset) => asset.id);
        return { all: [...figures, ...props], byKind: { figures, props } };
      },
    };
  },
};

export const WORLD_ASSET_ADAPTERS: Readonly<Record<WorldAssetWorld, WorldAssetAdapter>> = {
  sketchbook,
  comic,
  'game-b2': gameB2,
  'game-b1': gameB1,
};
