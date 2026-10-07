/**
 * Page-native transitions of the Sketchbook world (PLAN.md#13.6, docs/worlds/sketchbook-v2): the
 * notebook's own ways from one page to the next. World-scoped like the world's looks: they are not
 * transition-kit styles (`TRANSITION_STYLES`, the picker, wow budgets and kit-docs of the built-in
 * styles do not know them); a storyboard of a sketchbook film names them in `transitionIn.style`
 * (with `type: 'wipe'`, the plain fallback) and the engine composites them like the continuity
 * links. Pure functions of (A, B, progress): every pixel is a pixel of A or B or a sketchbook
 * ink, so the output stays in the palette; the seed is unused (the notebook tears the same way).
 */
import type { Compositor } from '../pixels.js';
import { crumpleToss } from './crumple.js';
import { pageFlip, riffle } from './flip.js';
import { tapePeel } from './peel.js';
import { tornStrip } from './tear.js';

export const SKETCHBOOK_TRANSITION_IDS = [
  'sketchbook-page-flip',
  'sketchbook-riffle',
  'sketchbook-crumple-toss',
  'sketchbook-tape-peel',
  'sketchbook-torn-strip',
] as const;
export type SketchbookTransitionId = (typeof SKETCHBOOK_TRANSITION_IDS)[number];

export interface WorldTransitionStyle {
  readonly id: SketchbookTransitionId;
  /** The world (style id) whose films may use it. */
  readonly world: 'sketchbook';
  readonly label: string;
  /** One line for the docs. */
  readonly description: string;
  /** Plain transition type (sound, act detection, fallback rendering in an older engine). */
  readonly type: 'wipe';
  /** Seconds (the showcase's). */
  readonly duration: number;
}

export const SKETCHBOOK_TRANSITION_STYLES: Readonly<
  Record<SketchbookTransitionId, WorldTransitionStyle>
> = {
  'sketchbook-page-flip': {
    id: 'sketchbook-page-flip',
    world: 'sketchbook',
    label: 'Page flip',
    description: 'the page turns over the spiral to the left, the next page under it',
    type: 'wipe',
    duration: 0.62,
  },
  'sketchbook-riffle': {
    id: 'sketchbook-riffle',
    world: 'sketchbook',
    label: 'Riffle',
    description: 'three quick flips through blank pages of the notebook to the next page',
    type: 'wipe',
    duration: 0.8,
  },
  'sketchbook-crumple-toss': {
    id: 'sketchbook-crumple-toss',
    world: 'sketchbook',
    label: 'Crumple and toss',
    description: 'the page is torn out, balled up and tossed away (a rejected idea)',
    type: 'wipe',
    duration: 0.95,
  },
  'sketchbook-tape-peel': {
    id: 'sketchbook-tape-peel',
    world: 'sketchbook',
    label: 'Tape peel',
    description: 'the page is peeled off from its bottom-left corner; the tape resists, then gives',
    type: 'wipe',
    duration: 0.7,
  },
  'sketchbook-torn-strip': {
    id: 'sketchbook-torn-strip',
    world: 'sketchbook',
    label: 'Torn strip',
    description: 'the page is torn out along the spiral and falls away; a torn strip stays',
    type: 'wipe',
    duration: 0.8,
  },
};

export const SKETCHBOOK_COMPOSITORS: Readonly<Record<SketchbookTransitionId, Compositor>> = {
  'sketchbook-page-flip': pageFlip,
  'sketchbook-riffle': riffle,
  'sketchbook-crumple-toss': crumpleToss,
  'sketchbook-tape-peel': tapePeel,
  'sketchbook-torn-strip': tornStrip,
};

export function isSketchbookTransition(style: string | undefined): style is SketchbookTransitionId {
  return style !== undefined && (SKETCHBOOK_TRANSITION_IDS as readonly string[]).includes(style);
}
