/**
 * Scenes of the flat-2d look render tests (PLAN.md#12.5): one scene module (plain JS, scene
 * contract) with a setup per template, picked by `const SETUP`, plus the narration its spoken
 * cues land on (words, steps and shapes enter on phrases through ctx.anchor).
 */
import type { RenderManifest } from '../support/scenes.js';

export const FLAT_SETUPS = [
  'stage',
  'shapes',
  'icons',
  'sheet',
  'steps',
  'progress',
  'ring',
  'versus',
  'stat',
  'kinetic',
  'lower',
  'annotated',
] as const;

export type FlatSetup = (typeof FLAT_SETUPS)[number];

const FILE = 'look-flat-2d.js';

const SOURCE = String.raw`
// Look flat-2d (PLAN.md#12.5): one setup per template, picked by SETUP.
export const meta = { id: 'f12', title: 'Look flat-2d', treatment: 'kinetic-text' };

const SETUP = 'stage';

const SETUPS = {
  stage: (kit, ctx, size) => [
    kit.env.flatStage({ size, stage: 'rays', decor: 8, decorStyle: 'confetti' }),
    kit.fx.flatKinetic({ size, stage: 'none', layer: 1, text: 'CHAPTER TWO / THE *COMEBACK*', effect: 'drop', mark: 'plate' }),
  ],
  shapes: (kit, ctx, size) => [
    kit.fx.flatShapes({
      size,
      anchor: ctx.anchor,
      tone: 'teal',
      stage: 'dots',
      shapes: [
        { kind: 'circle', x: 150, y: 165, w: 110, label: '1', at: 'one' },
        { kind: 'rect', x: 320, y: 165, w: 120, h: 96, round: 16, label: '2', at: 'two', idle: 'float' },
        { kind: 'triangle', x: 490, y: 160, w: 120, h: 104, label: '3', at: 'three', morph: [{ at: 'star', kind: 'star', w: 140, h: 140, color: 'gold' }] },
        { kind: 'arrow', points: [[110, 285], [530, 285]], thickness: 5, color: 'ink', at: 0.2 },
        { kind: 'ring', x: 560, y: 70, w: 44, thickness: 8, color: 'tertiary', at: 0.6, idle: 'pulse' },
        { kind: 'plus', x: 80, y: 70, w: 36, color: 'good', at: 0.8, idle: 'spin' },
      ],
    }),
  ],
  icons: (kit, ctx, size) => [
    kit.fx.flatIcons({
      size,
      tone: 'violet',
      icons: [
        { name: 'cloud', x: 130, y: 160, scale: 4, label: 'CLOUD', badgeColor: 'secondary' },
        { name: 'lock', x: 260, y: 160, scale: 4, label: 'LOCKED', enter: 'drop', badgeColor: 'card' },
        { name: 'shield', x: 390, y: 160, scale: 4, label: 'SAFE', enter: 'slide-up', badge: 'square', badgeColor: 'card' },
        { name: 'rocket', x: 520, y: 160, scale: 4, label: 'FAST', idle: 'float', badgeColor: 'tertiary', color: 'light' },
      ],
    }),
  ],
  sheet: (kit, ctx, size) => [kit.fx.flatIcons({ size, sheet: true, stage: 'solid' })],
  steps: (kit, ctx, size) => [
    kit.fx.flatInfographic({
      size,
      anchor: ctx.anchor,
      title: 'HOW IT SHIPS',
      items: [
        { label: 'IDEA', icon: 'lightbulb', at: 'idea' },
        { label: 'CODE', icon: 'gear', at: 'code' },
        { label: 'TEST', icon: 'check', at: 'test' },
        { label: 'LAUNCH', icon: 'rocket', at: 'launch' },
      ],
    }),
  ],
  progress: (kit, ctx, size) => [
    kit.fx.flatInfographic({
      size,
      kind: 'progress',
      tone: 'night',
      stage: 'grid',
      title: 'BATTERY AFTER A DAY',
      suffix: '%',
      highlight: 0,
      items: [
        { label: 'NOKIA 3310', value: 92 },
        { label: 'SMARTPHONE', value: 34 },
        { label: 'SMARTWATCH', value: 18 },
      ],
    }),
  ],
  ring: (kit, ctx, size) => [
    kit.fx.flatInfographic({
      size,
      kind: 'ring',
      stage: 'spot',
      title: 'PHONE MARKET 2000',
      suffix: '%',
      items: [
        { label: 'NOKIA', value: 41 },
        { label: 'MOTOROLA', value: 15 },
        { label: 'OTHERS', value: 44 },
      ],
    }),
  ],
  versus: (kit, ctx, size) => [
    kit.fx.flatInfographic({
      size,
      kind: 'versus',
      tone: 'wine',
      stage: 'stripes',
      title: 'STANDBY TIME',
      suffix: ' H',
      items: [
        { label: 'NOKIA 3310', value: 260, icon: 'phone' },
        { label: 'SMARTPHONE', value: 30, icon: 'battery' },
      ],
    }),
  ],
  stat: (kit, ctx, size) => [
    kit.fx.flatInfographic({
      size,
      kind: 'stat',
      tone: 'cream',
      stage: 'checker',
      items: [
        { label: 'UNITS SOLD', value: 126000000, icon: 'phone' },
      ],
    }),
  ],
  kinetic: (kit, ctx, size) => [
    kit.fx.flatKinetic({
      size,
      anchor: ctx.anchor,
      stage: 'gradient',
      words: [
        { text: 'IT', at: 'it' },
        { text: 'NEVER', at: 'never', effect: 'shake', color: 'tertiary' },
        { text: 'DIED', at: 'died', effect: 'slide', mark: 'underline' },
        { text: 'IT', at: 'it#2', br: true, effect: 'type' },
        { text: 'WAITED', at: 'waited', effect: 'drop', mark: 'box' },
      ],
      markColor: 'secondary',
    }),
  ],
  lower: (kit, ctx, size) => [
    kit.env.flatStage({ size, stage: 'gradient', tone: 'indigo', decor: 0 }),
    kit.fx.flatLowerThird({ size, anchor: ctx.anchor, name: 'ANSSI VANJOKI', caption: 'NOKIA, EXECUTIVE VP', icon: 'person', at: 'anssi', out: 4.6 }),
  ],
  annotated: (kit, ctx, size) => [
    kit.fx.flatInfographic({
      size,
      kind: 'stat',
      prefix: '$',
      suffix: 'B',
      stagger: 0.3,
      items: [
        { label: 'REVENUE', value: 31, icon: 'coin' },
        { label: 'PROFIT', value: 4, icon: 'chart' },
        { label: 'R&D', value: 3, icon: 'gear' },
      ],
    }),
  ],
};

export function build(ctx) {
  const { kit, scene } = ctx;
  const size = [ctx.shot.width, ctx.shot.height];
  const boards = SETUPS[SETUP](kit, ctx, size);
  for (const board of boards) scene.add(board);
  let hero;
  if (SETUP === 'lower') {
    scene.add(kit.env.lights({ preset: 'default' }));
    hero = kit.props.calculator({ scale: 1.5 });
    hero.position.set(0.9, -0.1, 0);
    scene.add(hero);
  }
  return { boards, hero };
}

export function update(t, state, ctx) {
  for (const board of state.boards) board.update(t);
  if (state.hero) {
    state.hero.rotation.y = -0.6 + t * 0.25;
    ctx.camera.set({ position: [0, 1.2, 5.2], target: [0, 0, 0], fov: 40 });
  }
  if (SETUP === 'annotated') {
    ctx.annotate.ring({ id: 'profit', target: state.boards[0].target('item:1'), shape: 'rect', at: 2.6 });
  }
  if (SETUP === 'icons') {
    ctx.annotate.ring({ id: 'safe', target: state.boards[0].target('icon:shield'), shape: 'rect', at: 2.4 });
  }
}
`;

/** The scene with another setup selected. */
export function flatSource(setup: FlatSetup): string {
  return SOURCE.replace("const SETUP = 'stage';", `const SETUP = '${setup}';`);
}

/** Narration the spoken cues of the scenes land on. */
const WORDS: readonly (readonly [string, number])[] = [
  ['one', 0.3],
  ['it', 0.5],
  ['idea', 0.7],
  ['never', 0.9],
  ['two', 1.1],
  ['anssi', 1.3],
  ['code', 1.5],
  ['died', 1.7],
  ['three', 1.9],
  ['test', 2.1],
  ['it', 2.3],
  ['star', 2.5],
  ['launch', 2.7],
  ['waited', 2.9],
];

export function flatManifest(setup: FlatSetup, style?: string): RenderManifest {
  return {
    version: 1,
    ...(style === undefined ? { width: 640, height: 360 } : { style }),
    fps: 30,
    seed: 2125,
    words: {
      version: 1,
      words: WORDS.map(([text, t]) => ({ text, t, tEnd: t + 0.15 })),
    },
    shots: [{ id: 'f12', t0: 0, t1: 6, scene: { file: FILE, source: flatSource(setup) } }],
  };
}
