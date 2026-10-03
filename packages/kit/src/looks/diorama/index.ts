/**
 * Look `diorama` (PLAN.md#12.3, not built yet): isometric tiled dioramas (office, server room,
 * city, room). Registration point: add the kit definitions to `kit`, write `docs`, then flip
 * `available` to true — nothing outside this folder needs an edit.
 */
import { defineLook } from '../types.js';

export const dioramaLook = defineLook({
  id: 'diorama',
  label: 'Isometric diorama',
  description:
    'isometric tiled dioramas (office, server room, city block, room) seen from above, like a model',
  rolls: ['B', 'A'],
  treatments: ['3d-reconstruction', 'map', 'metaphor-object'],
  docs: 'Look `diorama` is not available yet (PLAN.md#12.3).',
  soundPalette: 'diorama',
  variationBudget: 'diorama',
  available: false,
  kit: {},
});
