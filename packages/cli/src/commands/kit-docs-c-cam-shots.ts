/**
 * `reelforge kit-docs lib | shots | shot-*` (PLAN.md#14.19): the Grim Ink authoring references.
 * `lib` = how a film's shared library is written and called. `shots` = annotated, trimmed shots of
 * the concept films (docs/concepts/c-cam-style/films), each a TECHNIQUE (a running gag, a climax
 * extreme close-up, an accident beat, a reverse / over-the-shoulder pair, a foreground-silhouette
 * tension shot) restated in this world's scene API with neutral ids; never content (the
 * unrequested-showcase guard flags the films' objects in a scene). Each topic stays under 6 KB.
 */
import { C_CAM_API, C_CAM_LIB_DIR, C_CAM_LIB_TOPIC, C_CAM_SHOT_TOPICS } from '@reelforge/prompts';
import { INK_MODULE_LIMITS } from '@reelforge/shared';

const INK = C_CAM_API.ink;
const T = C_CAM_SHOT_TOPICS;
const RULE =
  'TECHNIQUE, NOT CONTENT: this is how an authored shot is BUILT (cut times, zooms, rolls, timing, acting beats). Never reuse its people, places, objects, words or numbers: your film draws its own (an unrequested object of the concept films is flagged).';
const SEE = `technique topics: ${Object.values(T).join(', ')} (reelforge kit-docs <topic>)`;

const LIB = [
  `Grim Ink libraries (${C_CAM_LIB_DIR}/<name>.js): the film's shared code, like the concept films' acting.js, props.js, crowd.js. One literal export of plain functions, no imports, no state, the scene rules (no Date, Math.random, timers):`,
  'export const lib = {',
  '  seat(D, over) { return { kL: "flat", kR: "flat", bob: 0.4, ...over }; },          // a pose helper: any arguments',
  '  slip(g, ink, x, y, rot, seed) { g.save(); g.translate(x, y); g.rotate(rot);    // a drawing helper: (g, ink, ...)',
  '    ink.rough([-26, -18, 26, -20, 28, 18, -24, 20], ink.C.LINEN, { seed, lw: 4 }); g.restore(); },',
  '  crowdRow(g, ink, y, n, seed) { for (let i = 0; i < n; i += 1) ink.lib.crowd.figure(g, ink, 200 + i * 180, y, seed + i); },',
  '};',
  'Calls: a scene `ctx.kit.lib.<name>.<fn>(g, cam.env, ...)`; a person or place module `ink.lib.<name>.<fn>(g, ink, ...)`. A drawing helper always receives the module ink toolbox (`ink.blob`, `ink.inkLine`, `ink.C`, `ink.time`, `ink.lib`, at the ink width of the env or ink it was given; reelforge kit-docs people lists it); a helper whose first argument is not the painter gets its arguments as passed.',
  `Use one for code two or more shots or modules share (a seated pose, a ballot slip, a crowd row, the film's shared set dressing). Name = camelCase file name (kit.lib.crowd = ${C_CAM_LIB_DIR}/crowd.js). Limits: ${String(INK_MODULE_LIMITS.maxModules)} libraries, ${String(INK_MODULE_LIMITS.maxBytes / 1024)} KB and ${String(INK_MODULE_LIMITS.maxLines)} lines per file. Check: reelforge lint ${C_CAM_LIB_DIR}/<name>.js.`,
];

const INDEX = [
  'Grim Ink technique shots: trimmed, annotated shots of the three concept films restated in this API. Read the one closest to your shot BEFORE writing it.',
  RULE,
  `  ${T.runningGag}: a tic that runs through the film and pays off at its end (ctx.film)`,
  `  ${T.climaxEcu}: the climax as an extreme close-up, tilted, then the reaction`,
  `  ${T.accident}: a small accident beat in 5 framings (wide, tilt, ECU of the object, low on the reaction, wide)`,
  `  ${T.reverseOts}: over-the-shoulder into the scene, then the reverse on the faces`,
  `  ${T.foregroundTension}: a foreground silhouette crossing the wide, an insert, a low tilted push-in`,
];

