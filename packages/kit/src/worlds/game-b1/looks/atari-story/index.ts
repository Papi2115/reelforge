/**
 * Look `atari-story` (Game B1 world, look A, PLAN.md#13.5): the film as a 2600 game played in a
 * 1982 living room. The story happens INSIDE the TV (2600 rules) or in the room around it; a camera
 * pushes between the two worlds; boss cards name the central problem; Dad's sticky notes sit on
 * the glass. Templates: packages/kit/examples/game-b1/a1-a3 (ports of showcase shots 1, 2 and 3).
 */
import { defineLook } from '../../../../looks/types.js';
import { b1Screen } from '../../screen/b1-screen.js';
import { GAME_B1_ID } from '../../style.js';

const DOCS = `Look \`atari-story\` (world Game B1, A roll): a 2600 game in a 1982 living room. Build \`const screen = kit.fx.b1Screen({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, anchor: ctx.anchor })\`, \`scene.add(screen)\`, in update(t) call \`screen.update(t)\`.
- Inside the TV: \`screen.tv((g, t) => ...)\` paints in 160x180 TV units with 2600 rules: bands per line, playfield blocks, sprites of <= 16 bits with ONE colour per row, carts, Joy text, score digits; more than 2 sprites on a line flicker. Pure in t: use g.util (seg, ease, shake, typed), never Date/random.
- The room: \`screen.room({ calendar, tree, gift, lamp, carts })\` + \`screen.camera([{ at, on: 'room' | 'tv' | 'calendar' }])\`; a push 'room' -> 'tv' grows the TV picture to the frame (continuity), 'tv' -> 'room' pulls back.
- HUD: year (the story's date), progress (cartridge per shot), checkpoint (chapter), score (a number from the story), lives ONLY for a real threat, boss card ONLY for the central problem, say/narrate (CAPS, <= 3 lines), note on the glass (the weak point in Dad's hand).
Craft (QUALITY.md): write the focal point and three human traces in a comment first. ONE focal thing (the lit cartridge, the missing gift, the boss's digit), off-centre; crimson only for the threat. Traces: uneven release times, a wobble before a fall, hit-stop + squash + decaying shake, bulbs on their own cadences, an unclosed pen circle, a struck-out note, irregular typing. Never: invented labels (every word from the narration), a HUD element that means nothing, polished art (keep the crude sprites).
References: docs/worlds/game-hud-b1-boss-v2/shots/s1-t3.9.png (the lit cart on the dim pile), s2-t5.5.png (the dashed gap + tag), s3-t6.3.png (the boss digit, the struck note).`;

export const atariStoryLook = defineLook({
  id: 'atari-story',
  label: 'Atari story',
  description:
    'the film as an Atari 2600 game in a 1982 living room: the story inside the TV (wide pixels, one colour per sprite row, flicker, CRT) or the room around it, a camera pushing into the TV, boss cards, sticky notes on the glass',
  rolls: ['A'],
  treatments: ['character-scene', 'metaphor-object', 'title-card'],
  docs: DOCS,
  soundPalette: 'game-b2',
  variationBudget: GAME_B1_ID,
  available: true,
  styles: [GAME_B1_ID],
  experimental: true,
  kit: { templates: [b1Screen] },
});
