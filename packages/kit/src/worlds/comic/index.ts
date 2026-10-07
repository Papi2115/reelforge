/**
 * World `comic` (PLAN.md#13.3, docs/worlds/DECISIONS.md): a printed comic book. Look A = story
 * panels (`comic-story`), B = information pages (`comic-info`: cutaway, chart, checklist, stamp),
 * C = loud moments (`comic-loud`: the pause panel, onomatopoeia, the line lettered large). The
 * breakthrough scenes are page methods: `page.flashback` (sepia strip, look B) and `page.spread`
 * (double-page spread, look C). The panel-native transitions are engine compositors (`comic-*`
 * styles), the sounds the `comic` palette. Experimental: it renders with
 * `render:frames --experimental`; the app offers it only with experimental worlds on.
 *
 * Compositor (ADR-032): `kit.fx.comicPage` paints every panel into one index framebuffer, the
 * same way Sketchbook's page does; panels are masks with their own clock and camera.
 *
 * Text: the lettering (Inkhand) and the onomatopoeia (Forge Display) are own CC0 glyph tables
 * drawn into the page raster, so they live in `page.balloon` / `caption` / `sfx` / `note`;
 * `ctx.text` stays the engine pixel fonts (`fonts` below) and the look's docs send all on-screen
 * text to the page.
 */
import { defineWorld } from '../types.js';
import { comicInfoLook } from './looks/comic-info/index.js';
import { comicLoudLook } from './looks/comic-loud/index.js';
import { comicStoryLook } from './looks/comic-story/index.js';
import { COMIC_ID, COMIC_STYLE } from './style.js';

export { COMIC_ID, COMIC_STYLE } from './style.js';
export { COMIC_INKS } from './inks.js';
export { comicInfoLook } from './looks/comic-info/index.js';
export { comicLoudLook } from './looks/comic-loud/index.js';
export { comicStoryLook } from './looks/comic-story/index.js';

export const COMIC = defineWorld({
  id: COMIC_ID,
  label: 'Comic',
  description:
    'A printed comic book: uneven hand-ruled panels on newsprint, ink line art over off-register colour plates and halftone, speech balloons, captions and big onomatopoeia; the camera reads the page.',
  experimental: true,
  style: COMIC_STYLE,
  fonts: { display: 'display', mono: 'mono' },
  soundPalette: 'comic',
  looks: [comicStoryLook, comicInfoLook, comicLoudLook],
});
