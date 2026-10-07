/**
 * Game-native transitions of the Game B1 world (PLAN.md#13.5 part b, docs/worlds/
 * game-hud-b1-boss-v2): the console's and the living room's own ways from one shot to the next.
 * World-scoped like the other worlds' transitions: not transition-kit styles (`TRANSITION_STYLES`,
 * the picker, wow budgets and kit-docs of the built-in styles do not know them); a game-b1 film
 * names them in `transitionIn.style` (with `type: 'wipe'`, the plain fallback) and the engine
 * composites them. Three of them realise continuity links (`link`): the calendar zoom
 * (zoom-through) and the cartridge in / out (carry-environment: the TV stays, its game changes).
 * Pure functions of (A, B, progress, focus, seed): every pixel is a pixel of A or B, one of them
 * through a world LUT, or a world ink.
 */
import type { ContinuityKind } from '@reelforge/shared';
import type { Compositor } from '../pixels.js';
import { attractCycle } from './attract.js';
import { cartridgeIn, cartridgeOut, roomShake } from './impact.js';
import { pageSlide, pageTurn } from './paper.js';
import { calendarZoom, scanlineWipe } from './scan.js';

export const GAME_B1_TRANSITION_IDS = [
  'game-b1-calendar-zoom',
  'game-b1-cartridge-in',
  'game-b1-cartridge-out',
  'game-b1-attract-cycle',
  'game-b1-scanline-wipe',
  'game-b1-page-slide',
  'game-b1-page-turn',
  'game-b1-room-shake',
] as const;
export type GameB1TransitionId = (typeof GAME_B1_TRANSITION_IDS)[number];

export interface GameB1TransitionStyle {
  readonly id: GameB1TransitionId;
  /** The world (style id) whose films may use it. */
  readonly world: 'game-b1';
  readonly label: string;
  /** One line for the docs. */
  readonly description: string;
  /** Plain transition type (sound, act detection, fallback rendering in an older engine). */
  readonly type: 'wipe';
  /** Seconds. */
  readonly duration: number;
  /** The continuity link kind it carries (PLAN.md#13.2), when it is one. */
  readonly link?: ContinuityKind;
}

const style = (
  id: GameB1TransitionId,
  label: string,
  description: string,
  duration: number,
  link?: ContinuityKind,
): GameB1TransitionStyle => ({
  id,
  world: 'game-b1',
  label,
  description,
  type: 'wipe',
  duration,
  ...(link === undefined ? {} : { link }),
});

export const GAME_B1_TRANSITION_STYLES: Readonly<
  Record<GameB1TransitionId, GameB1TransitionStyle>
> = {
  'game-b1-calendar-zoom': style(
    'game-b1-calendar-zoom',
    'Into the calendar',
    'the camera pushes into the wall calendar (focus) and the next place is redrawn line by line around it; the next shot opens on the page, centred',
    1.2,
    'zoom-through',
  ),
  'game-b1-cartridge-in': style(
    'game-b1-cartridge-in',
    'Cartridge in',
    'the picture rolls as a cartridge rocks in the slot, garbage, the new game clicks in with a jolt (the TV stays, its game changes)',
    0.8,
    'carry-environment',
  ),
  'game-b1-cartridge-out': style(
    'game-b1-cartridge-out',
    'Cartridge out',
    'garbage as the cartridge leaves the contacts, the picture collapses to a line and a dot, a dark beat, the next picture powers on',
    0.9,
    'carry-environment',
  ),
  'game-b1-attract-cycle': style(
    'game-b1-attract-cycle',
    'Attract mode',
    "game over: the picture's colours step round the wheel, then the next screen redraws top-down in uneven bursts",
    1.0,
  ),
  'game-b1-scanline-wipe': style(
    'game-b1-scanline-wipe',
    'Scanline redraw',
    'the next picture is painted line by line, interlaced, with a beam on the front (a place becomes another in the same spot)',
    0.62,
  ),
  'game-b1-page-slide': style(
    'game-b1-page-slide',
    'Page slides in',
    'the next shot (a manual page) peeks, slides up over this one, overshoots and settles, with a cast shadow',
    0.8,
  ),
  'game-b1-page-turn': style(
    'game-b1-page-turn',
    'Page turn',
    "this shot (a manual page) is turned from its bottom-right corner onto the next; the paper's back shows the print through",
    0.5,
  ),
  'game-b1-room-shake': style(
    'game-b1-room-shake',
    'Room shake',
    'a slam: the frame jolts with a decaying shake, one frame of the hit flash, the next shot shakes and settles',
    0.5,
  ),
};

export const GAME_B1_COMPOSITORS: Readonly<Record<GameB1TransitionId, Compositor>> = {
  'game-b1-calendar-zoom': calendarZoom,
  'game-b1-cartridge-in': cartridgeIn,
  'game-b1-cartridge-out': cartridgeOut,
  'game-b1-attract-cycle': attractCycle,
  'game-b1-scanline-wipe': scanlineWipe,
  'game-b1-page-slide': pageSlide,
  'game-b1-page-turn': pageTurn,
  'game-b1-room-shake': roomShake,
};

export function isGameB1Transition(style: string | undefined): style is GameB1TransitionId {
  return style !== undefined && (GAME_B1_TRANSITION_IDS as readonly string[]).includes(style);
}
