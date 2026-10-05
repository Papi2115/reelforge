/**
 * Sounds of the wow transitions (ADR-028): every wow style has its own sound in every palette —
 * whooshes for the enter / dive camera moves, paper for the roll and the page, an eraser for the
 * sponge, glass for the shatter and the cube smash — and a few palettes voice it their way (a
 * retro window chirps open, flat 2D whooshes are clean, paper cut-out pages turn). Within one
 * look as well as across looks (unlike the look-change specials).
 */
import { isWowStyle, type WowStyleId } from '@reelforge/shared';
import { pick, type PaletteSlot, type SoundPaletteId } from './types.js';

/** The cubes of the cube smash hit the screen a little after the transition starts. */
const IMPACT_DELAY_S = -0.15;

export const WOW_STYLE_SFX: Readonly<Record<WowStyleId, PaletteSlot>> = {
  'enter-lens': [pick('swoosh-in', ['soft', 'bright']), pick('whoosh', ['up'], { weight: 0.5 })],
  'enter-binoculars': [pick('whoosh', ['slow', 'air'])],
  'enter-window': [pick('whoosh', ['air', 'up'])],
  'enter-keyhole': [pick('whoosh', ['slow']), pick('swoosh-in', ['soft'], { weight: 0.5 })],
  'paper-roll': [pick('paper', ['slide']), pick('paper-slide', ['long'], { weight: 0.5 })],
  'cube-smash': [
    pick('glass-crack', ['crack'], { leadS: IMPACT_DELAY_S }),
    pick('hit', ['tight'], { leadS: IMPACT_DELAY_S, weight: 0.5 }),
  ],
  'sponge-wipe': [pick('eraser-swipe', ['scrub'])],
  'page-turn': [pick('page-flip', ['flip', 'turn']), pick('paper', ['page-turn'], { weight: 0.5 })],
  shatter: [pick('glass-crack', ['shatter'])],
  'dive-in': [pick('whoosh', ['fast', 'down'])],
  'dive-out': [pick('whoosh', ['slow', 'up'])],
};

const FLAT_WHOOSH: PaletteSlot = [pick('whoosh-flat', ['long', 'reverse'])];

/** Palettes that voice some wow styles their own way. */
export const WOW_PALETTE_SFX: Readonly<
  Partial<Record<SoundPaletteId, Readonly<Partial<Record<WowStyleId, PaletteSlot>>>>>
> = {
  'retro-ui': { 'enter-window': [pick('window-open', ['chime', 'chirp'])] },
  blueprint: {
    'paper-roll': [pick('paper-shuffle', ['flip'])],
    'page-turn': [pick('paper-shuffle', ['flip'])],
  },
  'flat-2d': {
    'enter-lens': FLAT_WHOOSH,
    'enter-binoculars': FLAT_WHOOSH,
    'enter-window': FLAT_WHOOSH,
    'enter-keyhole': FLAT_WHOOSH,
    'dive-in': [pick('whoosh-flat', ['cut'])],
    'dive-out': [pick('whoosh-flat', ['reverse'])],
  },
  whiteboard: { 'sponge-wipe': [pick('eraser-swipe', ['scrub', 'swipe'])] },
  'paper-cutout': {
    'paper-roll': [pick('paper-slide', ['long']), pick('paper-rustle', ['soft'], { weight: 0.5 })],
    'page-turn': [pick('page-flip', ['turn'])],
  },
};

/** The sound of a wow style in a palette (undefined: not a wow style). */
export function wowSlot(
  palette: SoundPaletteId,
  style: string | undefined,
): PaletteSlot | undefined {
  if (!isWowStyle(style)) return undefined;
  return WOW_PALETTE_SFX[palette]?.[style] ?? WOW_STYLE_SFX[style];
}
