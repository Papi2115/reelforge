/**
 * Scenes of the blueprint look render tests (PLAN.md#12.4): one scene module (plain JS, scene
 * contract) with a setup per template, picked by `const SETUP`, plus the words of the CSV scene
 * (its bars land on spoken phrases through ctx.anchor).
 */
import type { RenderManifest } from '../support/scenes.js';

export const BLUEPRINT_SETUPS = [
  'csv',
  'area',
  'hbar',
  'counter',
  'graph',
  'timeline',
  'map',
  'europe',
  'schematic',
  'sheet',
  'hybrid',
] as const;

export type BlueprintSetup = (typeof BLUEPRINT_SETUPS)[number];

const FILE = 'look-blueprint.js';

const SOURCE = String.raw`
// Look blueprint (PLAN.md#12.4): one setup per template, picked by SETUP.
export const meta = { id: 'b12', title: 'Look blueprint', treatment: 'data-chart-3d' };

const SETUP = 'csv';

const CSV = [
  'year,units,say',
  '1998,12,nineteen ninety eight',
  '2000,40,two thousand',
  '2005,95,two thousand and five',
  '2010,61,twenty ten',
  '2020,18,twenty twenty',
].join('\n');

const SETUPS = {
  csv: (kit, ctx, size) =>
    kit.fx.blueprintChart({
      size,
      anchor: ctx.anchor,
      title: 'FIG. 1 UNITS SOLD',
      csv: CSV,
      suffix: 'M',
      highlight: { item: '2005', at: 'peak' },
    }),
  area: (kit, ctx, size) =>
    kit.fx.blueprintChart({
      size,
      type: 'area',
      title: 'FIG. 2 PLAYERS ONLINE',
      labels: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      series: [
        { name: 'PC', values: [3, 5, 9, 14, 12, 18, 22] },
        { name: 'CONSOLE', values: [1, 2, 4, 6, 9, 11, 10] },
      ],
      suffix: 'K',
    }),
  hbar: (kit, ctx, size) =>
    kit.fx.blueprintChart({
      size,
      type: 'hbar',
      title: 'FIG. 3 DOOM FRAME RATE',
      labels: ['PREGNANCY TEST', 'CALCULATOR', 'FRIDGE', 'TRACTOR', 'LAPTOP'],
      values: [3, 12, 35, 20, 60],
      suffix: ' FPS',
      highlight: { item: 0, at: 3 },
    }),
  counter: (kit, ctx, size) =>
    kit.fx.blueprintCounter({
      size,
      title: 'FIG. 4 COST',
      from: 0,
      to: 1250000,
      start: 0.3,
      end: 3,
      prefix: '$',
      label: 'TOTAL DAMAGE',
    }),
  graph: (kit, ctx, size) =>
    kit.fx.blueprintGraph({
      size,
      title: 'FIG. 5 BUILD PIPELINE',
      nodes: [
        { id: 'src', label: 'SOURCE' },
        { id: 'wad', label: 'WAD FILES' },
        { id: 'cc', label: 'COMPILER' },
        { id: 'bin', label: 'BINARY' },
        { id: 'dev', label: 'DEVICE', shape: 'diamond' },
      ],
      edges: [
        { from: 'src', to: 'cc' },
        { from: 'cc', to: 'bin' },
        { from: 'wad', to: 'bin', dashed: true },
        { from: 'bin', to: 'dev', label: 'FLASH' },
      ],
      highlights: [{ id: 'bin', at: 3.5 }],
    }),
  timeline: (kit, ctx, size) =>
    kit.fx.blueprintTimeline({
      size,
      title: 'FIG. 6 DOOM PORTS',
      events: [
        { value: 1993, label: 'DOOM', caption: 'MS-DOS' },
        { value: 1997, label: 'SOURCE', caption: 'GPL LATER' },
        { value: 2003, label: 'PORTS' },
        { value: 2014, label: 'CALCULATOR' },
        { value: 2020, label: 'PREG. TEST' },
      ],
      views: [{ at: 3.6, range: [2010, 2022] }],
    }),
  map: (kit, ctx, size) =>
    kit.fx.blueprintMap({
      size,
      title: 'FIG. 7 SHIPPING ROUTE',
      markers: [
        { id: 'sz', position: [114.1, 22.5], label: 'SHENZHEN', at: 0.3 },
        { id: 'rt', position: [4.5, 51.9], label: 'ROTTERDAM', at: 1.2 },
        { id: 'ny', position: [-74, 40.7], label: 'NEW YORK', at: 1.6 },
      ],
      routes: [
        { from: 'sz', to: 'rt', at: 1.2, duration: 1.5 },
        { from: 'rt', to: 'ny', at: 2.4, duration: 1 },
      ],
      highlights: [{ region: 'china', at: 0.5 }],
    }),
  europe: (kit, ctx, size) =>
    kit.fx.blueprintMap({
      size,
      view: 'world',
      views: [{ at: 0.5, view: 'europe' }],
      borders: true,
      highlights: [
        { region: 'POL', at: 1.6 },
        { region: 'France', at: 2, color: 'alt' },
      ],
      markers: [{ position: [21, 52.2], label: 'WARSAW', at: 2.2 }],
    }),
  schematic: (kit, ctx, size) =>
    kit.fx.blueprintSchematic({
      size,
      title: 'FIG. 8 NOKIA 3310',
      titleBlock: { title: 'HANDSET', code: 'N-3310', scale: '2:1' },
      parts: [
        { kind: 'rect', box: [250, 60, 120, 250], round: 24, width: 2 },
        { kind: 'rect', box: [272, 96, 76, 62], fill: 'hatch', color: 'accent' },
        { kind: 'circle', center: [310, 205], r: 18 },
        { kind: 'rect', box: [270, 236, 80, 54], round: 6, line: 'dashed', color: 'dim' },
        { kind: 'line', points: [[310, 40], [310, 330]], line: 'center', color: 'dim' },
      ],
      dimensions: [
        { from: [250, 310], to: [370, 310], text: '48 MM', offset: -16, at: 2.6 },
        { from: [370, 60], to: [370, 310], text: '113 MM', offset: 26, at: 2.9 },
      ],
      callouts: [
        { target: [300, 120], text: 'LCD 84X48', number: 1, at: 3.2, label: [160, 100] },
        { target: [310, 205], text: 'NAVI KEY', number: 2, at: 3.6, label: [160, 200] },
        { target: [340, 262], text: 'KEYPAD', number: 3, at: 4, label: [440, 270] },
      ],
    }),
  sheet: (kit, ctx, size) =>
    kit.env.blueprintSheet({
      size,
      headline: 'HOW DOOM RUNS',
      subline: 'ON A PREGNANCY TEST',
      titleBlock: { title: 'DOOM PORT', code: 'RF-07' },
    }),
  hybrid: (kit, ctx, size) =>
    kit.env.blueprintSheet({ size, title: 'FIG. 9 THE CALCULATOR', drift: [0, -3] }),
};

export function build(ctx) {
  const { kit, scene } = ctx;
  const size = [ctx.shot.width, ctx.shot.height];
  const board = SETUPS[SETUP](kit, ctx, size);
  scene.add(board);
  let hero;
  if (SETUP === 'hybrid') {
    scene.add(kit.env.lights({ preset: 'default' }));
    hero = kit.props.calculator({ scale: 1.6 });
    hero.position.set(0.6, -0.4, 0);
    scene.add(hero);
  }
  return { board, hero };
}

export function update(t, state, ctx) {
  state.board.update(t);
  if (state.hero) {
    state.hero.rotation.y = -0.5 + t * 0.25;
    ctx.camera.set({ position: [0, 1.4, 5.2], target: [0, 0, 0], fov: 40 });
  }
}
`;

