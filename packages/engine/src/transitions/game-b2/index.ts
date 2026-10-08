/**
 * Game-native transitions of the Game B2 world (PLAN.md#13.4, docs/worlds/game-hud-b2-rpg-v2):
 * the game's own ways from one place to the next. World-scoped like the Sketchbook's page-native
 * ones: not transition-kit styles (`TRANSITION_STYLES`, the picker, wow budgets and kit-docs of the
 * built-in styles do not know them); a storyboard of a game-b2 film names them in
 * `transitionIn.style` (with `type: 'wipe'`, the plain fallback) and the engine composites them.
 * Pure functions of (A, B, progress, seed): every pixel is a pixel of A or B or a world colour.
 */
import type { Compositor } from '../pixels.js';
import { levelCard } from './card.js';
import { doorWalk } from './door.js';
import { darkness, fogBank } from './fog.js';
import { mapFold, mapUnfold } from './map.js';
import { screenMelt } from './melt.js';

export const GAME_B2_TRANSITION_IDS = [
  'game-b2-melt',
  'game-b2-fog',
  'game-b2-darkness',
  'game-b2-door',
  'game-b2-level-card',
  'game-b2-map-unfold',
  'game-b2-map-fold',
] as const;
export type GameB2TransitionId = (typeof GAME_B2_TRANSITION_IDS)[number];

export interface GameB2TransitionStyle {
  readonly id: GameB2TransitionId;
  /** The world (style id) whose films may use it. */
  readonly world: 'game-b2';
  readonly label: string;
  /** One line for the docs. */
  readonly description: string;
  /** Plain transition type (sound, act detection, fallback rendering in an older engine). */
  readonly type: 'wipe';
  /** Seconds. */
  readonly duration: number;
}

const style = (
  id: GameB2TransitionId,
  label: string,
  description: string,
  duration: number,
): GameB2TransitionStyle => ({ id, world: 'game-b2', label, description, type: 'wipe', duration });

export const GAME_B2_TRANSITION_STYLES: Readonly<
  Record<GameB2TransitionId, GameB2TransitionStyle>
> = {
  'game-b2-melt': style(
    'game-b2-melt',
    'Screen melt',
    "Doom's melt: the frame slides down in uneven columns onto the next (a chapter ends)",
    0.7,
  ),
  'game-b2-fog': style(
    'game-b2-fog',
    'Fog bank',
    'fog drifts in, fills the frame and thins away over the next place (time passes)',
    1.4,
  ),
  'game-b2-darkness': style(
    'game-b2-darkness',
    'Lights out',
    'the lights go out, a dark beat, the next place clicks on with two stutters',
    1.0,
  ),
  'game-b2-door': style(
    'game-b2-door',
    'Through the door',
    'the frame rises like a door and we walk through into the next place',
    0.9,
  ),
  'game-b2-level-card': style(
    'game-b2-level-card',
    'Level card',
    'a woodgrain HUD plate sweeps across and on; the next shot types the place name',
    1.0,
  ),
  'game-b2-map-unfold': style(
    'game-b2-map-unfold',
    'Map unfolds',
    "the next shot (an automap centred on the player) grows out of this shot's minimap",
    0.6,
  ),
  'game-b2-map-fold': style(
    'game-b2-map-fold',
    'Map folds',
    "this automap shot shrinks back into the next shot's minimap (centre it on the player)",
    0.9,
  ),
};

export const GAME_B2_COMPOSITORS: Readonly<Record<GameB2TransitionId, Compositor>> = {
  'game-b2-melt': screenMelt,
  'game-b2-fog': fogBank,
  'game-b2-darkness': darkness,
  'game-b2-door': doorWalk,
  'game-b2-level-card': levelCard,
  'game-b2-map-unfold': mapUnfold,
  'game-b2-map-fold': mapFold,
};

export function isGameB2Transition(style: string | undefined): style is GameB2TransitionId {
  return style !== undefined && (GAME_B2_TRANSITION_IDS as readonly string[]).includes(style);
}
