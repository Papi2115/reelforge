/**
 * World projects in `reelforge kit-docs` (PLAN.md#13.6, ADR-029): a world's style always mixes its
 * own looks (`voxel-only` would list none of them), and an experimental world's looks are listed
 * only when the app runs with experimental worlds on: it sets `REELFORGE_EXPERIMENTAL_WORLDS=1`
 * for its Claude processes (the CLI shims' env), matching `StageSettings.experimentalWorlds`.
 */
import { isUnwiredWorldStyle, isWorldStyle, type LookScope } from '@reelforge/kit';
import {
  isWorldAssetWorld,
  projectLookMode,
  WORLD_ASSET_WORLDS,
  worldAssetsDir,
  type LookMode,
  type ProjectFile,
  type WorldAssetWorld,
} from '@reelforge/shared';

export const EXPERIMENTAL_WORLDS_ENV = 'REELFORGE_EXPERIMENTAL_WORLDS';

/** True when the environment turns experimental worlds on (`1` or `true`). */
export function experimentalWorldsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[EXPERIMENTAL_WORLDS_ENV]?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

/** The project's look mode for the kit docs: a world's style is always `mixed`. */
export function kitDocsLookMode(project: Pick<ProjectFile, 'lookMode' | 'style'>): LookMode {
  return isWorldStyle(project.style) ? 'mixed' : projectLookMode(project);
}

/**
 * The catalog scope of a project style (experimental looks only with the env switch; never the
 * looks of a world that is not wired yet, which stay render-only).
 */
export function kitDocsScope(style: string | undefined, experimental: boolean): LookScope {
  return experimental && !isUnwiredWorldStyle(style) ? { style, experimental: true } : { style };
}

/** `reelforge kit-docs world-assets`: the film's own assets of a world project (PLAN.md#13.15). */
export const WORLD_ASSETS_TOPIC = 'world-assets';

interface WorldAssetDocs {
  readonly load: string;
  readonly use: string;
  readonly format: string;
  /** How to draw things that read in this world (real-run lessons); absent = none. */
  readonly drawing?: string;
}

const WORLD_ASSET_DOCS: Readonly<Record<WorldAssetWorld, WorldAssetDocs>> = {
  sketchbook: {
    load: 'const page = ctx.kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, library: ctx.worldAssets })',
    use: "page.person({ like: 'ranger', x, y, h }) for a figure, page.use('fire-tower', { x, y, h }) for a prop",
    format:
      'one file per thing, assets/sketchbook/<id>.json = { "version": 1, "id": "<id>", "kind": "figure" | "prop", "description": "...", "spec": <a person look> | { "doodle": {...} } | { "spot": {...} } | { "draw": "<kind>", "type": "...", "h": 150 } }; <= 64 things',
  },
  comic: {
    load: 'const page = ctx.kit.fx.comicPage({ ... }); page.art.load(ctx.worldAssets)',
    use: "page.art.draw(g, 'ranger', { x, y, size, pose }) in a panel, a beat's backdrop: 'pine-dawn'",
    format:
      'assets/comic/<name>.json = { "version": 1, "world": "comic", "characters": { "<id>": spec }, "props": {...}, "backdrops": {...} }; spec = { "parts": [...] } | { "sprite": {...} } | { "gen": "person", ...knobs } | { "layers": [...] } (backdrops); <= 64 things',
  },
  'game-b2': {
    load: 'const view = ctx.kit.fx.b2View({ size, level, assets: ctx.worldAssets, ... })',
    use: "their ids work in the level like built-in names (sprites, walls, floors, ceilings), view.take({ icon: 'acorn' }), hud.inventory({ items: [{ icon }] })",
    format:
      'assets/game-b2/<name>.json = { "version": 1, "world": "game-b2", "sprites": {...}, "textures": {...}, "icons": {...} }; each entry pixel art (rows + legend of ramp steps) or a generator call { "gen": "plant", "kind": "conifer" }; <= 48 sprites, 24 textures, 24 icons',
    drawing:
      'prefer a generator and vary its options (an animal: creature with its kind, form, coat, belly, pattern); pixel art only at the size it stands in the level (16-32 rows for a person or an animal, 24-48 for a tree), side on, its 2-3 defining features (head shape, a wing or face patch, the tail, legs apart), a 1 px dark outline, 2-3 steps of one ramp per part; never a symmetric blob or a regular pattern (checker, stripes) for a living thing; thin things (roots, threads, wires) as lines >= 2 px on a contrasting ground; icons: one bold silhouette filling the 12 x 12 grid (>= 10 px one way, >= 20 pixels; the kit refuses a dot), 2 colours, pink only on THE item; then look at the sheet: if you cannot name a thing at 64 px, redraw it',
  },
  'game-b1': {
    load: 'const screen = ctx.kit.fx.b1Screen({ ... }); screen.assets(ctx.worldAssets)',
    use: "g.draw('ranger', x, y) / g.field('canopy', y) inside screen.tv(...), screen.interior('cabin')",
    format:
      'assets/game-b1/<name>.json = { "version": 1, "world": "game-b1", "sprites": {...}, "playfields": {...}, "generated": { "<id>": { "kind": "tree", ... } }, "rooms": {...} }; <= 80 entries in all files together',
  },
};

/** The short "Project assets" section of a world's look slices (none outside a world). */
export function projectAssetsSection(world: string | undefined): string[] {
  if (!isWorldAssetWorld(world)) return [];
  const docs = WORLD_ASSET_DOCS[world];
  return [
    `Project assets (the film's own things, ${worldAssetsDir(world)}/*.json; details: reelforge kit-docs ${WORLD_ASSETS_TOPIC}):`,
    `  ${docs.load}`,
    `  then ${docs.use}`,
  ];
}

/** `kit-docs world-assets`: format, the one line that loads them, the project's ids. */
export function describeWorldAssets(
  world: string | undefined,
  ids: Readonly<Record<string, readonly string[]>> | undefined,
): string {
  if (!isWorldAssetWorld(world)) {
    return `world assets: only world projects (${WORLD_ASSET_WORLDS.join(', ')}) have them; this project's style is ${world ?? 'unknown'}`;
  }
  const docs = WORLD_ASSET_DOCS[world];
  const listed = Object.entries(ids ?? {}).filter(([, list]) => list.length > 0);
  return [
    `world assets of ${world}: the film's own recurring things, designed once per film and given to every scene as ctx.worldAssets (validated, frozen)`,
    `load (one line in build): ${docs.load}`,
    `use: ${docs.use}`,
    `file format: ${docs.format}`,
    ...(docs.drawing === undefined ? [] : [`drawing that reads: ${docs.drawing}`]),
    'rules: name the ids, never copy an asset into a scene; a thing used in one shot only may be defined in that scene; an id nobody defines fails QA',
    "generators: reelforge kit-docs generators lists every generator with each option's allowed values (enums, ranges, defaults); read it before writing a generator call, never guess a value",
    'check: reelforge world-assets check (files, ids, problems); look: reelforge world-assets sheet (contact sheets to Read)',
    listed.length === 0
      ? 'this project: no assets yet'
      : `this project: ${listed.map(([kind, list]) => `${kind}: ${list.join(', ')}`).join('; ')}`,
  ].join('\n');
}