const CUT = `const cam = ${INK}.applyCamera(g, ${INK}.resolveCut(s.cuts, env.t))`;

const RUNNING_GAG = [
  `${T.runningGag}: from the moon-landing film. The commander chews gum in every shot he is in; at the landing he slowly blows a bubble (ECU); in the last shot he still chews, then looks at us.`,
  RULE,
  '// build(): the gag knows where it is in the FILM, not only in the shot',
  'const s = { stage, land: ctx.anchor("has landed").t, payoff: ctx.film.shotIndex === ctx.film.shotCount - 1 };',
  's.cuts = [{ at: 0, x: 1240, y: 500, z: 2.0 },                       // close-up: the other one, frozen',
  '  { at: s.land, x: 830, y: 450, z: 2.6, to: { x: 830, y: 450, z: 2.85 }, end: s.land + 1.4 }]; // ECU: the bubble grows',
  '// paint: the tic every shot; its size reads film progress, so the same gag escalates across the film',
  `${CUT};`,
  'const chewing = !s.payoff || env.t < s.land;   // stops only for the payoff beat',
  "const bubble = env.time.key(env.t, [[s.land, 0], [s.land + 1.2, 0.75, 'out']]);",
  "ctx.kit.people.chewer.draw(g, cam.env, { x: 800, y: 1080, s: 0.94, t: env.t, view: 'three-quarter', expr: 'deadpan', look: [0.3, 0], gag: { kind: 'gum', t0: 0 }, props: { bubble } });",
  "ctx.kit.people.hero.draw(g, cam.env, { x: 1240, y: 1076, s: 0.9, t: env.t, view: -1, expr: 'exhausted', gag: { kind: 'sweat' } });",
  'Why it works: the tic is set up early, repeated small and deadpan, then pays off big at a turning point; ctx.film.progress or ctx.film.shotIndex can grow it (a bigger bubble, a taller pile) without a word. Never loop it all shot long: it plays on beats.',
];

const CLIMAX_ECU = [
  `${T.climaxEcu}: from the moon-landing film ("1202"). The alarm code fills the frame, tilted, pushing in; a hard cut to the reaction, tilted the other way, the pages flipping faster.`,
  RULE,
  's.cuts = [',
  '  { at: 0, x: 540, y: 290, z: 2.4, rot: 4, to: { x: 548, y: 290, z: 2.6 }, end: s.flip },   // ECU: the number, tilted +4',
  '  { at: s.flip, x: 1300, y: 640, z: 1.45, rot: -6, to: { x: 1330, y: 640, z: 1.6 }, end: s.flip + 2.6 }, // the reaction, tilted -6',
  '];',
  `${CUT};`,
  'const on = Math.floor(env.time.twos(env.t) * 3) % 2 === 0;           // the alarm blinks on twos',
  `${INK}.rect(g, cam.env, 740, 120, 270, 90, on ? env.C.RED : env.C.RED_D, { seed: 352, lw: 6 });`,
  `if (on) ${INK}.pool(g, 870, 170, 900, 600, env.C.RED, 0.1);          // the one light of the beat`,
  `if (on) ${INK}.drawText(s.code, { face: 'hand', size: 96, x: 560, y: 300, seed: 9, fill: env.C.FIRE }); // s.code = the narration's number`,
  'const fast = env.t >= s.flip;',
  "ctx.kit.people.hero.draw(g, cam.env, { x: 1420, y: 1560, s: 1.55, view: -1, t: env.t, expr: env.ink.exprAt([[0, 'confused'], [s.flip, 'scared']], env.t), headDy: fast ? (Math.floor(env.t * 12) % 2) * -4 : 0, props: { page: (env.t * (fast ? 6 : 2.5)) % 1 } });",
  'Why it works: the climax is ONE readable object filling the frame (the number of the narration), the Dutch tilt flips sign on the cut, the reaction figure is huge and cropped (s 1.55, feet off-frame), the acting accelerates (page rate 2.5 -> 6) instead of the camera spinning.',
];

