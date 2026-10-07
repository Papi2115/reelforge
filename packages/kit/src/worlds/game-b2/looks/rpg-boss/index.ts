/**
 * Look `rpg-boss` (Game B2 world, look C, PLAN.md#13.4): the pressure moments. The central
 * problem as a boss bar, damage numbers popping off what is in danger, one big stinger word,
 * screen shake with decay, the thrown item and the fog between eras. Same b2View + b2Hud as look
 * A (world-level templates). Templates: packages/kit/examples/game-b2/c1-c2.
 */
import { defineLook } from '../../../../looks/types.js';
import { b2Hud } from '../../hud/hud-fx.js';
import { GAME_B2_ID } from '../../style.js';
import { b2View } from '../../view/view-fx.js';

const DOCS = `Look \`rpg-boss\` (world Game B2, C roll): the pressure moments, short and loud. Same \`kit.fx.b2View\` + \`kit.fx.b2Hud({ view })\` as look A; \`view.update(t); hud.update(t)\`.
- \`hud.boss({ name, label, keys: [[t, share]] })\` ONLY for the central problem; \`hud.meter\` for the thing in danger; \`hud.damage({ text: '-2', at, on: 'meter' | 'boss' })\` pops a number off it (call after meter / boss; story numbers or segments only).
- \`hud.stinger('TOO MANY', { at })\`: ONE phrase of the narration slams in letter by letter (<= 16 characters, once per film), falls out at \`until\`.
- Hits: \`view.shake({ at, amp })\` + \`hud.shake({ at, amp })\`, decaying; \`hud.status\` (FLOODED).
- Throw: \`view.throw(item, { intent, at, target: spriteId | to: [x, y], stay, shake })\`: the held item leaves the hand (dip, swing) at \`at\`, tumbles along an arc, lands with dust; the target flinches (a clerk shakes his head). Pair it with the inventory item's \`out\` and a toast. Items: \`{ kind: 'cartridge' | 'note' | 'key', label, band }\`. Sounds: \`for (const c of r.cues) ctx.sfx.at(c.t, c.name)\`.
- \`view.fog({ at, until })\`: a fog bank rolls in and clears (time passes).
Craft (QUALITY.md): focal point and three human traces in a comment first. One loud thing at a time; the accent only on THE item; hold still >= 0.4 s after the hit. Traces: shake with decay, uneven letter beats, losing segments blink, the head-shake, dust at 8.5 fps, a held look before the squeeze. Never: two stingers in a shot, a boss bar for a side issue, invented numbers.
References: docs/worlds/game-hud-b2-rpg-v2/shots/s6-t43.5.png (the aisle: FLOODED, MARKET draining), s7-t52.5.png (RETURNS DESK boss bar), s9-t70.png (the cartridge tossed into the pit).`;

export const rpgBossLook = defineLook({
  id: 'rpg-boss',
  label: 'RPG boss',
  description:
    'pressure moments of the level: the central problem as a boss bar, damage numbers, one slammed stinger word, shake with decay, the thrown item',
  rolls: ['C'],
  treatments: ['character-scene', 'kinetic-text', 'montage/transition'],
  docs: DOCS,
  soundPalette: 'game-b2',
  variationBudget: GAME_B2_ID,
  available: true,
  styles: [GAME_B2_ID],
  experimental: true,
  kit: { templates: [b2View, b2Hud] },
});
