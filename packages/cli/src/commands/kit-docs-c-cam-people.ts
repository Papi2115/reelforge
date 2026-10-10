/**
 * `reelforge kit-docs people` / `kit-docs places` (PLAN.md#14.8): how to write a Grim Ink (c-cam)
 * project person (`kit-ext/people/<id>.js`) or place (`kit-ext/places/<id>.js`) and how scenes
 * call them (`ctx.kit.people.<id>`, `ctx.kit.places.<id>`). Short, reference text only; the full
 * drawing API is in the world's own topics (kit-docs grim-ink).
 */
import { GAG_DOCS, GAG_KINDS, MAX_GAGS } from '@reelforge/kit';
import { C_CAM_GAG_TAG } from '@reelforge/prompts';
import { INK_MODULE_LIMITS } from '@reelforge/shared';

export const PEOPLE_TOPIC = 'people';
export const PLACES_TOPIC = 'places';
export const INK_MODULE_TOPICS: readonly string[] = [PEOPLE_TOPIC, PLACES_TOPIC];

const LIMITS = `Limits: ${String(INK_MODULE_LIMITS.maxModules)} modules per kind, ${String(INK_MODULE_LIMITS.maxBytes / 1024)} KB and ${String(INK_MODULE_LIMITS.maxLines)} lines per file. Ids are camelCase and equal the file name (kit.people.nightBaker = kit-ext/people/nightBaker.js; kit.people['night-baker'] reads the same one).`;

const COMMON = [
  'Module rules (reelforge lint checks them): no imports; the same determinism rules as scenes (no Date, Math.random, timers, fetch, DOM); no module state written by functions; the ink grammar: no fillText / fonts (lettering is drawn ink), no gradients, patterns, filters, shadows, images or pixel reads.',
  'Every drawing function gets `ink`: zoom, lw (the ink width of the moment), C (palette), time.{twos, key, step, seg, ease, lerp, clamp01, hash, rnd, noise1}, and the brushes bound to g: inkLine(pts, o), brushStroke(pts, o), blob(pts, fill, o), tube(pts, widths, fill, o), rough, rect(x, y, w, h, fill, o), beam(x0, y0, x1, y1, w, seed, col), hatch(bb, spec, seed), mottle(bb, spec, seed), bands, stars, pool(cx, cy, rx, ry, col, alpha), gloom, bricks(x0, y0, w, h, o), stain, peel, crack, cobbles, windowPane, puddle, eye(x, y, rx, ry, face, o), brow(x, y, w, side, face, o), mouth(x, y, w, face, o), stubble, wart, pores(x0, y0, w, h, n, seed, col); props: sweat(pts, t, seed), gumBubble(x, y, r, seed), helmet(cx, cy, rx, ry, { visor, vx, seed }), thumbsUp(x, y, sz, col, colD, seed), mug(x, y, tilt, seed, steam), sandwich(x, y, rot, seed, bite), checklist(x, y, w, page, seed), puff(x, y, k, seed), ticks(x, y, len, ang, seed), watch(x, y, r, t, seed); pure: curve, ellipseRing(cx, cy, rx, ry, n), wobble, bbox; text(text, { role, x, y }). Points are flat [x, y, x, y, ...].',
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
  "  signatureGag: { kind: 'gum', note: 'chews gum when everyone panics' },  // REQUIRED: the person's ONE tic (a gag kind below)",
  '  torso(g, ink, view, p) { ... },        // view 0 front, 1 three-quarter, 2 profile, 3 back; figure space',
  '  head(g, ink, view, face, p) { ... },   // head-local: origin = top of the neck, +x = the way the head faces',
  '  drawNeck?(g, ink, view, neck, p) { ... },',
  "  arms?(p) { return p.mug === undefined ? undefined : { R: { hand: 'grip', front: Boolean(p.sip) } }; },  // hand shape, arm in front of the face",
  "  held?(g, ink, side, palm, p) { ... },  // a ONE-hand prop, in that arm's layer; the hand closes over it (ink.mug(palm[0], palm[1]))",
  '  beforeHand?(g, ink, J, view, p) { ... },  // only a thing in BOTH hands (a book at J.aL.h / J.aR.h)',
  '};',
  "p = the shot's props + t (shot time): what the person carries / does in this shot (p.mug, p.sweat, p.bubble), always an object.",
  'In a scene (c-cam style only): const baker = ctx.kit.people.nightBaker;',
  "  baker.draw(g, cam.env, { x, y, s, view: 'three-quarter' | 'front' | 'profile' | 'back' | -3..3, pose: 'stand' | baker.pose('point', ph, over), ph, expr: 'shock', t: env.t, lean, bow, headYaw, headDy, talk, look, layer, props: { mug: 0 }, gag, beforeHand(J, ink), after(J, ink) }) -> joints",
  '  cam.env = the ink width of the camera (const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t))); env itself is zoom 1 (screen space).',
  '  baker.D (dimensions for poses / contacts), baker.character (the rig record), baker.pose(name, ph, over); baker itself is a valid `character` for env.ink.palmWorld / reachPalm / drawFigure.',
  'Look at it: reelforge people-preview <id> (6 views x stand/akimbo/walk + the 14 faces), then Read the sheet.',
  `Gags (micro-acting on any person, on twos): gag: { kind, t0 = 0 (s it starts), rate = 1 (cycle speed), hand = 'R', seed, visor (helmet) } or a list of up to ${String(MAX_GAGS)}. Rule: one signature gag per person (signatureGag), 1-2 gags per shot, never decorative: a gag is acting (boredom, nerves, impatience). A scene plays the person's signatureGag.kind on the narration beat that gives it a reason (the intent's ${C_CAM_GAG_TAG} hint). Kinds:`,
  ...GAG_KINDS.map((kind) => `  ${kind}: ${GAG_DOCS[kind]}`),
  ...COMMON,
];