const ACCIDENT = [
  `${T.accident}: from the samurai film ("the wrong bow"). A bow goes too deep, the hat falls, rolls and stops against the boss's toe; he looks at it, then at you. Five framings in five seconds.`,
  RULE,
  's.cuts = [',
  '  { at: 0, x: 980, y: 520, z: 1.04, to: { x: 980, y: 520, z: 1.1 }, end: 1.0 },     // wide: the boss arrives',
  '  { at: 1.0, x: 1000, y: 520, z: 1.6, rot: -4 },                                   // closer, tilting: the bow goes too far',
  '  { at: 1.6, x: 1194, y: 830, z: 2.6, to: { x: 1194, y: 830, z: 2.8 }, end: 2.4 }, // ECU: the object against his toe',
  '  { at: 2.4, x: 1260, y: 360, z: 1.9, rot: -5 },                                   // low, tilted: his fury',
  '  { at: 3.6, x: 980, y: 520, z: 1.0, to: { x: 980, y: 530, z: 1.06 }, end: 5 },     // wide: the whole ruined day',
  '];',
  `${CUT};`,
  "const bow = env.time.key(env.t, [[1.0, 0], [1.3, 96, 'out'], [3.2, 96], [3.8, 18]]); // overshoot, hold, recover",
  "ctx.kit.people.boss.draw(g, cam.env, { x: 1290, y: 900, s: 0.9, t: env.t, view: -2, expr: env.ink.exprAt([[0, 'deadpan'], [1.6, 'disgust'], [2.4, 'rage']], env.t), headDy: env.t >= 2.4 && env.t < 2.6 ? -14 : 0 });",
  "ctx.kit.people.hero.draw(g, cam.env, { x: 760, y: 900, s: 0.9, t: env.t, view: 2, bow, expr: env.ink.exprAt([[0, 'scared'], [1.3, 'shock'], [3.2, 'miserable']], env.t), props: { hat: env.t < 1.28 } });",
  '// the fallen object: a pure function of t (drop 0.3 s, roll 0.7 s, rock to a stop), drawn inline at its own seed',
  'Why it works: cause -> object -> reaction, each in its own framing; the object gets an ECU of its own; the reaction is low and tilted with a head jolt; the last wide shows the consequence. Timing: fast, fast, hold.',
];

const REVERSE_OTS = [
  `${T.reverseOts}: from the papal-election film ("still no pope"). Over a reader's shoulder (his back fills the left third) to the table; cut: tilted close-up, the tired one groans; cut: close on the stubborn one, a slow smug "no".`,
  RULE,
  's.cuts = [',
  "  { at: 0, name: 'ots', x: 1060, y: 520, z: 1.1, to: { x: 1100, y: 520, z: 1.16 }, end: s.groan },",
  "  { at: s.groan, name: 'groan', x: 610, y: 470, z: 2.2, rot: -5, to: { x: 610, y: 470, z: 2.35 }, end: s.no },",
  "  { at: s.no, name: 'no', x: 1180, y: 480, z: 2.3, to: { x: 1200, y: 480, z: 2.45 }, end: s.no + 1.5 },",
  '];',
  `${CUT};`,
  'ctx.kit.places.hall.draw(g, cam.env, env.t);',
  "ctx.kit.people.tired.draw(g, cam.env, { x: 620, y: 880, s: 0.8, t: env.t, view: 1, expr: env.t < s.groan ? 'exhausted' : 'miserable', headDy: env.t < s.groan ? 0 : 16, talk: [[s.groan + 0.05, s.groan + 0.95]] });",
  "const shake = env.t < s.no ? -1 : [0, 1, 0, -1][Math.floor(env.time.twos(env.t) / 0.42) % 4] - 1; // the slow 'no': head yaw on twos",
  "ctx.kit.people.stubborn.draw(g, cam.env, { x: 1290, y: 880, s: 0.82, t: env.t, view: shake, expr: env.t < s.no ? 'deadpan' : 'smug' });",
  "if (env.t < s.groan) ctx.kit.people.reader.draw(g, cam.env, { x: 470, y: 1900, s: 4.2, view: 'back', t: env.t }); // OTS: huge, from behind, in front",
  'Reverse: the NEXT framing (or the next shot) restages the same place from the other side: swap screen sides, the far wall becomes near, keep the eye line (a person looking right now looks left).',
  'Why it works: the foreground back gives depth and a point of view; the close-ups are tilted only on the tense beat; the payoff is a tiny repeated head move, not a big gesture.',
];

