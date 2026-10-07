/**
 * Look `atari-menu` (Game B1 world, look B, PLAN.md#13.5 part b): the console's own screens as
 * B-roll. The market menu (inventory grid, a cursor walking the options), the level-select map
 * (the story changes place or time), and the two breakthroughs: the attract-mode high-score table
 * and the instruction-manual page. Same b1Screen as look A. Templates:
 * packages/kit/examples/game-b1/b1-b6 (showcase shots 4, 5 and 8, the level map, and two other
 * mechanisms for the toolkits).
 */
import { defineLook } from '../../../../looks/types.js';
import { b1Screen } from '../../screen/b1-screen.js';
import { GAME_B1_ID } from '../../style.js';

const DOCS = `Look \`atari-menu\` (world Game B1, B roll): the console's screens. Same \`kit.fx.b1Screen\` as look A.
- Menu: paint it in \`screen.tv((g, t) => ...)\` (panel, icons, a cursor with overshoot, names typed with g.util.typed, cartridges filling a grid, ONE crimson word).
- \`screen.levelSelect({ intent, at, until, nodes: [{ label, icon: 'home' | 'store' | 'pit' | 'office' | 'factory' | 'lock', x, y, above }], route: { from, to, at, dur } })\`: the story's places, the cartridge cursor hops along dotted paths; places not reached yet are \`lock\` ('?', no label).
- High-score table (breakthrough): \`screen.scoreTable({ intent, at, until, title, rows: [{ who, score, locked }], hero, print, slam: { at, shake }, initials: 'arcade' | 'typed' | 'none', ring: { at, note }, prompt: { text, at }, enter: 'draw-in' | 'cut' })\`: rows = the story's facts in order of events, score = a real number / year (never invented), later events locked ???; a beat of silence (>= 0.4 s) before the slam; holds <= 4 s after its last beat.
- Manual page (breakthrough): \`screen.manual({ intent, at, until, steps: ['A HIT SELLS.', ...] (<= 5, '\\n' <= 2 lines), figure: { caption, shape: 'cartridge' | 'box' | 'person' | 'house', layout: 'shelf' | 'pile' | 'queue', count, hit, callouts: [{ item, step }] }, ticks: [t...], correction: { step, strike, write, at }, note: { text, at }, enter: 'slide' | 'cut', exit: 'turn' | 'cut' })\`: the mechanism as HOW TO PLAY; ONE red correction = the point.
Every toolkit returns { at, end, intent, cues }: \`for (const c of r.cues) ctx.sfx.at(c.t, c.name)\`.
Toolkit, never a template: \`intent\` = the claim; never the same mechanism twice in a film (inspiration: b1 attract table + ring, b4 a board with the record mid-table; b3 shelf + correction + page turn, b5 pyramid slides in + margin note).
Craft (QUALITY.md): focal point and three human traces in a comment first. Every word from the narration (game words allowed: HIGH SCORES, HOW TO PLAY, FIG., INSERT COIN, PRESS START). Never: a centred table, rows at one pace, decorative icons, invented scores.
References: docs/worlds/game-hud-b1-boss-v2/shots/s4-t5.6.png (gold 1982, ring, locked rows), s5-t3.0.png (market menu), s8-t7.4.png (manual, red ANY).`;

export const atariMenuLook = defineLook({
  id: 'atari-menu',
  label: 'Atari menu',
  description:
    "the console's own screens: the market menu, the level-select map, the attract-mode high-score table and the instruction-manual page",
  rolls: ['B'],
  treatments: ['ui-mockup', 'map', 'counter/odometer', 'node-graph/timeline'],
  docs: DOCS,
  soundPalette: 'game-b1',
  variationBudget: GAME_B1_ID,
  available: true,
  styles: [GAME_B1_ID],
  experimental: true,
  kit: { templates: [b1Screen] },
});
