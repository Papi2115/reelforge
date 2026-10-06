/**
 * World `sketchbook` (PLAN.md#13.6, docs/worlds/DECISIONS.md): a hand-drawn spiral notebook. Look
 * A = felt-tip story pages (`sketch-story`); looks B (ballpoint proofs), C (loud page moments),
 * the page-native transitions and the pop-up / accordion breakthrough scenes follow. Experimental
 * until they land: it renders with `render:frames --experimental` but is not offered anywhere.
 */
import { defineWorld } from '../types.js';
import { sketchStoryLook } from './looks/sketch-story/index.js';
import { SKETCHBOOK_ID, SKETCHBOOK_STYLE } from './style.js';

export { SKETCHBOOK_ID, SKETCHBOOK_STYLE } from './style.js';
export { sketchStoryLook } from './looks/sketch-story/index.js';

export const SKETCHBOOK = defineWorld({
  id: SKETCHBOOK_ID,
  label: 'Sketchbook',
  description:
    'A hand-drawn spiral notebook: a visible hand draws crude stick people, hand-lettered notes and red corrections with felt-tip, ballpoint and coloured pencils; line boil, paper, tape, coffee rings.',
  experimental: true,
  style: SKETCHBOOK_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  // No Sketchbook sound palette yet (sound is a later part of 13.6): the voxel one, as ADR-029.
  soundPalette: 'voxel',
  looks: [sketchStoryLook],
});