const PLACES = [
  'Grim Ink places: each film hand-builds its own settings, one module per place: kit-ext/places/<id>.js, drawn in place px (origin top-left, y down; 1920x1080 = the frame at zoom 1).',
  'export const place = {',
  "  id: 'bakeryBackRoom', name: 'The bakery back room', bounds: [w, h],",
  '  light?: { x, y, rx, ry, color, alpha? },   // the one warm light: a stepped pool drawn after the place',
  '  anchors?: { name: [x, y], ... },           // feet marks, the door, the counter top',
  '  collide?: [[x, y, w, h], ...],             // solid boxes people must not stand in',
  '  draw(g, ink, t, opts) { ... },             // a pure function of t and opts (flicker on twos via ink.time)',
  '  foreground?(g, ink, t, opts) { ... },      // what stands in front of the people (a front desk row, a door edge, smoke)',
  '};',
  'Props of the period (PLAN.md#14.18): no bound book, paper cup or clock in antiquity; neutral writing surfaces: scroll, wax tablet, clay tablet, ledger sheet, slate.',
  "opts = the shot's place options (JSON-like, e.g. { alarm: true, k: 0.4 }); {} when none: give every option a default.",
  'In a scene (c-cam style only): const room = ctx.kit.places.bakeryBackRoom;',
  "  room.draw(g, cam.env, env.t, { light: true, ...opts }) right after the camera (cam.env = its ink width); then the people; then room.foreground(g, cam.env, env.t, opts) (no-op without one; room.hasForeground). room.anchor('oven') -> [x, y]; room.bounds, room.light, room.collide.",
  'Look at it: reelforge places-preview <id> (wide, x2 on the light, x3.2 on the first anchor), then Read the sheet.',
  ...COMMON,
];

/** The topic text, or undefined when `input` is not one of these topics. */
export function describeInkModulesTopic(input: string): string | undefined {
  if (input === PEOPLE_TOPIC) return PEOPLE.join('\n');
  if (input === PLACES_TOPIC) return PLACES.join('\n');
  return undefined;
}
