/**
 * World `sketchbook` (PLAN.md#13.6, docs/worlds/DECISIONS.md): a hand-drawn spiral notebook. Look
 * A = felt-tip story pages (`sketch-story`), B = ballpoint proofs (`sketch-graph`), C = loud page
 * moments (`sketch-loud`); all three draw on the world-level `kit.fx.sketchPage`. The page-native
 * transitions are engine compositors (`sketchbook-*` styles), the sounds the `sketchbook` palette.
 * The breakthrough scenes are page methods too: `page.popup` (look C) and `page.strip` (look B).
 * Experimental: it renders with `render:frames --experimental` but is not offered anywhere.
 *
 * Text: the hand lettering is stroke data drawn into the page raster over time by the visible
 * hand (with line boil), so it lives in `page.write`. `ctx.text` / `ctx.annotate` stay the engine
 * pixel fonts (`fonts` below maps the roles to them): routing them through the hand would need a
 * new engine font id (FONT_NAMES, ctx.text options, text QA and the docs of every style) and the
 * page raster inside the engine text layer, so the looks' docs send all on-screen text to
 * `page.write` instead.
 */
import { defineWorld } from '../types.js';
import { sketchGraphLook } from './looks/sketch-graph/index.js';
import { sketchLoudLook } from './looks/sketch-loud/index.js';
import { sketchStoryLook } from './looks/sketch-story/index.js';
import { SKETCHBOOK_ID, SKETCHBOOK_STYLE } from './style.js';

export { SKETCHBOOK_ID, SKETCHBOOK_STYLE } from './style.js';
export { SKETCHBOOK_INKS } from './inks.js';
export { sketchGraphLook } from './looks/sketch-graph/index.js';
export { sketchLoudLook } from './looks/sketch-loud/index.js';
export { sketchStoryLook } from './looks/sketch-story/index.js';

export const SKETCHBOOK = defineWorld({
  id: SKETCHBOOK_ID,
  label: 'Sketchbook',
  description:
    'A hand-drawn spiral notebook: a visible hand draws crude stick people, hand-lettered notes and red corrections with felt-tip, ballpoint and coloured pencils; line boil, paper, tape, coffee rings.',
  experimental: true,
  style: SKETCHBOOK_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'sketchbook',
  looks: [sketchStoryLook, sketchGraphLook, sketchLoudLook],
});
