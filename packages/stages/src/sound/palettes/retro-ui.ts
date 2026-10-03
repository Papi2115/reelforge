/**
 * Palette `retro-ui` (look 12.2): windows open with chip blips, keys and mice click, the disk
 * seeks, a modem builds up to the emphasis, the CRT zaps on hard switches. Bed: CRT hum with a
 * faint disk.
 */
import { only, pick, type SoundPalette } from './types.js';

/** These sounds hit at their start: they land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.02 } as const;

export const RETRO_UI_PALETTE: SoundPalette = {
  id: 'retro-ui',
  label: 'Retro UI / CRT',
  sfx: {
    'transition-cut': [
      [
        pick('window-open', ['chime', 'chirp'], ON_CUT),
        pick('mouse-click', ['ball'], { ...ON_CUT, weight: 0.5 }),
      ],
      [
        pick('crt-zap', ['static'], ON_CUT),
        pick('window-close', ['chirp'], { ...ON_CUT, weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('crt-zap', 'degauss'),
    'transition-glitch': only('crt-zap', 'static'),
    'transition-wipe': only('window-open', 'chirp'),
    appear: [
      [pick('window-open', ['pop'])],
      [pick('mouse-click', ['micro', 'ball'])],
      [pick('key-click', ['mechanical', 'terminal'])],
    ],
    'list-item': only('terminal-tick'),
    'counter-step': [[pick('terminal-tick', ['mid'])], [pick('key-click', ['membrane'])]],
    'counter-final': [[pick('window-open', ['chime'])], [pick('error-beep', ['beep'])]],
    number: only('mouse-click', 'ball', 'double'),
    'number-big': [[pick('window-open', ['chime'], { leadS: 0 })]],
    'text-in': only('window-open', 'chirp', 'pop'),
    'text-typed': only('keyboard', 'mechanical', 'terminal'),
    'emphasis-riser': only('modem', 'dialup', 'carrier'),
    'emphasis-hit': only('crt-zap', 'power-on'),
    'end-card': only('window-open', 'chime'),
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      click: 'mouse-click',
      typewriter: 'keyboard',
      tick: 'terminal-tick',
      tock: 'key-click',
      blip: 'terminal-tick',
      'blip-up': 'window-open',
      'blip-down': 'window-close',
      notification: 'window-open',
      success: 'window-open',
      'error-buzz': 'error-beep',
      glitch: 'crt-zap',
      'swoosh-in': 'window-open',
      'swoosh-out': 'window-close',
      'camera-shutter': 'mouse-click',
    },
    byCategory: {
      motion: 'window-open',
      impact: 'crt-zap',
      texture: 'disk-seek',
      ui: 'mouse-click',
      tonal: 'window-open',
    },
  },
  accents: {
    '': [
      pick('crt-zap', ['power-on', 'static'], ON_CUT),
      pick('disk-seek', ['floppy', 'hard-disk'], ON_CUT),
    ],
  },
  ambience: {
    key: () => '',
    bed: () => 'crt-hum',
    gainDb: -30,
    underMusic: () => 'crt-hum',
    underMusicGainDb: -34,
  },
};