const FOREGROUND = [
  `${T.foregroundTension}: from the samurai film ("the market"). Wide: a passer-by crosses the foreground as a flat black silhouette; insert: the price board flips, and flips; low, tilted push-in on the panic.`,
  RULE,
  's.cuts = [',
  '  { at: 0, x: 980, y: 560, z: 1.0, to: { x: 980, y: 540, z: 1.06 }, end: 1.9 },        // wide (the silhouette crosses)',
  '  { at: 1.9, x: 1280, y: 420, z: 2.1, to: { x: 1280, y: 420, z: 2.3 }, end: 3.7 },     // insert: the board',
  '  { at: 3.7, x: 860, y: 560, z: 1.5, rot: 5, to: { x: 840, y: 540, z: 1.8 }, end: 6 }, // low, tilted push-in',
  '];',
  `${CUT};`,
  'const flips = [0.9, 1.9, 2.6, 3.2, 3.7, 4.1, 4.5, 4.8, 5.1, 5.4];          // accelerating beats, not a loop',
  'const n = flips.filter((at) => env.t >= at).length;',
  "ctx.kit.people.hero.draw(g, cam.env, { x: 800, y: 1044, s: 0.92, t: env.t, view: 1, look: [0.8, -0.8], expr: env.ink.exprAt([[0, 'confused'], [1.9, 'scared'], [3.7, 'shock'], [4.2, 'yelling']], env.t), headDy: env.t >= 3.7 && env.t < 3.9 ? -20 : 0, talk: [[4.2, 5.6]] });",
  `if (env.t < 1.9) ${INK}.fgWorld(g, cam, () => ${INK}.silhouette(g, [x0, 1080, x0 + 40, 700, x0 + 160, 640, x0 + 260, 1080]));`,
  "//   x0 = env.time.key(env.t, [[0, 1900], [1.9, 1560, 'lin']]): it moves while the hero stands still",
  `${INK}.fgScreen(g, () => ${INK}.silhouette(g, [0, 1080, 0, 760, 120, 700, 240, 1080])); // or at the lens, in screen space`,
  `Why it works: the silhouette is flat ink with no outline, crosses or frames but never covers the focal point; the insert's flips speed up (gaps 1.0 -> 0.3 s) so tension builds by timing; the last framing pushes in AND tilts (${INK}.coverage(s.cuts, bounds) must stay empty).`,
];

const TOPICS: Readonly<Record<string, readonly string[]>> = {
  [C_CAM_LIB_TOPIC]: LIB,
  [T.index]: INDEX,
  [T.runningGag]: RUNNING_GAG,
  [T.climaxEcu]: CLIMAX_ECU,
  [T.accident]: ACCIDENT,
  [T.reverseOts]: REVERSE_OTS,
  [T.foregroundTension]: FOREGROUND,
};

/** Every topic name of this file (`lib`, then the technique shots). */
export const C_CAM_REFERENCE_TOPICS: readonly string[] = Object.keys(TOPICS);

/** The text of a library or technique topic, or undefined for any other name. */
export function describeCCamReferenceTopic(name: string): string | undefined {
  if (!Object.hasOwn(TOPICS, name)) return undefined;
  const lines = TOPICS[name] ?? [];
  return name === C_CAM_LIB_TOPIC ? lines.join('\n') : [...lines, SEE].join('\n');
}
