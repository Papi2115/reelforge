/**
 * `reelforge kit-docs people` / `kit-docs places` (PLAN.md#14.8): how to write a Grim Ink (c-cam)
 * project person (`kit-ext/people/<id>.js`) or place (`kit-ext/places/<id>.js`) and how scenes
 * call them (`ctx.kit.people.<id>`, `ctx.kit.places.<id>`). Short, reference text only; the full
 * drawing API is in the world's own topics (kit-docs grim-ink).
 */
import { INK_MODULE_LIMITS } from '@reelforge/shared';

export const PEOPLE_TOPIC = 'people';
export const PLACES_TOPIC = 'places';
export const INK_MODULE_TOPICS: readonly string[] = [PEOPLE_TOPIC, PLACES_TOPIC];

const LIMITS = `Limits: ${String(INK_MODULE_LIMITS.maxModules)} modules per kind, ${String(INK_MODULE_LIMITS.maxBytes / 1024)} KB and ${String(INK_MODULE_LIMITS.maxLines)} lines per file. Ids are camelCase and equal the file name (kit.people.nightBaker = kit-ext/people/nightBaker.js; kit.people['night-baker'] reads the same one).`;

const COMMON = [
  'Module rules (reelforge lint checks them): no imports; the same determinism rules as scenes (no Date, Math.random, timers, fetch, DOM); no module state written by functions; the ink grammar: no fillText / fonts (lettering is drawn ink), no gradients, patterns, filters, shadows, images or pixel reads.',
  'Every drawing function gets `ink`: zoom, lw (the ink width of the moment), C (palette), time.{twos, key, step, seg, ease, lerp, clamp01, hash, rnd, noise1}, and the brushes bound to g: inkLine(pts, o), brushStroke(pts, o), blob(pts, fill, o), tube(pts, widths, fill, o), rough, rect(x, y, w, h, fill, o), beam(x0, y0, x1, y1, w, seed, col), hatch(bb, spec, seed), mottle(bb, spec, seed), bands, stars, pool(cx, cy, rx, ry, col, alpha), gloom, bricks(x0, y0, w, h, o), stain, peel, crack, cobbles, windowPane, puddle, eye(x, y, rx, ry, face, o), brow(x, y, w, side, face, o), mouth(x, y, w, face, o), stubble, wart; pure: curve, ellipseRing(cx, cy, rx, ry, n), wobble, bbox. Points are flat [x, y, x, y, ...].',
  LIMITS,
];

const PEOPLE = [
  "Grim Ink people: each film hand-builds its own (never a generator), one module per person: kit-ext/people/<id>.js. The rig draws them (fixed order: far arm, legs, neck, torso, near arm, head, hands); the module supplies the person's dimensions and its per-view torso and heads.",
  'export const person = {',
  "  id: 'nightBaker', name: 'The Night Baker', seed: 2100,",
  '  D: { sw, sy, sz, hw, hy, l1a, l2a, l1l, l2l, waist: [x, y], hsz, top, elbowOut?, head?: { x: [4 views], top, bottom, hw } },  // body px, feet at 0, y up = negative',
  '  neck: [[x, y] | [baseX, baseY, headX, headY] x 4 views], headScale: 1.05-1.2,',
  '  tones: { skin, skinD, ...any }, arm: { cloth, clothD, w: [3], skin, skinD, hsz, bare?, hand?, cuff?, hatch?, lw? }, leg: { cloth, clothD, w: [3], shoe, shoeD, len, sw, splay?, hatch?, lw? },',
  "  defaultExpr?: 'deadpan', faceAnchors?: [4 x { chin, cheek, nose, mouth, ear, forehead }],",
  '  torso(g, ink, view) { ... },        // view 0 front, 1 three-quarter, 2 profile, 3 back; figure space',
  '  head(g, ink, view, face) { ... },   // head-local: origin = top of the neck, +x = the way the head faces',
  '  drawNeck?(g, ink, view, neck) { ... },',
  '};',
  'In a scene (c-cam style only): const baker = ctx.kit.people.nightBaker;',
  "  baker.draw(g, env, { x, y, s, view: 'three-quarter' | 'front' | 'profile' | 'back' | -3..3, pose: 'stand' | baker.pose('point', ph, over), ph, expr: 'shock', t: env.t, lean, bow, headYaw, headDy, talk, look, layer, beforeHand(J, ink), after(J, ink) }) -> joints",
  '  baker.D (dimensions for poses / contacts), baker.character (the rig record), baker.pose(name, ph, over).',
  'Look at it: reelforge people-preview <id> (6 views x stand/akimbo/walk + the 14 faces), then Read the sheet.',
  ...COMMON,
];

const PLACES = [
  'Grim Ink places: each film hand-builds its own settings, one module per place: kit-ext/places/<id>.js, drawn in place px (origin top-left, y down; 1920x1080 = the frame at zoom 1).',
  'export const place = {',
  "  id: 'bakeryBackRoom', name: 'The bakery back room', bounds: [w, h],",
  '  light?: { x, y, rx, ry, color, alpha? },   // the one warm light: a stepped pool drawn after the place',
  '  anchors?: { name: [x, y], ... },           // feet marks, the door, the counter top',
  '  collide?: [[x, y, w, h], ...],             // solid boxes people must not stand in',
  '  draw(g, ink, t) { ... },                   // a pure function of t (flicker on twos via ink.time)',
  '};',
  'In a scene (c-cam style only): const room = ctx.kit.places.bakeryBackRoom;',
  "  room.draw(g, env, t, { light: true }) — inside the camera transform; room.anchor('oven') -> [x, y]; room.bounds, room.light, room.collide.",
  'Look at it: reelforge places-preview <id> (wide, x2 on the light, x3.2 on the first anchor), then Read the sheet.',
  ...COMMON,
];

/** The topic text, or undefined when `input` is not one of these topics. */
export function describeInkModulesTopic(input: string): string | undefined {
  if (input === PEOPLE_TOPIC) return PEOPLE.join('\n');
  if (input === PLACES_TOPIC) return PLACES.join('\n');
  return undefined;
}
