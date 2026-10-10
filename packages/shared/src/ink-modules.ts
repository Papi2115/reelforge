/**
 * Grim Ink (`c-cam`) project modules (PLAN.md#14.8): every film builds its own people and places
 * as plain ES modules, `kit-ext/people/<id>.js` (`export const person = { ... }`) and
 * `kit-ext/places/<id>.js` (`export const place = { ... }`), loaded like project props
 * (kit-extensions.ts: `kind` `people` / `places` in the manifest's `kitExtensions`) and called by
 * the world's scenes as `kit.people.<id>` / `kit.places.<id>`.
 *
 * Like the prop contract, the module contract itself (the person's rig data, the place's bounds,
 * light, anchors and boxes, the drawing functions) is a zod schema of the kit (`personModuleSchema`,
 * `placeModuleSchema` in `@reelforge/kit`); this file holds the ids and the limits every reader of
 * the project (CLI, app, engine lint) shares.
 */
import { z } from 'zod';
import { PROP_NAME_PATTERN } from './kit-extensions.js';

/**
 * Limits per project and per module file (people, places and libraries each). Raised in
 * PLAN.md#14.19 to the density of the concept films (docs/worlds/c-cam-ENGINE-GAPS.md): their cast
 * files run to ~200 tightly packed lines, a film has up to 8 people plus its crowd, several sets
 * per file and shared helper files (acting.js, props.js, crowd.js); was 24 modules / 64 KB / 250
 * lines. Only the Grim Ink world reads these kinds.
 */
export const INK_MODULE_LIMITS = Object.freeze({
  /** Modules per kind in one project (was 24). */
  maxModules: 64,
  /** Bytes per module file (was 64 KB). */
  maxBytes: 160 * 1024,
  /** Lines per module file (lint; was 250). */
  maxLines: 450,
});

/**
 * Lines of a Grim Ink scene the prompts and the project's CLAUDE.md allow (was "under ~250"): a
 * concept film's shot with its cut table, acting and inline props runs to 300-500 lines.
 */
export const C_CAM_SCENE_MAX_LINES = 600;

/** camelCase, like prop names: the file name and the registry key (`kit.people.oldBaker`). */
export const inkModuleIdSchema = z
  .string()
  .regex(
    PROP_NAME_PATTERN,
    'ids are camelCase identifiers equal to the file name, e.g. "oldBaker"',
  );
