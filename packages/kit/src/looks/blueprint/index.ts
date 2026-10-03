/**
 * Look `blueprint` (PLAN.md#12.4, not built yet): technical schematics, node graphs and
 * timelines, charts, maps, counters. Registration point: add the kit definitions to `kit`, write
 * `docs`, then flip `available` to true — nothing outside this folder needs an edit.
 */
import { defineLook } from '../types.js';

export const blueprintLook = defineLook({
  id: 'blueprint',
  label: 'Blueprint / data',
  description:
    'technical blueprints and data: schematics, node graphs, timelines, charts, maps and counters',
  rolls: ['B'],
  treatments: ['node-graph/timeline', 'data-chart-3d', 'map', 'counter/odometer'],
  docs: 'Look `blueprint` is not available yet (PLAN.md#12.4).',
  soundPalette: 'blueprint',
  variationBudget: 'blueprint',
  available: false,
  kit: {},
});
