/**
 * Palette `whiteboard` (look 12.7): a hand at a whiteboard — felt marker strokes and squeaks, the
 * cap popping, the eraser's swipe, taps on the board, pitched ticks and soft chimes. Clean and
 * short, no heavy lows. Bed: a quiet room tone.
 */
import { only, pick, type SoundPalette } from './types.js';

export const WHITEBOARD_PALETTE: SoundPalette = {
  id: 'whiteboard',
  label: 'Whiteboard',
  sfx: {
    'transition-cut': [
      [pick('cap-pop', ['off'], { leadS: 0 }), pick('marker-squeak', ['up'], { weight: 0.5 })],
      [pick('eraser-swipe', ['swipe'], { leadS: 0.05 })],
    ],
    'transition-crossfade': only('eraser-swipe', 'swipe'),
    'transition-glitch': only('eraser-swipe', 'scrub'),
    'transition-wipe': only('eraser-swipe', 'swipe'),
    appear: [
      [pick('marker-stroke', ['short'])],
      [pick('board-tap', ['tip'])],
      [pick('marker-squeak', ['up', 'down'])],
    ],
    'list-item': only('board-tick'),
    'counter-step': [[pick('board-tick', ['low'])], [pick('board-tick', ['high'])]],
    'counter-final': [[pick('board-chime', ['single'])], [pick('marker-squeak', ['double'])]],
    number: only('board-tap', 'tip', 'knock'),
    'number-big': [[pick('marker-stroke', ['long'], { leadS: 0 })]],
    'text-in': only('marker-stroke', 'short', 'long'),
    'text-typed': only('marker-stroke', 'scribble'),
    'emphasis-riser': only('marker-stroke', 'long'),
    'emphasis-hit': only('marker-squeak', 'double'),
    'end-card': [[pick('board-chime', ['double']), pick('cap-pop', ['on'], { weight: 0.5 })]],
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      click: 'cap-pop',
      tick: 'board-tick',
      tock: 'board-tick',
      typewriter: 'marker-stroke',
      scribble: 'marker-stroke',
      paper: 'eraser-swipe',
      pop: 'board-tap',
      blip: 'board-tick',
      'blip-up': 'marker-squeak',
      'blip-down': 'marker-squeak',
      whoosh: 'eraser-swipe',
      ding: 'board-chime',
      chime: 'board-chime',
      notification: 'board-chime',
      success: 'board-chime',
    },
    byCategory: {
      motion: 'eraser-swipe',
      impact: 'board-tap',
      texture: 'marker-stroke',
      ui: 'board-tick',
      tonal: 'board-chime',
    },
  },
  accents: {
    '': [pick('cap-pop', ['off'], { leadS: 0.02 }), pick('marker-squeak', ['up'], { leadS: 0 })],
  },
  ambience: {
    key: () => '',
    bed: () => 'room-tone',
    gainDb: -32,
    underMusic: () => 'room-tone',
    underMusicGainDb: -35,
  },
};
