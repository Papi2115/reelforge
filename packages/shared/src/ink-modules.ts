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

/** Limits per project and per module file (people and places each). */
export const INK_MODULE_LIMITS = Object.freeze({
  /** Modules per kind in one project. */
  maxModules: 24,
  /** Bytes per module file. */
  maxBytes: 64 * 1024,
  /** Lines per module file (lint). */
  maxLines: 250,
});

/** camelCase, like prop names: the file name and the registry key (`kit.people.oldBaker`). */
export const inkModuleIdSchema = z
  .string()
  .regex(
    PROP_NAME_PATTERN,
    'ids are camelCase identifiers equal to the file name, e.g. "oldBaker"',
  );
