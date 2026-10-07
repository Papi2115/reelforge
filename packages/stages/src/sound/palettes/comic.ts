/**
 * Palette `comic` (world Comic, PLAN.md#13.3): a printed comic book heard up close - pages turned
 * and slid, paper rustling, lettering inked with a felt pen, pencil in the margin, the dull knock
 * of a rubber stamp or a slammed panel, scissors for a cut gutter. The panel-native transitions
 * sound like themselves (COMIC_TRANSITION_SFX). Every sound is a built-in recipe synthesized in
 * pure Node (packages/pipeline sfx): there is no stamp or slam recipe of its own, so both are the
 * whiteboard's `board-tap` knock (a hand on a hard surface), the onomatopoeia's punch is the paper
 * pop under it. A world's style is exclusive (ADR-029): its films never mix with the built-in
 * looks, so this palette may reuse their paper, pen and board recipes (`world`). Variation: every
 * busy slot has two or three candidates, so repeated panels and captions do not sound the same.
 * Bed: a quiet room.
 */
import type { ComicTransitionId } from '@reelforge/engine';
import { only, pick, type PaletteSlot, type SoundPalette } from './types.js';

/** Sounds that hit at their start land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.03 } as const;
/** The slammed panel lands ~0.15 s into its transition. */
const SLAM_DELAY_S = -0.15;

export const COMIC_PALETTE: SoundPalette = {
  id: 'comic',
  label: 'Comic',
  world: 'comic',
  sfx: {
    'transition-cut': [
      [
        pick('paper-slide', ['short', 'in'], { leadS: 0.2 }),
        pick('paper-pop', ['mid'], { ...ON_CUT, weight: 0.5 }),
      ],
      [
        pick('page-flip', ['flip'], { leadS: 0.18 }),
        pick('paper-rustle', ['soft'], { leadS: 0.1, weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('paper-rustle', 'soft'),
    'transition-glitch': only('scissor-snip', 'cut'),
    'transition-wipe': [[pick('page-flip', ['turn', 'flip'], { leadS: 0.15 })]],
    appear: [
      [pick('paper-pop', ['mid', 'high'])],
      [pick('marker-stroke', ['short'])],
      [pick('pencil-scratch', ['line'])],
    ],
    'list-item': only('paper-pop'),
    'counter-step': [[pick('wood-tick', ['tick'])], [pick('wood-tick', ['tock'])]],
    'counter-final': [[pick('board-tap', ['knock'])], [pick('paper-pop', ['high'])]],
    number: only('cap-pop', 'click'),
    'number-big': [
      [pick('board-tap', ['knock'], ON_CUT), pick('paper-pop', ['low'], { weight: 0.5 })],
    ],
    'text-in': [[pick('marker-stroke', ['short']), pick('paper-pop', ['high'], { weight: 0.5 })]],
    'text-typed': only('pencil-scratch', 'hatch'),
    'emphasis-riser': only('paper-slide', 'long'),
    'emphasis-hit': [
      [pick('board-tap', ['knock', 'double'], ON_CUT), pick('paper-pop', ['low'], { weight: 0.5 })],
    ],
    'end-card': [[pick('page-flip', ['turn']), pick('paper-rustle', ['soft'], { weight: 0.5 })]],
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      scribble: 'pencil-scratch',
      typewriter: 'pencil-scratch',
      paper: 'paper-rustle',
      whoosh: 'page-flip',
      'swoosh-in': 'paper-slide',
      'swoosh-out': 'paper-slide',
      pop: 'paper-pop',
      bubble: 'paper-pop',
      blip: 'cap-pop',
      click: 'cap-pop',
      tick: 'wood-tick',
      tock: 'wood-tick',
      stamp: 'board-tap',
      hit: 'board-tap',
      'hit-soft': 'paper-pop',
      snap: 'scissor-snip',
      'camera-shutter': 'cap-pop',
    },
    byCategory: {
      motion: 'paper-slide',
      impact: 'board-tap',
      texture: 'pencil-scratch',
      ui: 'cap-pop',
      tonal: 'page-flip',
    },
  },
  accents: {
    '': [
      pick('page-flip', ['turn'], { leadS: 0.25 }),
      pick('paper-rustle', ['soft'], { weight: 0.5 }),
    ],
  },
  ambience: {
    key: () => '',
    bed: () => 'room-tone',
    gainDb: -33,
    underMusic: () => 'room-tone',
    underMusicGainDb: -36,
  },
};

/** The sound of each panel-native transition of the world (engine `COMIC_TRANSITION_IDS`). */
export const COMIC_TRANSITION_SFX: Readonly<Record<ComicTransitionId, PaletteSlot>> = {
  'comic-page-turn': [pick('page-flip', ['turn', 'flip'], { leadS: 0.12 })],
  'comic-page-back': [
    pick('page-flip', ['turn'], { leadS: 0.12 }),
    pick('paper-rustle', ['soft'], { weight: 0.5 }),
  ],
  'comic-gutter-wipe': [
    pick('scissor-snip', ['cut'], ON_CUT),
    pick('paper-slide', ['long'], { weight: 0.5 }),
  ],
  'comic-panel-zoom': [pick('paper-slide', ['in', 'short'], { leadS: 0.05 })],
  'comic-panel-slam': [
    pick('board-tap', ['knock'], { leadS: SLAM_DELAY_S }),
    pick('paper-pop', ['low'], { leadS: SLAM_DELAY_S, weight: 0.5 }),
  ],
  'comic-ink-bleed': [pick('marker-stroke', ['long'], { leadS: 0.05 })],
};
