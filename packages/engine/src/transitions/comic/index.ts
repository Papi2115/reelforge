/**
 * Panel-native transitions of the Comic world (PLAN.md#13.3, docs/worlds/comic-panels-v2): the
 * printed page's own ways from one shot to the next. World-scoped like the world's looks and like
 * Sketchbook's page transitions: not transition-kit styles (`TRANSITION_STYLES`, the picker, wow
 * budgets and kit-docs of the built-in styles do not know them); a comic film's storyboard names
 * them in `transitionIn.style` (with `type: 'wipe'`, the plain fallback) and `transitionIn.focus`
 * (the panel to zoom into, the cut, the ink's origin, the slit's height). Pure functions of (A, B, progress, focus):
 * every pixel is a pixel of A or B or a comic ink, so the output stays in the palette.
 */
import type { Compositor } from '../pixels.js';
import { inkBleed } from './bleed.js';
import { gutterWipe } from './gutter.js';
import { panelSlam, panelZoom } from './panel.js';
import { pageScroll, pageSlide } from './slide.js';
import { gutterCollapse, panelPush } from './squeeze.js';
import { pageBack, pageTurn } from './turn.js';

export const COMIC_TRANSITION_IDS = [
  'comic-page-turn',
  'comic-page-back',
  'comic-gutter-wipe',
  'comic-panel-zoom',
  'comic-panel-slam',
  'comic-ink-bleed',
  'comic-page-slide',
  'comic-page-scroll',
  'comic-panel-push',
  'comic-gutter-collapse',
] as const;
export type ComicTransitionId = (typeof COMIC_TRANSITION_IDS)[number];

export interface ComicTransitionStyle {
  readonly id: ComicTransitionId;
  /** The world (style id) whose films may use it. */
  readonly world: 'comic';
  readonly label: string;
  /** One line for the docs. */
  readonly description: string;
  /** Plain transition type (sound, act detection, fallback rendering in an older engine). */
  readonly type: 'wipe';
  /** Seconds (the showcase's). */
  readonly duration: number;
}

const style = (
  id: ComicTransitionId,
  label: string,
  description: string,
  duration: number,
): ComicTransitionStyle => ({ id, world: 'comic', label, description, type: 'wipe', duration });

export const COMIC_TRANSITION_STYLES: Readonly<Record<ComicTransitionId, ComicTransitionStyle>> = {
  'comic-page-turn': style(
    'comic-page-turn',
    'Page turn',
    'the printed page turns over to the next one, its back showing the ink through',
    0.9,
  ),
  'comic-page-back': style(
    'comic-page-back',
    'Page turned back',
    'a page is turned BACK to an earlier one: into a flashback',
    0.9,
  ),
  'comic-gutter-wipe': style(
    'comic-gutter-wipe',
    'Gutter split',
    'the page is cut along a leaning gutter through the focus and the halves pulled apart',
    0.7,
  ),
  'comic-panel-zoom': style(
    'comic-panel-zoom',
    'Into the panel',
    'the camera pushes into the focus while the next page pops up there as an inset panel and grows to the page (a match cut through one panel)',
    1.0,
  ),
  'comic-panel-slam': style(
    'comic-panel-slam',
    'Panel slam',
    'the next page slams onto this one as a panel, the page shakes, then it fills the frame',
    0.55,
  ),
  'comic-ink-bleed': style(
    'comic-ink-bleed',
    'Ink bleed',
    'wet ink creeps out from the focus along the fibres and prints the next page (out of a flashback)',
    1.0,
  ),
  'comic-page-slide': style(
    'comic-page-slide',
    'Page slide',
    'the page slides off sideways and the next one follows it in over a strip of the table: reading on to the next step, place or person',
    0.8,
  ),
  'comic-page-scroll': style(
    'comic-page-scroll',
    'Page slide down',
    'the page slides up and the next one rises from below: going down, deeper or further (a fall, a descent, the next layer)',
    0.7,
  ),
  'comic-panel-push': style(
    'comic-panel-push',
    'Panel push',
    'the next page shoves in from the right as a new panel and squeezes this one into a narrowing strip: one thing crowds out another, pressure building',
    0.6,
  ),
  'comic-gutter-collapse': style(
    'comic-gutter-collapse',
    'Gutter collapse',
    'the gutters above and below slam shut and crush the page into a slit at the focus height, the next page around it: a sudden stop, a trap closing',
    0.5,
  ),
};

export const COMIC_COMPOSITORS: Readonly<Record<ComicTransitionId, Compositor>> = {
  'comic-page-turn': pageTurn,
  'comic-page-back': pageBack,
  'comic-gutter-wipe': gutterWipe,
  'comic-panel-zoom': panelZoom,
  'comic-panel-slam': panelSlam,
  'comic-ink-bleed': inkBleed,
  'comic-page-slide': pageSlide,
  'comic-page-scroll': pageScroll,
  'comic-panel-push': panelPush,
  'comic-gutter-collapse': gutterCollapse,
};

export function isComicTransition(id: string | undefined): id is ComicTransitionId {
  return id !== undefined && (COMIC_TRANSITION_IDS as readonly string[]).includes(id);
}
