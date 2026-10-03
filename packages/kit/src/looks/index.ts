/**
 * Look registry (ADR-009). `LOOKS` lists every look module the kit ships; only those with
 * `available: true` reach storyboards, scene-build docs, `ctx.kit` and the catalog. A new look
 * lives in its own folder (`looks/<id>/index.ts`) and flips its own flag: this file and the
 * shared kit code never need an edit for it.
 */
import { KitError } from '../errors.js';
import type { KitDefinition, KitKind } from '../registry.js';
import { blueprintLook } from './blueprint/index.js';
import { dioramaLook } from './diorama/index.js';
import { retroUiLook } from './retro-ui/index.js';
import { lookDefinitions, type Look } from './types.js';
import { VOXEL_LOOK_ID, voxelLook } from './voxel/index.js';

export * from './types.js';
export { VOXEL_LOOK_ID, voxelLook };

/** Every look module, available or not; voxel first (it is the kit itself). */
export const LOOKS: readonly Look[] = Object.freeze([
  voxelLook,
  retroUiLook,
  dioramaLook,
  blueprintLook,
]);

/** The available looks, voxel first. */
export function listLooks(looks: readonly Look[] = LOOKS): Look[] {
  return looks.filter((look) => look.available);
}

/** An available look by id (undefined for unknown or not-yet-available ones). */
export function getLook(id: string, looks: readonly Look[] = LOOKS): Look | undefined {
  return listLooks(looks).find((look) => look.id === id);
}

/** A kit definition with the look it comes from. */
export interface LookDefinition {
  readonly look: string;
  readonly definition: KitDefinition;
}

/**
 * Definitions of the available looks other than voxel (whose definitions are the kit's own),
 * by kind. Throws when two looks (or a look and the voxel kit) use one name in one namespace,
 * or when two looks share an id.
 */
export function extraLookDefinitions(
  looks: readonly Look[] = LOOKS,
): Readonly<Record<KitKind, readonly LookDefinition[]>> {
  const available = listLooks(looks);
  const ids = new Set<string>();
  for (const look of available) {
    if (ids.has(look.id)) throw new KitError('invalid-look', `look id "${look.id}" repeats`);
    ids.add(look.id);
  }
  const taken = new Map<string, string>(
    lookDefinitions(voxelLook).map((definition) => [
      `${definition.kind}:${definition.name}`,
      VOXEL_LOOK_ID,
    ]),
  );
  const result: Record<KitKind, LookDefinition[]> = { env: [], prop: [], fx: [] };
  for (const look of available) {
    if (look.id === VOXEL_LOOK_ID) continue;
    for (const definition of lookDefinitions(look)) {
      const key = `${definition.kind}:${definition.name}`;
      const owner = taken.get(key);
      if (owner !== undefined) {
        throw new KitError(
          'invalid-look',
          `look "${look.id}": ${definition.kind} "${definition.name}" is already defined by look "${owner}"`,
        );
      }
      taken.set(key, look.id);
      result[definition.kind].push({ look: look.id, definition });
    }
  }
  return result;
}
