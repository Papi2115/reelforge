/**
 * Look `atari-story` (Game B1 world, look A, PLAN.md#13.5): the film as a 2600 game played on a TV
 * in a room (the film's own interior, or the plain living room). The story happens INSIDE the TV
 * (2600 rules) or in the room around it; a camera pushes between the two worlds; boss cards name
 * the central problem; sticky notes sit on the glass. Templates: packages/kit/examples/game-b1/a1-a3
 * (ports of showcase shots 1, 2 and 3); the docs name the showcase's pieces in one line only.
 */
import { defineLook } from '../../../../looks/types.js';
import { b1Screen } from '../../screen/b1-screen.js';
import { GAME_B1_SHOWCASE_LINE } from '../../showcase.js';
import { GAME_B1_ID } from '../../style.js';

const DOCS = `Look \`atari-story\` (world Game B1, A roll): the film as a 2600 game on a TV in a room. Build \`const screen = kit.fx.b1Screen({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, anchor: ctx.anchor })\`, \`scene.add(screen)\`, in update(t) call \`screen.update(t)\`.
- Inside the TV: \`screen.tv((g, t) => ...)\` paints in 160x180 TV units with 2600 rules: bands per line, playfield blocks, sprites of <= 16 bits with ONE colour per row, Joy text, score digits; more than 2 sprites on a line flicker. The film's own things: \`screen.assets(ctx.worldAssets)\`, \`screen.defineSprite\` / \`screen.generate\`, then \`g.draw(id, x, y)\` and \`g.field(id, y)\`. Pure in t: use g.util (seg, ease, shake, typed), never Date/random.
- Gameplay (the main substance): \`screen.level({ intent, width, ground, hero: { sprite, run, jumps }, things: [{ sprite, x, role, label, patrol }] })\` plays the narration as a 2D level (items, obstacles, enemies, ONE goal; events derived), before \`screen.tv\`. \`worldView: 'screen'\` = no room, no camera.
- The room: the film's own \`screen.interior({ shell, light, calendar, props })\` (or the plain \`screen.room({ calendar, lamp })\`) + \`screen.camera([{ at, on: 'room' | 'tv' | 'calendar' }])\`; a push 'room' -> 'tv' grows the TV picture to the frame (continuity), 'tv' -> 'room' pulls back.
- HUD: year (the story's date), progress (one slot per shot), checkpoint (chapter), score (a number from the story), lives ONLY for a real threat, boss card ONLY for the central problem, say/narrate (CAPS, <= 3 lines), note on the glass (the weak point, hand-written).
Craft (QUALITY.md): write the focal point and three human traces in a comment first. ONE focal thing (the one lit window, the sprite that moves, the boss's digit), off-centre; crimson only for the threat. Traces: uneven release times, a wobble before a fall, hit-stop + squash + decaying shake, bulbs on their own cadences, an unclosed pen circle, a struck-out note, irregular typing. Never: invented labels (every word from the narration), a HUD element that means nothing, polished art (keep the crude sprites).
${GAME_B1_SHOWCASE_LINE}
Style references (pixels, CRT and HUD only, never their things): docs/worlds/game-hud-b1-boss-v2/shots/s1-t3.9.png, s2-t5.5.png, s3-t6.3.png.`;

export const atariStoryLook = defineLook({
  id: 'atari-story',
  label: 'Atari story',
  description:
    'the film as an Atari 2600 game on a TV in a room: the story inside the TV (wide pixels, one colour per sprite row, flicker, CRT) or the room around it, a camera pushing into the TV, boss cards, sticky notes on the glass',
  rolls: ['A'],
  treatments: ['character-scene', 'metaphor-object', 'title-card'],
  docs: DOCS,
  soundPalette: 'game-b1',
  variationBudget: GAME_B1_ID,
  available: true,
  styles: [GAME_B1_ID],
  experimental: true,
  kit: { templates: [b1Screen] },
});
