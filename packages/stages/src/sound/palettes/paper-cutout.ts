/**
 * Palette `paper-cutout` (look 12.6): the craft table heard up close — cut pieces are pressed
 * down with a soft pop, sheets slide and rustle, scissors snip, tape tears, the stop-motion rig
 * ticks and pages flip at the chapter breaks. Light foley, no bass. Bed: a quiet room.
 */
import { only, pick, type SoundPalette } from './types.js';

/** Sounds that hit at their start land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.03 } as const;

export const PAPER_CUTOUT_PALETTE: SoundPalette = {
  id: 'paper-cutout',
  label: 'Paper cut-out',
  sfx: {
    'transition-cut': [
      [
        pick('paper-slide', ['in', 'short'], { leadS: 0.2 }),
        pick('tape-tear', ['stick'], { ...ON_CUT, weight: 0.5 }),
      ],
      [
        pick('page-flip', ['flip'], { leadS: 0.18 }),
        pick('paper-rustle', ['soft'], { leadS: 0.1, weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('paper-rustle', 'soft'),
    'transition-glitch': only('scissor-snip', 'cut'),
    'transition-wipe': only('paper-slide', 'long'),
    appear: [
      [pick('paper-pop', ['mid', 'high'])],
      [pick('paper-rustle', ['crinkle'])],
      [pick('wood-tick', ['tick'])],
    ],
    'list-item': only('paper-pop'),
    'counter-step': [[pick('wood-tick', ['tick'])], [pick('wood-tick', ['tock'])]],
    'counter-final': [[pick('paper-pop', ['high'])], [pick('tape-tear', ['stick'])]],
    number: only('wood-tick', 'double'),
    'number-big': [[pick('scissor-snip', ['double'], ON_CUT)]],
    'text-in': only('paper-slide', 'short', 'in'),
    'text-typed': only('scissor-snip', 'cut'),
    'emphasis-riser': only('tape-tear', 'peel'),
    'emphasis-hit': only('paper-pop', 'low'),
    'end-card': only('page-flip', 'turn'),
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      paper: 'paper-rustle',
      scribble: 'paper-slide',
      whoosh: 'paper-slide',
      'swoosh-in': 'paper-slide',
      'swoosh-out': 'paper-slide',
      pop: 'paper-pop',
      bubble: 'paper-pop',
      blip: 'paper-pop',
      click: 'wood-tick',
      tick: 'wood-tick',
      tock: 'wood-tick',
      typewriter: 'scissor-snip',
      'camera-shutter': 'scissor-snip',
      snap: 'scissor-snip',
      stamp: 'tape-tear',
    },
    byCategory: {
      motion: 'paper-slide',
      impact: 'paper-pop',
      texture: 'paper-rustle',
      ui: 'wood-tick',
      tonal: 'page-flip',
    },
  },
  accents: {
    '': [
      pick('page-flip', ['turn'], { leadS: 0.25 }),
      pick('paper-rustle', ['soft'], { leadS: 0.1, weight: 0.5 }),
    ],
  },
  ambience: {
    key: () => '',
    bed: () => 'room-tone',
    gainDb: -32,
    underMusic: () => 'room-tone',
    underMusicGainDb: -36,
  },
};
