/**
 * Palette `game-b1` (world Game B1, PLAN.md#13.5 part b): an Atari 2600 in a 1982 living room -
 * the console's blips and the TV's CRT, the cartridge clicking home, the garbage static of a
 * cartridge rocking in its slot, the slam of a boss name or a high score, a coin-up chime for
 * INSERT COIN, the manual's paper and Dad's pencil, the hum of the set. No cartridge, coin or slam
 * recipes of its own exist, so it reuses built-in ones (documented in docs/worlds/README.md): the
 * cartridge click = `relay-click` latch, the garbage = `crt-zap` static, the coin-up = `chime-up`,
 * the slam = `board-tap` knock, blips = `measure-blip` / `led-blip` / `terminal-tick`, the page =
 * `page-flip` / `paper-slide`, the pencil = `pencil-scratch`. A world's style is exclusive
 * (ADR-029), so it may share recipes with the other worlds' palettes. Busy slots have two or three
 * candidates (variation). Every game-native transition sounds like itself (GAME_B1_TRANSITION_SFX).
 * Bed: the CRT's hum.
 */
import type { GameB1TransitionId } from '@reelforge/engine';
import { only, pick, type PaletteSlot, type SoundPalette } from './types.js';

/** Sounds that hit at their start land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.02 } as const;

export const GAME_B1_PALETTE: SoundPalette = {
  id: 'game-b1',
  label: 'Game B1',
  world: 'game-b1',
  sfx: {
    'transition-cut': [
      [
        pick('measure-blip', ['mid'], ON_CUT),
        pick('window-open', ['chirp'], { ...ON_CUT, weight: 0.5 }),
      ],
      [
        pick('relay-click', ['small'], ON_CUT),
        pick('board-tap', ['tip'], { ...ON_CUT, weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('swoosh-soft', 'right', 'left'),
    'transition-glitch': only('crt-zap', 'static'),
    'transition-wipe': [[pick('crt-zap', ['degauss'], { leadS: 0.08 })]],
    appear: [
      [pick('measure-blip', ['high']), pick('led-blip', ['high'], { weight: 0.6 })],
      [pick('window-open', ['pop'])],
      [pick('board-tap', ['tip'])],
    ],
    'list-item': only('terminal-tick'),
    'counter-step': [
      [pick('terminal-tick', ['mid']), pick('led-blip', ['mid'], { weight: 0.5 })],
      [pick('wood-tick', ['tick'])],
    ],
    'counter-final': [[pick('chime-up', ['two'])], [pick('relay-click', ['latch'])]],
    number: [[pick('led-blip', ['mid']), pick('measure-blip', ['low'], { weight: 0.5 })]],
    'number-big': [[pick('board-tap', ['knock'], { leadS: 0 })]],
    'text-in': [[pick('measure-blip', ['high']), pick('window-open', ['chirp'], { weight: 0.5 })]],
    'text-typed': [
      [pick('key-click', ['terminal']), pick('keyboard', ['terminal'], { weight: 0.5 })],
    ],
    'emphasis-riser': only('servo', 'up'),
    'emphasis-hit': [
      [pick('board-tap', ['knock', 'double']), pick('relay-click', ['bank'], { weight: 0.5 })],
    ],
    'end-card': only('chime-up', 'sparkle'),
  },
  listPitch: ['low', 'mid', 'high'],
  scene: {
    map: {
      whoosh: 'swoosh-soft',
      'swoosh-in': 'paper-slide',
      'swoosh-out': 'swoosh-soft',
      'hit-soft': 'board-tap',
      hit: 'board-tap',
      stamp: 'board-tap',
      boom: 'board-tap',
      tick: 'terminal-tick',
      tock: 'wood-tick',
      blip: 'measure-blip',
      'blip-up': 'chime-up',
      'blip-down': 'window-close',
      coin: 'chime-up',
      success: 'chime-up',
      notification: 'window-open',
      pop: 'led-blip',
      click: 'relay-click',
      typewriter: 'key-click',
      paper: 'page-flip',
      scribble: 'pencil-scratch',
      'error-buzz': 'error-beep',
      glitch: 'crt-zap',
    },
    byCategory: {
      motion: 'servo',
      impact: 'board-tap',
      texture: 'paper-shuffle',
      ui: 'measure-blip',
      tonal: 'chime-up',
    },
  },
  accents: {
    '': [
      pick('crt-zap', ['power-on'], ON_CUT),
      pick('relay-click', ['latch'], { ...ON_CUT, weight: 0.5 }),
    ],
  },
  ambience: {
    key: () => '',
    bed: () => 'crt-hum',
    gainDb: -34,
    underMusic: () => 'room-tone',
    underMusicGainDb: -36,
  },
};

/** The sound of each game-native transition of the world (engine `GAME_B1_TRANSITION_IDS`). */
export const GAME_B1_TRANSITION_SFX: Readonly<Record<GameB1TransitionId, PaletteSlot>> = {
  'game-b1-calendar-zoom': [pick('crt-zap', ['degauss'], { leadS: 0.1 })],
  'game-b1-cartridge-in': [
    pick('relay-click', ['latch'], ON_CUT),
    pick('crt-zap', ['static'], { weight: 0.5 }),
  ],
  'game-b1-cartridge-out': [pick('crt-zap', ['static'], ON_CUT)],
  'game-b1-attract-cycle': [pick('measure-blip', ['low'], ON_CUT)],
  'game-b1-scanline-wipe': [pick('crt-zap', ['degauss'], { leadS: 0.05 })],
  'game-b1-page-slide': [pick('paper-slide', ['in'], { leadS: 0.15 })],
  'game-b1-page-turn': [pick('page-flip', ['turn'], ON_CUT)],
  'game-b1-room-shake': [pick('board-tap', ['knock'], ON_CUT)],
  'game-b1-screen-flip': [pick('measure-blip', ['low'], { leadS: 0.05 })],
};
