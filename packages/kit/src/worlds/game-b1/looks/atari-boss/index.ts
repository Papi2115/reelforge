/**
 * Look `atari-boss` (Game B1 world, look C, PLAN.md#13.5 part b): the pressure moments. A boss
 * intro slam for the central problem, its bar (segments lost or, for a boss that is an amount,
 * gained), damage as flashes and decaying shakes, the hit-stop, the crash that drains the picture
 * line by line, and the game-over / continue? screen. Same b1Screen as look A. Templates:
 * packages/kit/examples/game-b1/c1-c3 (showcase shots 6, 9 and 10).
 */
import { defineLook } from '../../../../looks/types.js';
import { b1Screen } from '../../screen/b1-screen.js';
import { GAME_B1_ID } from '../../style.js';

const DOCS = `Look \`atari-boss\` (world Game B1, C roll): the pressure moments, short and loud. Same \`kit.fx.b1Screen\` as look A.
- \`screen.boss({ num, name, from: 'left' | 'right' | 'top', x, y, at, hp: { n, label, keys: [[t, value]] }, defeat })\` ONLY for the central problem: BOSS n types, the name slams in with overshoot and shake; each lost segment flashes and shakes the card (a boss that IS an amount may gain segments); defeat = flicker death. Its look in the TV: the film's own boss (\`screen.generate(id, { kind: 'boss', body, eyes, mouth, arms })\`).
- Hits inside the TV: hit-stop (freeze t), \`g.remap('flash')\` for one or two frames, decaying \`g.util.shake\` through \`g.offset\`; the crash: \`g.remap('drain', level, [y0, y1])\` line by line; lights out: \`g.remap('dim', undefined, [0, rows])\`.
- \`screen.gameOver({ text: 'CONTINUE?' | 'GAME OVER', at, until, count: [[t, digit]], ghost })\`: black, the boss card burned in, a countdown with unequal holds; the scene's tv() painters draw over it (\`g.rectPx\` only for a thing of a newer console).
- \`screen.note(lines, { at, under, strike, tick })\`: the weak point, hand-written on the glass.
Craft (QUALITY.md): focal point and three human traces in a comment first. One loud thing at a time; crimson only for the threat; hold still >= 0.4 s after the hit. Traces: surges in a fast-fast-pause rhythm, crest flicker, the input-lag crouch, hit-stop + squash, uneven countdown holds. Never: a boss for a side issue, two slams at once, invented numbers.
Style references (pixels, CRT and HUD only, never their things): docs/worlds/game-hud-b1-boss-v2/shots/s6-t5.6.png, s9-t2.5.png, s10-t1.5.png.`;

export const atariBossLook = defineLook({
  id: 'atari-boss',
  label: 'Atari boss',
  description:
    'pressure moments of the 2600 game: the boss slam, its bar, damage flashes and shake, the crash draining the picture, the continue? screen',
  rolls: ['C'],
  treatments: ['character-scene', 'kinetic-text', 'montage/transition'],
  docs: DOCS,
  soundPalette: 'game-b1',
  variationBudget: GAME_B1_ID,
  available: true,
  styles: [GAME_B1_ID],
  experimental: true,
  kit: { templates: [b1Screen] },
});
