/**
 * Look `blueprint` (PLAN.md#12.4): technical schematics, node graphs and timelines, charts,
 * maps and counters drawn as pixel-exact 2D blueprint boards (board.ts) that go through the same
 * post pass as every look. Data can be pasted as CSV; reveals land on spoken phrases.
 */
import { defineLook } from '../types.js';
import { blueprintChart } from './chart.js';
import { blueprintCounter } from './counter.js';
import { blueprintGraph } from './graph.js';
import { blueprintMap } from './map.js';
import { blueprintSchematic } from './schematic.js';
import { blueprintSheet } from './sheet.js';
import { blueprintTimeline } from './timeline.js';

const DOCS = `Look \`blueprint\`: flat 2D technical drawings on blueprint paper (grid, rulers, title block), lettered in pixel caps. Each template is a full-frame board: create ONE in build(), \`scene.add\` it, call \`board.update(t)\` in update(t). Always pass \`size: [ctx.shot.width, ctx.shot.height]\` and, when any time is a spoken phrase, \`anchor: ctx.anchor\`. Boards ignore the camera (no camera work needed; the grid drifts by itself); voxel objects, \`ctx.text\` and \`ctx.annotate\` (frame targets) draw on top.
- \`kit.fx.blueprintChart\`: bar/line/area/hbar from \`csv\` (paste the numbers: header row, first column labels, then series; add a \`say\` column with the phrase that reveals each row) or \`values\`/\`labels\`; \`highlight: { item, at }\` for the punchline; \`prefix\`/\`suffix\`/\`unit\`.
- \`kit.fx.blueprintCounter\`: odometer \`from\` -> \`to\` between \`start\` and \`end\` (phrases ok), \`label\` as a dimension line.
- \`kit.fx.blueprintGraph\`: flow chart (\`nodes\` with \`at\`, \`edges\`, \`highlights\`, layout flow/row/column/circle).
- \`kit.fx.blueprintTimeline\`: \`events\` { value: year, label, caption, at }, \`views\` [{ at, range }] to zoom, now-marker.
- \`kit.fx.blueprintMap\`: \`view\` world/europe/asia/... or [w, s, e, n], \`views\` to zoom on cue, \`markers\` [{ id, position: [lon, lat], label, at }], \`routes\` [{ from, to, at }], \`highlights\` [{ region: 'FRA' | 'France' | 'europe', at }].
- \`kit.fx.blueprintSchematic\`: \`parts\` (rect/circle/line/poly in 640x360-frame pixels, line styles, hatch fills) trace in, then \`dimensions\` and \`callouts\` on their phrases.
- \`kit.env.blueprintSheet\`: bare sheet; \`headline\`/\`subline\` make a title card.
Example: \`const chart = kit.fx.blueprintChart({ size: [ctx.shot.width, ctx.shot.height], anchor: ctx.anchor, title: 'FIG. 1 UNITS SOLD', csv: 'year,units,say\\n1998,12,ninety-eight\\n2000,40,two thousand', suffix: 'M' });\`
Rules: one idea per board, at most ~8 bars or ~10 events or ~10 nodes; labels short (<= 14 characters); reveal each datum on the word that says it; use \`highlight\`/\`hot\` for the one number that matters; prefer roles (ink, dim, accent, hot, alt, good) over palette names.`;

export const blueprintLook = defineLook({
  id: 'blueprint',
  label: 'Blueprint / data',
  description:
    'technical blueprints and data: schematics, node graphs, timelines, charts from pasted numbers, maps and counters on blueprint paper',
  rolls: ['B', 'C'],
  treatments: [
    'data-chart-3d',
    'map',
    'node-graph/timeline',
    'counter/odometer',
    '3d-reconstruction',
    'title-card',
  ],
  docs: DOCS,
  soundPalette: 'blueprint',
  variationBudget: 'blueprint',
  available: true,
  kit: {
    env: [blueprintSheet],
    templates: [
      blueprintChart,
      blueprintCounter,
      blueprintGraph,
      blueprintTimeline,
      blueprintMap,
      blueprintSchematic,
    ],
  },
});
