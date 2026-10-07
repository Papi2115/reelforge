/**
 * Palette `sketchbook` (world Sketchbook, PLAN.md#13.6): the desk of one notebook heard up close —
 * a pencil scratching, a ballpoint clicked on, soft thumps of a marker slammed onto the page,
 * paper rustling, tape ripped off the roll and pressed down, a clear ruler ticking on the page,
 * pages flipping and riffling. The page-native transitions sound like themselves
 * (WORLD_TRANSITION_SFX). Every sound is a built-in recipe synthesized in pure Node
 * (packages/pipeline sfx); there is no paper-tear recipe, so the torn strip rips like tape. A
 * world's style is exclusive (ADR-029): its films never mix with the built-in looks, so this
 * palette may reuse their paper and pen recipes (`world`). Bed: a quiet room.
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
        pick('cap-pop', ['click'], ON_CUT),
        pick('paper-rustle', ['soft'], { leadS: 0.1, weight: 0.5 }),
      ],
      [
        pick('page-flip', ['flip'], { leadS: 0.18 }),
        pick('paper-rustle', ['soft'], { weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('paper-rustle', 'soft'),
    'transition-glitch': only('paper-rustle', 'crinkle'),
    'transition-wipe': [[pick('page-flip', ['flip', 'turn'], { leadS: 0.15 })]],
    appear: [
      [pick('pencil-scratch', ['line'])],
      [pick('paper-pop', ['low'])],
      [pick('marker-stroke', ['short'])],
    ],
    'list-item': only('board-tick'),
    'counter-step': [[pick('ruler-tick', ['plastic'])], [pick('ruler-tick', ['double'])]],
    'counter-final': [[pick('paper-pop', ['mid'])], [pick('tape-tear', ['stick'])]],
    number: only('cap-pop', 'click'),
    'number-big': [
      [pick('paper-pop', ['low'], ON_CUT), pick('marker-stroke', ['long'], { weight: 0.5 })],
    ],
    'text-in': only('pencil-scratch', 'line', 'circle'),
    'text-typed': only('pencil-scratch', 'hatch'),
    'emphasis-riser': only('marker-stroke', 'long'),
    'emphasis-hit': only('paper-pop', 'low'),
    'end-card': [[pick('page-flip', ['turn']), pick('cap-pop', ['on'], { weight: 0.5 })]],
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
      blip: 'cap-pop',
      click: 'cap-pop',
      tick: 'ruler-tick',
      tock: 'ruler-tick',
      stamp: 'paper-pop',
      snap: 'tape-tear',
      'camera-shutter': 'cap-pop',
    },
    byCategory: {
      motion: 'paper-rustle',
      impact: 'paper-pop',
      texture: 'pencil-scratch',
      ui: 'cap-pop',
      tonal: 'page-flip',
    },
  },
  accents: {
    '': [pick('page-flip', ['turn'], { leadS: 0.25 }), pick('cap-pop', ['click'], { weight: 0.5 })],
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
  'sketchbook-torn-strip': [pick('tape-tear', ['tear'], ON_CUT)],
};
