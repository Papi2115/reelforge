/**
 * Palette `game-b2` (world Game B2, PLAN.md#13.4): a 1980s first-person game heard from inside -
 * footsteps on hard floors, a sliding door's motor and latch, the pickup chime, the HUD's blips
 * and terminal ticks while the narration types, menu windows opening, the CRT powering on. There
 * are no footstep, door or pickup recipes of its own, so it reuses built-in ones (documented in
 * docs/worlds/README.md): footsteps = `board-tap` / `wood-tick` (a knock on a hard surface), the
 * door = `servo` + `relay-click` latch, the pickup = `chime-up`, the stamp and the thump =
 * `board-tap` knock. A world's style is exclusive (ADR-029): its films never mix with the built-in
 * looks, so it may reuse their recipes (`world`). Variation: busy slots have two or three
 * candidates. The game-native transitions sound like themselves (GAME_B2_TRANSITION_SFX). Bed: the
 * tungsten hum of the rooms.
 */
import type { GameB2TransitionId } from '@reelforge/engine';
import { only, pick, type PaletteSlot, type SoundPalette } from './types.js';

/** Sounds that hit at their start land on the cut instead of leading into it. */
const ON_CUT = { leadS: 0.02 } as const;

export const GAME_B2_PALETTE: SoundPalette = {
  id: 'game-b2',
  label: 'Game B2',
  world: 'game-b2',
  sfx: {
    'transition-cut': [
      [
        pick('window-open', ['chirp', 'pop'], ON_CUT),
        pick('measure-blip', ['mid'], { ...ON_CUT, weight: 0.5 }),
      ],
      [
        pick('board-tap', ['tip', 'knock'], ON_CUT),
        pick('wood-tick', ['tock'], { ...ON_CUT, weight: 0.5 }),
      ],
    ],
    'transition-crossfade': only('swoosh-soft', 'right', 'left'),
    'transition-glitch': only('crt-zap', 'static'),
    'transition-wipe': [[pick('servo', ['down', 'step'], { leadS: 0.1 })]],
    appear: [
      [pick('window-open', ['pop'])],
      [pick('measure-blip', ['high']), pick('led-blip', ['high'], { weight: 0.6 })],
      [pick('board-tap', ['tip'])],
    ],
    'list-item': only('terminal-tick'),
    'counter-step': [
      [pick('terminal-tick', ['mid']), pick('measure-blip', ['mid'], { weight: 0.5 })],
      [pick('wood-tick', ['tick'])],
    ],
    'counter-final': [[pick('chime-up', ['two'])], [pick('relay-click', ['latch'])]],
    number: [[pick('led-blip', ['mid']), pick('measure-blip', ['low'], { weight: 0.5 })]],
    'number-big': [[pick('chime-up', ['triad'], { leadS: 0 })]],
    'text-in': [[pick('window-open', ['chirp']), pick('measure-blip', ['high'], { weight: 0.5 })]],
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
      'swoosh-in': 'swoosh-soft',
      'swoosh-out': 'swoosh-soft',
      'hit-soft': 'board-tap',
      hit: 'board-tap',
      stamp: 'board-tap',
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
      paper: 'paper-shuffle',
      'error-buzz': 'error-beep',
      glitch: 'crt-zap',
    },
    byCategory: {
      motion: 'servo',
      impact: 'board-tap',
      texture: 'paper-shuffle',
      ui: 'terminal-tick',
      tonal: 'chime-up',
    },
  },
  accents: {
    '': [
      pick('crt-zap', ['power-on'], ON_CUT),
      pick('window-open', ['chime'], { ...ON_CUT, weight: 0.5 }),
    ],
  },
  ambience: {
    key: () => '',
    bed: () => 'hum',
    gainDb: -33,
    underMusic: () => 'room-tone',
    underMusicGainDb: -36,
  },
};

/** The sound of each game-native transition of the world (engine `GAME_B2_TRANSITION_IDS`). */
export const GAME_B2_TRANSITION_SFX: Readonly<Record<GameB2TransitionId, PaletteSlot>> = {
  'game-b2-melt': [pick('servo', ['down'], { leadS: 0.05 })],
  'game-b2-fog': [pick('swoosh-soft', ['left', 'right'], { leadS: 0.2 })],
  'game-b2-darkness': [
    pick('relay-click', ['latch'], ON_CUT),
    pick('crt-zap', ['power-on'], { weight: 0.5 }),
  ],
  'game-b2-door': [pick('servo', ['up'], { leadS: 0.05 })],
  'game-b2-level-card': [pick('swoosh-soft', ['right'], { leadS: 0.1 })],
  'game-b2-map-unfold': [pick('chime-up', ['two'], ON_CUT)],
  'game-b2-map-fold': [pick('window-close', ['chirp'], ON_CUT)],
};
