/**
 * Palette `blueprint` (look 12.4): precise and dry — pencil strokes and the plotter draw, rulers
 * tick, relays click, measurements blip and data pings. Bed: a faint electrical tick.
 */
import { only, pick, type SoundPalette } from './types.js';

export const BLUEPRINT_PALETTE: SoundPalette = {
  id: 'blueprint',
  label: 'Blueprint / data',
  sfx: {
    'transition-cut': [
      [
        pick('pencil-scratch', ['line'], { leadS: 0.05 }),
        pick('ruler-tick', ['double'], { leadS: 0, weight: 0.5 }),
      ],
      [pick('relay-click', ['latch', 'small'], { leadS: 0 })],
    ],
    'transition-crossfade': only('plotter-pen', 'line', 'curve'),
    'transition-glitch': only('relay-click', 'bank'),
    'transition-wipe': only('pencil-scratch', 'line'),
    appear: [
      [pick('measure-blip', ['mid', 'high'])],
      [pick('data-ping', ['soft'])],
      [pick('relay-click', ['small'])],
    ],
    'list-item': only('measure-blip'),
    'counter-step': [[pick('ruler-tick', ['plastic'])], [pick('relay-click', ['small'])]],
    'counter-final': [[pick('data-ping', ['ping'])], [pick('relay-click', ['latch'])]],
    number: only('ruler-tick', 'plastic', 'metal'),
    'number-big': [[pick('data-ping', ['ping', 'double'], { leadS: 0 })]],
    'text-in': only('pencil-scratch', 'line', 'hatch'),
    'text-typed': only('plotter-pen', 'line', 'curve'),
    'emphasis-riser': only('pencil-scratch', 'hatch'),
    'emphasis-hit': only('relay-click', 'latch'),
    'end-card': only('data-ping', 'double'),
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      click: 'relay-click',
      tick: 'ruler-tick',
      tock: 'relay-click',
      typewriter: 'plotter-pen',
      scribble: 'pencil-scratch',
      paper: 'pencil-scratch',
      pop: 'measure-blip',
      blip: 'measure-blip',
      'blip-up': 'measure-blip',
      ding: 'data-ping',
      chime: 'data-ping',
      notification: 'data-ping',
      success: 'data-ping',
    },
    byCategory: {
      motion: 'plotter-pen',
      impact: 'relay-click',
      texture: 'pencil-scratch',
      ui: 'measure-blip',
      tonal: 'data-ping',
    },
  },
  accents: {
    '': [
      pick('plotter-pen', ['pen-up'], { leadS: 0.03 }),
      pick('data-ping', ['soft'], { leadS: 0 }),
    ],
  },
  ambience: {
    key: () => '',
    bed: () => 'electric-tick',
    gainDb: -30,
    underMusic: () => 'electric-tick',
    underMusicGainDb: -33,
  },
};
