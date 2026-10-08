/**
 * Palette `sketchbook` (world Sketchbook, PLAN.md#13.6): the desk of one notebook heard up close —
 * a pencil scratching, a ballpoint clicked on and off (`pen-click`), a marker slammed onto the page
 * (`marker-thump`), paper rustling and torn (`paper-tear`), tape ripped off the roll and pressed
 * down, a clear ruler ticking on the page, pages flipping and riffling. The page-native
 * transitions sound like themselves (WORLD_TRANSITION_SFX). Every sound is a built-in recipe
 * synthesized in pure Node (packages/pipeline sfx); the three named above are the world's own, the
 * rest is shared: a world's style is exclusive (ADR-029), its films never mix with the built-in
 * looks, so this palette may reuse their paper and pen recipes (`world`). Bed: a quiet room.
 */
import type { SketchbookTransitionId } from '@reelforge/engine';
import { only, pick, type PaletteSlot, type SoundPalette } from './types.js';

/** Sounds that hit at their start land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.03 } as const;

export const SKETCHBOOK_PALETTE: SoundPalette = {
  id: 'sketchbook',
  label: 'Sketchbook',
  world: 'sketchbook',
  sfx: {
    'transition-cut': [
      [
        pick('pen-click', ['off'], ON_CUT),
        pick('paper-rustle', ['soft'], { leadS: 0.1, weight: 0.5 }),
      ],
      [
        pick('page-flip', ['flip'], { leadS: 0.18 }),
        pick('paper-rustle', ['soft'], { weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('paper-rustle', 'soft'),
    'transition-glitch': [[pick('paper-rustle', ['crinkle'])], [pick('paper-tear', ['rip'])]],
    'transition-wipe': [[pick('page-flip', ['flip', 'turn'], { leadS: 0.15 })]],
    appear: [
      [pick('pencil-scratch', ['line'])],
      [pick('marker-thump', ['tap'])],
      [pick('marker-stroke', ['short'])],
    ],
    'list-item': only('board-tick'),
    'counter-step': [[pick('ruler-tick', ['plastic'])], [pick('ruler-tick', ['double'])]],
    'counter-final': [[pick('paper-pop', ['mid'])], [pick('tape-tear', ['stick'])]],
    number: [[pick('pen-click', ['on'])], [pick('pen-click', ['double'])]],
    'number-big': [
      [pick('marker-thump', ['thump'], ON_CUT), pick('marker-stroke', ['long'], { weight: 0.5 })],
    ],
    'text-in': only('pencil-scratch', 'line', 'circle'),
    'text-typed': only('pencil-scratch', 'hatch'),
    'emphasis-riser': only('marker-stroke', 'long'),
    'emphasis-hit': only('marker-thump', 'slam'),
    'end-card': [[pick('page-flip', ['turn']), pick('pen-click', ['off'], { weight: 0.5 })]],
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      scribble: 'pencil-scratch',
      typewriter: 'pencil-scratch',
      paper: 'paper-rustle',
      whoosh: 'page-flip',
      'swoosh-in': 'paper-rustle',
      'swoosh-out': 'paper-rustle',
      pop: 'paper-pop',
      bubble: 'paper-pop',
      blip: 'pen-click',
      click: 'pen-click',
      tick: 'ruler-tick',
      tock: 'ruler-tick',
      stamp: 'marker-thump',
      snap: 'tape-tear',
      'camera-shutter': 'pen-click',
    },
    byCategory: {
      motion: 'paper-rustle',
      impact: 'marker-thump',
      texture: 'pencil-scratch',
      ui: 'pen-click',
      tonal: 'page-flip',
    },
  },
  accents: {
    '': [pick('page-flip', ['turn'], { leadS: 0.25 }), pick('pen-click', ['on'], { weight: 0.5 })],
  },
  ambience: {
    key: () => '',
    bed: () => 'room-tone',
    gainDb: -33,
    underMusic: () => 'room-tone',
    underMusicGainDb: -36,
  },
};

/** The sound of each page-native transition of the world (engine `SKETCHBOOK_TRANSITION_IDS`). */
export const WORLD_TRANSITION_SFX: Readonly<Record<SketchbookTransitionId, PaletteSlot>> = {
  'sketchbook-page-flip': [pick('page-flip', ['flip', 'turn'], { leadS: 0.12 })],
  'sketchbook-riffle': [pick('page-flip', ['riffle'], { leadS: 0.1 })],
  'sketchbook-crumple-toss': [
    pick('paper-rustle', ['crinkle'], { leadS: 0.05 }),
    pick('paper-rustle', ['busy'], { weight: 0.5 }),
  ],
  'sketchbook-tape-peel': [pick('tape-tear', ['peel'], { leadS: 0.05 })],
  'sketchbook-torn-strip': [pick('paper-tear', ['tear'], ON_CUT)],
};
