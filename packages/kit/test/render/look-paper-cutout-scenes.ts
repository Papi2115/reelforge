/**
 * Scenes of the paper cut-out look render tests (PLAN.md#12.6): one scene module (plain JS, scene
 * contract) with a setup per template, picked by `const SETUP`, plus the words the title card
 * lands on (ctx.anchor).
 */
import type { RenderManifest } from '../support/scenes.js';

export const PAPER_SETUPS = [
  'dusk',
  'day',
  'night',
  'city',
  'room',
  'stack',
  'card',
  'wobble',
  'parallax',
] as const;

export type PaperSetup = (typeof PAPER_SETUPS)[number];

const FILE = 'look-paper-cutout.js';

const SOURCE = String.raw`
// Look paper-cutout (PLAN.md#12.6): one setup per template, picked by SETUP.
export const meta = { id: 'p12', title: 'Look paper cut-out', treatment: 'character-scene' };

const SETUP = 'dusk';

const SETUPS = {
  dusk: {
    stage: { backdrop: 'dusk', seed: 3 },
    pieces: (kit) => [
      [kit.props.paperPuppet({ walk: { from: 90, to: 300, start: 0.2, end: 3.2 }, pose: 'wave', seed: 1 }), { layer: 4, y: 318 }],
      [kit.props.paperSign({ text: 'HOME', seed: 2 }), { layer: 4, x: 500, y: 322 }],
    ],
    camera: (t) => ({ pan: -24 + 8 * t }),
  },
  day: {
    stage: { backdrop: 'day', hills: 'peaks', seed: 8 },
    pieces: (kit) => [
      [kit.props.paperTrees({ kind: 'round', count: 3, spread: [380, 600], height: 70, tone: 'green', seed: 4 }), { layer: 4, y: 330 }],
      [kit.props.paperLabel({ text: 'THE VALLEY', scale: 2, at: 0.3, seed: 5 }), { layer: 5, x: 170, y: 70 }],
    ],
    camera: () => ({}),
  },
  night: {
    stage: { backdrop: 'night', hills: 'dunes', layers: 4, seed: 6 },
    pieces: (kit) => [
      [kit.props.paperPuppet({ pose: 'point', facing: 'left', coat: 'teal', seed: 3 }), { layer: 5, x: 470, y: 346 }],
    ],
    camera: () => ({}),
    annotate(ctx, pieces) {
      ctx.annotate.callout({ id: 'moon', target: { object: pieces[0], anchor: 'hand' }, text: 'LOOK!', at: 0.6 });
    },
  },
  city: {
    stage: { backdrop: 'dusk', scenery: 'city', seed: 9 },
    pieces: (kit) => [
      [kit.props.paperPuppet({ pose: 'talk', coat: 'pink', seed: 6 }), { layer: 4, x: 210, y: 336 }],
      [kit.props.paperClouds({ count: 2, band: [30, 70], seed: 2 }), { layer: 1 }],
    ],
    camera: () => ({}),
  },
  room: {
    stage: { backdrop: 'paper', scenery: 'none', sky: false, light: 'high', seed: 2 },
    pieces: (kit) => [
      [kit.props.paperRoom({ seed: 4 }), { layer: 2 }],
      [kit.props.paperPuppet({ pose: 'cheer', seed: 5 }), { layer: 4, x: 360, y: 312 }],
      [kit.props.paperLabel({ text: 'GRANDMA', pin: 'tape', at: 0.5, seed: 1 }), { layer: 5, x: 470, y: 64 }],
    ],
    camera: () => ({ drift: 0 }),
    annotate(ctx, pieces) {
      ctx.annotate.ring({ id: 'window', target: { object: pieces[0], anchor: 'window' }, radius: 0.08, at: 1.5 });
    },
  },
  stack: {
    stage: { backdrop: 'kraft', scenery: 'none', sky: false, light: 'high', seed: 7 },
    pieces: (kit) => [
      [kit.props.paperStack({ kind: 'mixed', count: 5, caption: 'SUMMER 1969', at: 0.2, seed: 3 }), { layer: 3, x: 250, y: 185 }],
      [kit.props.paperLabel({ text: 'EVIDENCE', pin: 'tape', scale: 2, at: 1.4, seed: 2 }), { layer: 5, x: 480, y: 90 }],
    ],
    camera: () => ({ drift: 0 }),
  },
  card: {
    stage: { backdrop: 'dusk', layers: 2, seed: 12 },
    pieces: (kit, ctx) => [
      [kit.props.paperCard({ title: 'CHAPTER ONE', subtitle: 'THE PAPER TOWN', at: ctx.anchor('chapter one').t, seed: 4 }), { layer: 5, y: 150 }],
    ],
    camera: () => ({}),
  },
  wobble: {
    stage: { backdrop: 'day', scenery: 'hills', layers: 2, drift: 0, seed: 5 },
    pieces: (kit) => [
      [kit.props.paperPuppet({ pose: 'wave', height: 150, seed: 7 }), { layer: 4, x: 320, y: 340 }],
    ],
    camera: () => ({}),
  },
  parallax: {
    stage: { backdrop: 'night', scenery: 'city', drift: 0, seed: 4 },
    pieces: (kit) => [[kit.props.paperSign({ text: 'MAIN ST', swing: 0, seed: 1 }), { layer: 5, x: 320, y: 352 }]],
    camera: () => ({}),
    move(ctx) {
      ctx.camera.parallax({ amount: 0.6, t0: 0.5, t1: 3.5 });
    },
  },
};

export function build(ctx) {
  const { scene, kit } = ctx;
  const setup = SETUPS[SETUP];
  const stage = kit.env.paperStage({ size: [ctx.shot.width, ctx.shot.height], ...setup.stage });
  const pieces = setup.pieces(kit, ctx).map(([piece, placement]) => stage.place(piece, placement));
  scene.add(stage);
  return { setup, stage, pieces };
}

export function update(t, state, ctx) {
  state.stage.update(t);
  ctx.camera.set(state.stage.camera({ t, ...state.setup.camera(t) }));
  if (state.setup.move) state.setup.move(ctx);
  if (state.setup.annotate) state.setup.annotate(ctx, state.pieces);
}
`;

const WORDS: readonly (readonly [string, number])[] = [
  ['once', 0.2],
  ['upon', 0.45],
  ['a', 0.7],
  ['time', 0.8],
  ['chapter', 1.2],
  ['one', 1.6],
];

export function paperSource(setup: PaperSetup): string {
  const declaration = "const SETUP = 'dusk';";
  if (!SOURCE.includes(declaration)) throw new Error(`the scene no longer declares ${declaration}`);
  return SOURCE.replace(declaration, `const SETUP = '${setup}';`);
}

export function paperManifest(setup: PaperSetup, style?: string): RenderManifest {
  return {
    version: 1,
    ...(style === undefined ? { width: 640, height: 360 } : { style }),
    fps: 30,
    seed: 2115,
    words: {
      version: 1,
      words: WORDS.map(([text, t]) => ({ text, t, tEnd: t + 0.25 })),
    },
    shots: [{ id: 'p12', t0: 0, t1: 6, scene: { file: FILE, source: paperSource(setup) } }],
  };
}
