/**
 * Project assets of the worlds' open vocabularies (PLAN.md#13.15 phase 2): the film's own
 * characters, props, sprites, textures, icons and places live in `assets/<world>/*.json`
 * (versioned; each world's own parser in the kit validates the content), built per film by the
 * world-assets step before the scenes. The render manifest inlines the file texts
 * (`worldAssets`), so the sandboxed engine parses them into `ctx.worldAssets` the same way in
 * preview, export and `reelforge frames`. `assets/cast.json` lists the recurring things and the
 * shots they appear in; `.reelforge/world-assets.json` is the step's report.
 */
import { z } from 'zod';
import { shotIdSchema } from './storyboard.js';

/** Worlds with an open vocabulary (= the kit's world ids). */
export const WORLD_ASSET_WORLDS = ['sketchbook', 'comic', 'game-b2', 'game-b1'] as const;
export const worldAssetWorldSchema = z.enum(WORLD_ASSET_WORLDS);
export type WorldAssetWorld = z.infer<typeof worldAssetWorldSchema>;

export function isWorldAssetWorld(style: string | undefined): style is WorldAssetWorld {
  return (WORLD_ASSET_WORLDS as readonly string[]).includes(style ?? '');
}

/** `assets/<world>`: the folder of a world's asset files. */
export function worldAssetsDir(world: WorldAssetWorld): string {
  return `assets/${world}`;
}

/** File names inside `assets/<world>/` (kebab case, `.json`; Sketchbook: `<asset id>.json`). */
export const WORLD_ASSET_FILE_PATTERN = /^[a-z][a-z0-9-]{0,39}\.json$/;
export const MAX_WORLD_ASSET_FILES = 64;
/** One asset file's text (a pixel-art sprite sheet is a few KB; 128 KB is far beyond). */
export const MAX_WORLD_ASSET_FILE_CHARS = 131_072;

export const worldAssetSourceSchema = z.object({
  /** Project-relative path, e.g. `assets/comic/forest.json`. */
  file: z.string().min(1).max(200),
  source: z.string().max(MAX_WORLD_ASSET_FILE_CHARS),
});
export type WorldAssetSource = z.infer<typeof worldAssetSourceSchema>;

/** Manifest field `worldAssets`: the project's asset file texts, sorted by file name. */
export const manifestWorldAssetsSchema = z
  .object({
    world: worldAssetWorldSchema,
    files: z.array(worldAssetSourceSchema).max(MAX_WORLD_ASSET_FILES),
  })
  .superRefine((value, issues) => {
    const seen = new Set<string>();
    value.files.forEach((entry, index) => {
      if (seen.has(entry.file)) {
        issues.addIssue({
          code: 'custom',
          message: `duplicate world asset file "${entry.file}"`,
          path: ['files', index, 'file'],
        });
      }
      seen.add(entry.file);
    });
  });
export type ManifestWorldAssets = z.infer<typeof manifestWorldAssetsSchema>;

/** `assets/cast.json`: the film's recurring things and where they appear. */
export const WORLD_CAST_FILE = 'assets/cast.json';
export const WORLD_CAST_KINDS = [
  'character',
  'animal',
  'prop',
  'place',
  'texture',
  'icon',
  'effect',
] as const;

export const worldCastEntrySchema = z.object({
  /** The asset id as scenes name it. */
  id: z.string().regex(/^[a-z][a-zA-Z0-9-]{0,39}$/),
  kind: z.enum(WORLD_CAST_KINDS),
  /** What it is in the narration's words. */
  name: z.string().min(1).max(120),
  /** Project-relative asset file that defines it. */
  file: z.string().min(1).max(200),
  /** Storyboard shots it appears in (empty = any). */
  shots: z.array(shotIdSchema).max(200).default([]),
  /** Shared look notes (same coat in every shot, the scar on the left cheek, …). */
  notes: z.string().max(300).optional(),
});
export type WorldCastEntry = z.infer<typeof worldCastEntrySchema>;

export const worldCastFileSchema = z.object({
  version: z.literal(1),
  world: worldAssetWorldSchema,
  entries: z.array(worldCastEntrySchema).max(160),
});
export type WorldCastFile = z.infer<typeof worldCastFileSchema>;

/** `.reelforge/world-assets.json`: the world-assets step's report (app state, not tracked). */
export const WORLD_ASSETS_REPORT_FILE = '.reelforge/world-assets.json';

export const worldAssetsReportSchema = z.object({
  version: z.literal(1),
  world: worldAssetWorldSchema,
  /** sha256 of storyboard.json the set was designed for (a new storyboard asks again). */
  storyboardHash: z.string().regex(/^[0-9a-f]{64}$/),
  /** `built`: passed QA · `warning`: kept with findings · `failed`: nothing usable. */
  status: z.enum(['built', 'warning', 'failed']),
  attempts: z.int().min(0),
  files: z.array(z.string()),
  ids: z.array(z.string()),
  findings: z.array(z.string()),
  notes: z.array(z.string()),
  /** Project-relative contact sheet the critic saw. */
  sheet: z.string().optional(),
  updatedAt: z.iso.datetime(),
});
export type WorldAssetsReport = z.infer<typeof worldAssetsReportSchema>;
