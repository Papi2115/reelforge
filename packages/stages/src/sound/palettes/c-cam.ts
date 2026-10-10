/**
 * Palette `c-cam` (world Grim Ink, PLAN.md#14.12): a grimy room in an adult TV cartoon heard up
 * close and dry - a chair creaking under a deadpan hold, a knuckle knocking on a wooden table, a
 * stamp or a fist landing (`marker-thump`), papers shuffled on a desk, a ballpoint clicked, a door
 * latch, a pencil scratching the ink lettering. The world cuts hard (no page-native transitions),
 * so cuts sound like a room, not like paper. Every sound is a built-in recipe synthesized in pure
 * Node (packages/pipeline sfx); a world's style is exclusive (ADR-029), its films never mix with
 * the built-in looks, so this palette reuses the paper, pen, board and office recipes of the other
 * palettes (`world`). Muted on purpose: no chimes, no pops of colour; the gag beat is a knock, the
 * poster's letters land with a thump. Bed: a quiet room.
 */
import { only, pick, type SoundPalette } from './types.js';

/** Sounds that hit at their start land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.03 } as const;

export const C_CAM_PALETTE: SoundPalette = {
  id: 'c-cam',
  label: 'Grim Ink',
  world: 'c-cam',
  sfx: {
    'transition-cut': [
      // into an insert or a poster: papers on the desk, a click of the pen
      [
        pick('paper-shuffle', ['flip'], { leadS: 0.08 }),
        pick('pen-click', ['off'], { ...ON_CUT, weight: 0.5 }),
      ],
      // into a scene: the room itself (a chair, a latch)
      [
        pick('chair', ['creak'], { leadS: 0.1 }),
        pick('relay-click', ['latch'], { ...ON_CUT, weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('paper-rustle', 'soft'),
    'transition-glitch': only('paper-rustle', 'crinkle'),
    'transition-wipe': [[pick('paper-shuffle', ['shuffle'], { leadS: 0.12 })]],
    appear: [
      [pick('board-tap', ['tip'])],
      [pick('pencil-scratch', ['line'])],
      [pick('paper-shuffle', ['stack'])],
    ],
    'list-item': only('wood-tick'),
    'counter-step': [[pick('wood-tick', ['tick'])], [pick('wood-tick', ['tock'])]],
    'counter-final': [[pick('marker-thump', ['tap'])], [pick('board-tap', ['knock'])]],
    number: [[pick('pen-click', ['on'])], [pick('pen-click', ['double'])]],
    'number-big': [
      [pick('marker-thump', ['thump'], ON_CUT), pick('board-tap', ['knock'], { weight: 0.5 })],
    ],
    'text-in': only('pencil-scratch', 'line', 'hatch'),
    'text-typed': only('pencil-scratch', 'hatch'),
    'emphasis-riser': only('chair', 'swivel'),
    'emphasis-hit': [
      [pick('marker-thump', ['slam'], ON_CUT), pick('board-tap', ['double'], { weight: 0.5 })],
    ],
    'end-card': [[pick('marker-thump', ['thump']), pick('chair', ['creak'], { weight: 0.5 })]],
  },
  // a list is counted off on the table: the low tock first, the double knock last
  listPitch: ['tock', 'tick', 'double'],
  scene: {
    map: {
      scribble: 'pencil-scratch',
      typewriter: 'pencil-scratch',
      paper: 'paper-shuffle',
      whoosh: 'paper-rustle',
      'swoosh-in': 'paper-rustle',
      'swoosh-out': 'paper-rustle',
      pop: 'pen-click',
      bubble: 'pen-click',
      blip: 'pen-click',
      click: 'pen-click',
      tick: 'wood-tick',
      tock: 'wood-tick',
      stamp: 'marker-thump',
      hit: 'board-tap',
      'hit-soft': 'board-tap',
      snap: 'relay-click',
      'camera-shutter': 'relay-click',
    },
    byCategory: {
      motion: 'paper-rustle',
      impact: 'marker-thump',
      texture: 'pencil-scratch',
      ui: 'pen-click',
      tonal: 'chair',
    },
  },
  accents: {
    '': [
      pick('chair', ['creak'], { leadS: 0.15 }),
      pick('board-tap', ['tip'], { ...ON_CUT, weight: 0.5 }),
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
