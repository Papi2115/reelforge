/**
 * Scenes of the whiteboard look render tests (PLAN.md#12.7): one scene module (plain JS, scene
 * contract) with a setup per template, picked by `const SETUP`, plus the narration its strokes
 * land on through ctx.anchor.
 */
import type { RenderManifest } from '../support/scenes.js';

export const WHITEBOARD_SETUPS = [
  'sketch',
  'doodles',
  'text',
  'flow',
  'timeline',
  'equation',
  'counter',
  'board',
  'erase',
  'hybrid',
] as const;

export type WhiteboardSetup = (typeof WHITEBOARD_SETUPS)[number];

const FILE = 'look-whiteboard.js';

const SOURCE = String.raw`
// Look whiteboard (PLAN.md#12.7): one setup per template, picked by SETUP.
export const meta = { id: 'w07', title: 'Look whiteboard', treatment: 'metaphor-object' };

const SETUP = 'sketch';

const SETUPS = {
  sketch: (kit, ctx, size) =>
    kit.fx.whiteboardSketch({
      size,
      anchor: ctx.anchor,
      strokes: [
        { draw: 'bulb 190 160 130', at: 'an idea', id: 'idea' },
        { draw: 'arrow 270 160 370 160 red', at: 'turns into' },
        { draw: 'gear 450 160 120 blue', at: 'work', id: 'work' },
        { draw: 'write 190 262 IDEA', scale: 3 },
        { draw: 'write 450 262 WORK', scale: 3 },
      ],
    }),
  doodles: (kit, ctx, size) =>
    kit.fx.whiteboardSketch({
      size,
      pen: 'marker',
      speed: 900,
      strokes: [
        'person 90 105 80', 'bulb 200 105 80', 'computer 310 105 80', 'axes 420 105 80', 'rocket 530 105 80',
        'house 90 205 80', 'gear 200 205 80 blue', 'cloud 310 205 80', 'magnifier 420 205 80', 'coin 530 205 80',
        'heart 90 290 60 red', 'question 200 290 60', 'check 310 290 60 green', 'bars 420 290 64', 'pie 530 290 64',
      ],
    }),
  text: (kit, ctx, size) =>
    kit.fx.whiteboardText({
      size,
      anchor: ctx.anchor,
      title: 'THE BIG IDEA',
      lines: [{ text: 'SMALL HABITS', at: 'small habits' }, { text: 'BIG RESULTS', at: 'big results' }],
      emphasis: [{ word: 'big', style: 'circle' }, { word: 'habits', style: 'underline', color: 'blue' }],
    }),
  flow: (kit, ctx, size) =>
    kit.fx.whiteboardDiagram({
      size,
      anchor: ctx.anchor,
      nodes: [
        { id: 'idea', label: 'IDEA', doodle: 'bulb', at: 'an idea' },
        { id: 'build', label: 'BUILD', shape: 'box' },
        { id: 'users', label: 'USERS', shape: 'circle', at: 'work' },
        { id: 'cash', label: 'MONEY', doodle: 'coin' },
      ],
    }),
  timeline: (kit, ctx, size) =>
    kit.fx.whiteboardDiagram({
      size,
      kind: 'timeline',
      grid: 'dots',
      title: 'HISTORY',
      start: 0.2,
      events: [
        { label: '1969', caption: 'ARPANET' },
        { label: '1991', caption: 'WWW' },
        { label: '2007', caption: 'IPHONE' },
        { label: '2022', caption: 'AI CHAT', color: 'green' },
      ],
    }),
  equation: (kit, ctx, size) =>
    kit.fx.whiteboardDiagram({
      size,
      kind: 'equation',
      pen: 'marker',
      terms: [{ doodle: 'bulb' }, '+', 'WORK', '=', { doodle: 'trophy', color: 'blue' }],
    }),
  counter: (kit, ctx, size) =>
    kit.fx.whiteboardCounter({
      size,
      values: [100, { value: 2500, at: 1.8 }, { value: 1250000, at: 3.2 }],
      prefix: '$',
      label: 'COST OF THE PROJECT',
    }),
  board: (kit, ctx, size) =>
    kit.env.whiteboardBoard({ size, headline: 'WHY CATS PURR', subline: 'A SHORT EXPLAINER', grid: 'lines' }),
  erase: (kit, ctx, size) =>
    kit.fx.whiteboardSketch({
      size,
      strokes: ['house 220 170 140', 'cloud 450 120 120 blue', { draw: 'rocket 320 180 170 red', at: 3.4 }],
      erase: [{ at: 2.2, duration: 1 }],
    }),
  hybrid: (kit, ctx, size) =>
    kit.env.whiteboardBoard({ size, title: 'THE CALCULATOR', pen: 'none', strokes: ['arrow 420 120 340 170 red'] }),
};

export function build(ctx) {
  const { kit, scene } = ctx;
  const size = [ctx.shot.width, ctx.shot.height];
  const board = SETUPS[SETUP](kit, ctx, size);
  scene.add(board);
  let hero;
  if (SETUP === 'hybrid') {
    scene.add(kit.env.lights({ preset: 'default' }));
    hero = kit.props.calculator({ scale: 1.4 });
    hero.position.set(-0.4, -0.5, 0);
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
export function whiteboardSource(setup: WhiteboardSetup): string {
  return SOURCE.replace("const SETUP = 'sketch';", `const SETUP = '${setup}';`);
}

/** Narration: the sketch and flow strokes land on these phrases. */
const WORDS: readonly (readonly [string, number])[] = [
  ['every', 0.2],
  ['product', 0.4],
  ['starts', 0.7],
  ['with', 0.9],
  ['an', 1.0],
  ['idea', 1.15],
  ['small', 1.3],
  ['habits', 1.55],
  ['that', 2.2],
  ['idea', 2.4],
  ['turns', 2.6],
  ['into', 2.8],
  ['big', 3.3],
  ['results', 3.5],
  ['work', 3.9],
];

/** Spoken time of the sketch strokes (bulb, arrow, gear), used by the sync test. */
export const SKETCH_CUES = [1.0, 2.6, 3.9] as const;

export function whiteboardManifest(setup: WhiteboardSetup, style?: string): RenderManifest {
  return {
    version: 1,
    ...(style === undefined ? { width: 640, height: 360 } : { style }),
    fps: 30,
    seed: 2115,
    words: {
      version: 1,
      words: WORDS.map(([text, t]) => ({ text, t, tEnd: t + 0.18 })),
    },
    shots: [{ id: 'w07', t0: 0, t1: 9, scene: { file: FILE, source: whiteboardSource(setup) } }],
  };
}
