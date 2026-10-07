/**
 * Look `rpg-explore` (Game B2 world, look A, PLAN.md#13.4): the film as a first-person RPG level.
 * The camera walks a raycast location (a built-in level or the scene's own), the hand takes and
 * holds the thing the narrator names, NPCs talk, and a woodgrain HUD carries the story's data.
 * Templates: packages/kit/examples/game-b2/a1-a3 (ports of showcase shots 1, 3 and 7).
 */
import { defineLook } from '../../../../looks/types.js';
import { b2Hud } from '../../hud/hud-fx.js';
import { GAME_B2_ID } from '../../style.js';
import { b2View } from '../../view/view-fx.js';

const DOCS = `Look \`rpg-explore\` (world Game B2, A roll): the story is a level you walk through. Build \`const view = kit.fx.b2View({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, level, path, anchor: ctx.anchor })\` and \`const hud = kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, anchor: ctx.anchor })\`; \`scene.add\` both; in update(t) call \`view.update(t); hud.update(t)\`.
- Level: 'office' | 'warehouse' (+ \`stencil: 'WORD'\`) or your own { name, mood: dark|tungsten|fluorescent|shop|backroom, floor, ceiling, grid: ['#####', '#...#', ...] (<= 32x32, closed border), legend: { '#': { wall: 'concrete' }, D: { door: true }, o: { floor: 'carpet', ceiling: 'office' } }, lights (<= 12), sprites (<= 40: clerk, desk, sign, exit, boxes, item, card, bin, pallet, carton, sand-pile) }. Errors name the grid row.
- Path: keys { at, x, y, yaw, pitch, ease } in cells; walk (in), stop (out), look (inOut); hold still >= 0.4 s somewhere.
- View: open(door), switchOn(light), act(clerk, talk|no), place(sprite), shake, take(item, { from: [x, y, z] }), hold, present, throw(item, { intent, at, target | to }) (it leaves the hand, the target flinches), fog({ at, until }).
- HUD: compass (year, place, target), minimap, narrate / say (CAPS, \\n, <= 3 lines), toast, inventory, choose, status; meter only for a real threat, boss only for the central problem, progress = film progress.
Craft (QUALITY.md): write the focal point and three human traces in a comment first. ONE focal thing per shot (the item in the hand, the clerk, the sign), off-centre; pink (accent) only for THE item of the story; the HUD is texture, never the focal point. Traces: a bulb that stutters, a faulty tube, uneven strides, chalk or a hand-lettered sign, a struck-out option, an overshoot on the reach. Never: invented labels (every word is from the narration), constant walking, a HUD element that means nothing, polished art (keep the crude sprites).
References: docs/worlds/game-hud-b2-rpg-v2/shots/s1-t3.5.png (one bulb, sand, chalk tally), s3-t20.png (the reach for the shelf), s7-t52.5.png (the clerk, struck options, UNSOLD bar).`;

export const rpgExploreLook = defineLook({
  id: 'rpg-explore',
  label: 'RPG explore',
  description:
    'first-person RPG level (Doom vibe): walk a raycast location, the hand takes the named thing, NPCs talk; woodgrain HUD with year compass, minimap and a typed narration box',
  rolls: ['A'],
  treatments: ['character-scene', 'metaphor-object', 'map'],
  docs: DOCS,
  soundPalette: 'game-b2',
  variationBudget: GAME_B2_ID,
  available: true,
  styles: [GAME_B2_ID],
  experimental: true,
  kit: { templates: [b2View, b2Hud] },
});