/** The scene with another setup selected. */
export function blueprintSource(setup: BlueprintSetup): string {
  return SOURCE.replace("const SETUP = 'csv';", `const SETUP = '${setup}';`);
}

/** Narration of the CSV scene: each bar is revealed by the phrase in its `say` column. */
const WORDS: readonly (readonly [string, number])[] = [
  ['sales', 0.3],
  ['in', 0.6],
  ['nineteen', 1.0],
  ['ninety', 1.2],
  ['eight', 1.4],
  ['then', 1.6],
  ['two', 1.8],
  ['thousand', 2.0],
  ['then', 2.3],
  ['two', 2.6],
  ['thousand', 2.75],
  ['and', 2.9],
  ['five', 3.0],
  ['the', 3.3],
  ['peak', 3.4],
  ['twenty', 3.7],
  ['ten', 3.9],
  ['and', 4.1],
  ['twenty', 4.3],
  ['twenty', 4.5],
];

/** Spoken time of the CSV scene's bars, in row order (used by the reveal test). */
export const CSV_REVEALS = [1.0, 1.8, 2.6, 3.7, 4.3] as const;

export function blueprintManifest(setup: BlueprintSetup, style?: string): RenderManifest {
  return {
    version: 1,
    ...(style === undefined ? { width: 640, height: 360 } : { style }),
    fps: 30,
    seed: 2115,
    words: {
      version: 1,
      words: WORDS.map(([text, t]) => ({ text, t, tEnd: t + 0.18 })),
    },
    shots: [{ id: 'b12', t0: 0, t1: 6, scene: { file: FILE, source: blueprintSource(setup) } }],
  };
}
