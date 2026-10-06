/**
 * Look registry (ADR-009). `LOOKS` lists every look module the kit ships; only those with
 * `available: true` reach storyboards, scene-build docs, `ctx.kit` and the catalog. A new look
 * lives in its own folder (`looks/<id>/index.ts`) and flips its own flag: this file and the
 * shared kit code never need an edit for it. World looks (PLAN.md#13.1) come from `WORLDS` and
 * are scoped to their world's style (`Look.styles`, `LookScope`).
 */
import { KitError } from '../errors.js';
import type { KitDefinition, KitKind } from '../registry.js';
import { worldLooks } from '../worlds/index.js';
import { blueprintLook } from './blueprint/index.js';
import { dioramaLook } from './diorama/index.js';
import { flat2dLook } from './flat-2d/index.js';
import { paperCutoutLook } from './paper-cutout/index.js';
import { retroUiLook } from './retro-ui/index.js';
import { lookDefinitions, lookInScope, type Look, type LookScope } from './types.js';
import { VOXEL_LOOK_ID, voxelLook } from './voxel/index.js';
import { whiteboardLook } from './whiteboard/index.js';

export * from './types.js';
export { VOXEL_LOOK_ID, voxelLook };

/** Every look module, available or not; voxel first (it is the kit itself), world looks last. */
export const LOOKS: readonly Look[] = Object.freeze([
  voxelLook,
  retroUiLook,
  dioramaLook,
  blueprintLook,
  paperCutoutLook,
  whiteboardLook,
  flat2dLook,
  ...worldLooks(),
]);

/**
 * True when `style` is the style of a world: some look of `looks` (available, experimental or
 * not) is scoped to it. World styles are exclusive (ADR-029): only their own looks are offered.
 */
export function isWorldStyle(style: string | undefined, looks: readonly Look[] = LOOKS): boolean {
  return style !== undefined && looks.some((look) => look.styles?.includes(style) === true);
}

/**
 * The available looks offered in `scope`, voxel first. The default scope (no style) leaves out
 * every look scoped to a style and every experimental look, so callers that do not pass a style
 * see exactly the looks of the built-in styles. In a world's style only that world's looks.
 */
export function listLooks(looks: readonly Look[] = LOOKS, scope: LookScope = {}): Look[] {
  const worldStyle = isWorldStyle(scope.style, looks);
  return looks.filter((look) => lookInScope(look, scope, worldStyle));
}

/**
 * An available look by id (undefined for unknown or not-yet-available ones). Without a scope any
 * available look of `looks` resolves (pass a scoped list to restrict it); with one, only a look
 * offered in that scope.
 */
export function getLook(
  id: string,
  looks: readonly Look[] = LOOKS,
  scope?: LookScope,
): Look | undefined {
  if (scope === undefined) return looks.find((look) => look.id === id && look.available);
  return listLooks(looks, scope).find((look) => look.id === id);
}

/** A kit definition with the look it comes from. */
export interface LookDefinition {
  readonly look: string;
  readonly definition: KitDefinition;
}

/**
 * Definitions of the looks offered in `scope` other than voxel (whose definitions are the kit's
 * own), by kind. Throws when two of those looks (or a look and the voxel kit) use one name in one
 * namespace, or when two share an id; looks of different styles never meet, so they may. World
 * looks (scoped to a style) may list the very same definition object (a world-level template
 * such as `sketchPage`): it is bound and catalogued once, under the first look that lists it.
 */
export function extraLookDefinitions(
  looks: readonly Look[] = LOOKS,
  scope: LookScope = {},
): Readonly<Record<KitKind, readonly LookDefinition[]>> {
  const available = listLooks(looks, scope);
  const ids = new Set<string>();
  for (const look of available) {
    if (ids.has(look.id)) throw new KitError('invalid-look', `look id "${look.id}" repeats`);
    ids.add(look.id);
  }
  const taken = new Map<string, LookDefinition & { readonly shared: boolean }>(
    lookDefinitions(voxelLook).map((definition) => [
      `${definition.kind}:${definition.name}`,
      { look: VOXEL_LOOK_ID, definition, shared: false },
    ]),
  );
  const result: Record<KitKind, LookDefinition[]> = { env: [], prop: [], fx: [] };
  for (const look of available) {
    if (look.id === VOXEL_LOOK_ID) continue;
    const shared = look.styles !== undefined;
    for (const definition of lookDefinitions(look)) {
      const key = `${definition.kind}:${definition.name}`;
      const owner = taken.get(key);
      if (owner?.shared === true && shared && owner.definition === definition) continue;
      if (owner !== undefined) {
        throw new KitError(
          'invalid-look',
          `look "${look.id}": ${definition.kind} "${definition.name}" is already defined by look "${owner.look}"`,
        );
      }
      taken.set(key, { look: look.id, definition, shared });
      result[definition.kind].push({ look: look.id, definition });
    }
  }
  return result;
}
