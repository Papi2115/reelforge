/**
 * Look `rpg-menu` (Game B2 world, look B, PLAN.md#13.4): the game's own screens as B-roll. A paused
 * menu over the dimmed level (quest log or stat sheet + inventory grid), the automap (the level
 * from above, unfolding out of the minimap: the film's continuity) and the intermission tally (a
 * chapter recap). Same b2View + b2Hud as look A (world-level templates). Templates:
 * packages/kit/examples/game-b2/b1-b5 (showcase shots 4, 5, 8 and two other mechanisms).
 */
import { defineLook } from '../../../../looks/types.js';
import { b2Hud } from '../../hud/hud-fx.js';
import { GAME_B2_ID } from '../../style.js';
import { b2View } from '../../view/view-fx.js';

const DOCS = `Look \`rpg-menu\` (world Game B2, B roll): the game's screens: a paused menu, the map, the end-of-level tally. Same \`kit.fx.b2View\` + \`kit.fx.b2Hud({ view })\` as look A; \`view.update(t); hud.update(t)\`.
- Menu: \`hud.menu({ at, until, quest: { now, objective, done: [...], ahead: n } | stats: { title, rows: [{ label, value, bar }] }, inventory: { items: [{ icon, label, sub, itemLabel, band }], select: [{ at, index }] }, note })\` over the dimmed level (>= 2.5 s, the walk holds still behind).
- Automap (breakthrough, <= 1 per ~60-90 s): \`view.automap({ intent, at, until, rooms: [{ cell: [x, y], label, sub, state: 'done' | 'next' | 'ahead' | 'hidden', at, labelAt }], replay: { from, to, dur }, marks: [{ kind: 'objective' | 'item' | 'cross', pos, at }], note: { text, pos, to, at }, camera: [{ at, x, y }] })\`. The map IS this shot's level: write a film-level grid (one room per chapter, doors between); walked rooms solid, the next dashed with the diamond. It unfolds out of the minimap and folds back into it (keep \`hud.minimap()\`). Errors say what to move (labels off screen, under the narration box, colliding).
- Tally (breakthrough, a chapter recap): \`hud.tally({ intent, at, until, title, sub, rows: [{ label, value, format: 'comma' | 'plain' | 'percent' | 'unit' | 'time', unit, approx, est, role: 'count' | 'par' | 'best', underline }], stamp: { text } })\`: counters tick on an uneven cadence, a still beat, the stamp; holds <= 4 s. Sounds: \`for (const c of r.cues) ctx.sfx.at(c.t, c.name)\`.
Toolkit, never a template: \`intent\` = the claim; never the same mechanism twice in a film (inspiration: b2 the story so far + a note, b3 a dive into the map mid-walk, b4 made vs sold + stamp, b5 a percent against par).
Craft (QUALITY.md): focal point and three human traces in a comment first. Every word from the narration (UI words: QUEST LOG, INVENTORY, PAUSED, NOW, DONE, AHEAD, EST.). Traces: walls 1 px off, uneven pen speed, pencil ticks, a counter that stalls, coffee ring, a misregistered stamp, a dev note. Never: a centred symmetric menu, rows at one pace, decorative icons.
References: docs/worlds/game-hud-b2-rpg-v2/shots/s4-t30.4.png (done solid, ahead dashed, the NEXT note), s5-t36.5.png (quest log), s8-t62.6.png (tally, UNSOLD stamp).`;

export const rpgMenuLook = defineLook({
  id: 'rpg-menu',
  label: 'RPG menu',
  description:
    "the game's own screens: a paused quest log / stat sheet with the inventory, the automap of the level (unfolds out of the minimap), the intermission tally",
  rolls: ['B'],
  treatments: ['ui-mockup', 'map', 'counter/odometer'],
  docs: DOCS,
  soundPalette: 'game-b2',
  variationBudget: GAME_B2_ID,
  available: true,
  styles: [GAME_B2_ID],
  experimental: true,
  kit: { templates: [b2View, b2Hud] },
});
