/**
 * Palette `flat-2d` (look 12.5): clean and light motion-graphics sounds — shapes pop, cards and
 * words swoosh in, counters tick, words snap into place, reveals chime upwards. No heavy lows.
 * Bed: a soft room tone.
 */
import { only, pick, type SoundPalette } from './types.js';

export const FLAT_2D_PALETTE: SoundPalette = {
  id: 'flat-2d',
  label: 'Flat 2D motion graphics',
  sfx: {
    'transition-cut': [[pick('swoosh-soft', ['right', 'left'])], [pick('whoosh-flat', ['cut'])]],
    'transition-crossfade': only('whoosh-flat', 'long'),
    'transition-glitch': only('text-snap', 'snap'),
    'transition-wipe': only('swoosh-soft', 'right', 'left'),
    appear: [
      [pick('shape-pop', ['round', 'bright'])],
      [pick('shape-pop', ['double'])],
      [pick('flat-tick', ['soft'])],
    ],
    'list-item': only('shape-pop'),
    'counter-step': [[pick('flat-tick', ['soft', 'wood'])], [pick('flat-tick', ['high'])]],
    'counter-final': [[pick('chime-up', ['two'])], [pick('text-snap', ['thock'])]],
    number: only('text-snap', 'snap', 'tap'),
    'number-big': [[pick('chime-up', ['triad'], { leadS: 0 })]],
    'text-in': only('swoosh-soft', 'up'),
    'text-typed': only('flat-tick', 'soft', 'high'),
    'emphasis-riser': only('whoosh-flat', 'reverse'),
    'emphasis-hit': only('text-snap', 'thock'),
    'end-card': only('chime-up', 'sparkle'),
  },
  listPitch: ['round', 'double', 'bright'],
  scene: {
    map: {
      pop: 'shape-pop',
      bubble: 'shape-pop',
      'bubble-up': 'shape-pop',
      blip: 'shape-pop',
      'blip-up': 'chime-up',
      click: 'text-snap',
      snap: 'text-snap',
      'hit-soft': 'text-snap',
      tick: 'flat-tick',
      tock: 'flat-tick',
      typewriter: 'flat-tick',
      'swoosh-in': 'swoosh-soft',
      'swoosh-out': 'swoosh-soft',
      whoosh: 'whoosh-flat',
      ding: 'chime-up',
      chime: 'chime-up',
      sparkle: 'chime-up',
      success: 'chime-up',
      notification: 'chime-up',
    },
    byCategory: {
      motion: 'whoosh-flat',
      impact: 'text-snap',
      texture: 'swoosh-soft',
      ui: 'shape-pop',
      tonal: 'chime-up',
    },
  },
  accents: {
    '': [pick('swoosh-soft', ['up'], { leadS: 0.05 }), pick('chime-up', ['two'], { leadS: 0 })],
  },
  ambience: {
    key: () => '',
    bed: () => 'room-tone',
    gainDb: -32,
    underMusic: () => 'room-tone',
    underMusicGainDb: -36,
  },
};
