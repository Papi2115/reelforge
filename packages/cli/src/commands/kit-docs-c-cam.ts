/**
 * `reelforge kit-docs grim-ink | ink-stage | ink-brushes | ink-faces | ink-rig | ink-camera |
 * ink-lettering` (PLAN.md#14.10): the Grim Ink (c-cam) drawing API, one short topic
 * each, so a scene turn reads only what it uses (each text far under the 28,000-character Bash
 * limit). Names come from the one API list of the prompts (`C_CAM_API`, `C_CAM_TOPICS`) and the
 * kit's own word lists (`C_CAM_VOCABULARY`), so the docs cannot drift from either; every
 * `env.ink.<name>` they mention exists on the stage (`STAGE_INK_NAMES`, kit-docs-c-cam.test.ts).
 * How a person or place module is written is the module topics' (`kit-docs people` / `places`,
 * kit-docs-c-cam-people.ts).
 */
import { C_CAM_VOCABULARY } from '@reelforge/kit';
import {
  C_CAM_API,
  C_CAM_MODULE_TOPICS,
  C_CAM_SNIPPETS,
  C_CAM_TOPICS,
  type CCamTopic,
} from '@reelforge/prompts';

const V = C_CAM_VOCABULARY;
const INK = C_CAM_API.ink;
const list = (values: readonly string[]): string => values.join(', ');

const MODULES = `${C_CAM_MODULE_TOPICS.people}, ${C_CAM_MODULE_TOPICS.places}`;
const SEE = `topics: ${Object.values(C_CAM_TOPICS).join(', ')}; modules: ${MODULES} (reelforge kit-docs <topic>)`;

const INDEX = [
  'Grim Ink (world c-cam): hand-built caricature people in specific, grimy places; one uneven ink line over muddy flat full colour at 1920x1080; acting on twos; a TV-cartoon camera that cuts inside a shot. Looks: ink-scene (A), ink-insert (B), ink-poster (C).',
  'A scene (no imports; everything is repainted from scratch for every t):',
  `  build(ctx): ${C_CAM_SNIPPETS.stage}; ${C_CAM_SNIPPETS.anchors}; ${C_CAM_SNIPPETS.cuts}; return s`,
  `  update(t, s, ctx): ${C_CAM_SNIPPETS.paint}`,
  `  paintShot(g, env, s, ctx): camera first (${C_CAM_SNIPPETS.camera}), the place, the light pool, props, people back to front, foreground, screen-space silhouettes`,
  `${C_CAM_TOPICS.stage}: the stage, g (Paint2D) and env (size, t, palette, time helpers, zoom-1 brushes)`,
  `${C_CAM_TOPICS.brushes}: ink line, blobs, tubes, architecture, sky, light pools, grime (${INK}.*)`,
  `${C_CAM_TOPICS.faces}: the expression list and the face parts people modules draw with`,
  `${C_CAM_TOPICS.rig}: views, poses, hands, drawing a figure, contacts (palms on things)`,
  `${C_CAM_TOPICS.camera}: the cut table, framings, foreground silhouettes, coverage`,
  `${C_CAM_TOPICS.lettering}: hand and poster lettering in ink strokes (never ctx.text)`,
  `${MODULES}: the film's own people and places, one module each (${C_CAM_API.peopleDir}/<id>.js, ${C_CAM_API.placesDir}/<id>.js, camelCase ids); in a scene:`,
  `  ${C_CAM_SNIPPETS.person}`,
  `  ${C_CAM_SNIPPETS.place}`,
  `  ${C_CAM_SNIPPETS.foreground}`,
  `  look at them: ${C_CAM_API.peoplePreview} <id>, ${C_CAM_API.placesPreview} <id>`,
  "A person (built once per film, never a generator, never a showcase film's cast): one exaggeration axis (head:body 1:2.7-1:4.2), a torso drawn by hand for each view, 4 heads by view, tiny pupils, heavy lids, 4-6 grit marks, a costume that tells the job, one loud prop with a gag use and ONE signatureGag (its tic, played 1-2 times a shot on a beat with a reason, never as decoration); the people of a film clearly different in silhouette; background people simple (flat colour, dot eyes, no hatching).",
  'A place: drawn wider than every framing (about x -300 to 2300, y -300 to 1300), one warm light pool, a floor of its own material, grime, clutter that tells the place; animated parts read t on twos. A thing used in one shot only is drawn inline in that scene.',
];

const STAGE = [
  `${C_CAM_API.stage}({ size? }) — the full-frame ink canvas of a shot (default the frame, 1920x1080). Build it once in build(), ctx.scene.add(stage).`,
  `${C_CAM_API.paint}(t, (g, env) => …) — call it every frame in update(t): the stage clears to opaque ink and runs the painter, which must be a pure function of env.t (no state between frames, no Math.random, no Date).`,
  'g (Paint2D): fillStyle, strokeStyle, lineWidth, lineCap, globalAlpha, save/restore, setTransform/translate/rotate/scale, beginPath/closePath/moveTo/lineTo/quadraticCurveTo/rect/ellipse, fill(rule)/stroke/clip, fillRect. No text, images, gradients, filters or pixel reads.',
  'env (frozen, per frame):',
  '  width, height — canvas px; t — the time passed to paint; zoom, lw — 1 (env is the ink env of screen space)',
  `  ${C_CAM_API.palette} — the palette: ${list(V.palette)} (\`_D\` = the shade partner of a fill)`,
  `  ${C_CAM_API.time} — twos(t) (acting time on 1/12 s steps), key(t, [[t, v, ease?], …]), step(t, [[t, value], …]), seg(t, a, b), ease.{lin, inOut, out, back}, lerp, clamp01, hash(a, b, c, d), rnd(lo, hi, a, b, c, d), noise1(seed, x)`,
  `  ${C_CAM_API.brush} — inkLine(pts, o), brushStroke(pts, o), blob(pts, fill, o), curve(pts, closed, step), bound at zoom 1 (screen space: posters, titles)`,
  `  ${INK} — the world's draw functions with their own signatures, (g, inkEnv, …) where inkEnv = cam.env after the camera, env at zoom 1 (${C_CAM_TOPICS.brushes}, ${C_CAM_TOPICS.camera}, ${C_CAM_TOPICS.rig}, ${C_CAM_TOPICS.faces}, ${C_CAM_TOPICS.lettering})`,
  'Points are flat arrays [x, y, x, y, …] in px. ctx.camera does nothing on the stage; ctx.text and ctx.annotate are never used in this world.',
];

const BRUSHES = [
  `Brushes (${INK}.*; inkEnv = cam.env, or the env of a figure): every shape is drawn with these, never ctx.stroke outlines of one width.`,
  '  inkLine(g, e, pts, { seed, w = 7, taper = true, closed, color }) — the one line of the style: width swells and pinches 0.4-1.9x along the arc; silhouettes w 7-8, faces 5-7, details 3-4',
  '  brushStroke(g, e, pts, o) — a soft stroke through control points (wrinkles, folds, cracks)',
  '  blob(g, e, pts, fill, { seed, shade: [col, dx, dy], light: [col, dx, dy], patch: [col, dx, dy, k], mottle: [col, count, size], hatch: { n, k, len, gap, ang, bend, w, c }, lw = 7, sharp, inner(bb) }) — a filled shape: shade crescent, rim, mottling, hatching, ink outline; returns its outline',
  '  tube(g, e, pts, widths, fill, o) — limbs, sleeves, straps, pipes: a soft tube through joints',
  '  rough(g, e, pts, fill, { amp, ...blob }), rect(g, e, x, y, w, h, fill, o), beam(g, e, x0, y0, x1, y1, w, seed, …) — architecture with hand-wobbled edges',
  '  bands(g, x0, y0, x1, y1, cols, seed) — a sky or wall of 3-5 flat bands with wavy seams (never a gradient); stars(g, x0, y0, w, h, n, seed, col)',
  '  pool(g, cx, cy, rx, ry, col, alpha) — the one warm light of the place: 3 stepped ellipses, alpha 0.07-0.18, drawn BEHIND the people; gloom(g, x0, y0, w, h, cx, cy, r, col, alpha) — darkness with a stepped hole',
  '  bricks(g, e, x0, y0, w, h, { bh, bw, seed, density, tone, line, lw }) — courses over a filled wall',
  '  stain(g, e, x, y, w, h, seed, col), peel(g, e, x, y, w, h, seed), crack(g, e, x, y, len, seed, ang), puddle(g, e, x, y, w, seed, sky), cobbles(g, e, x0, y0, x1, y1, seed, col), windowPane(g, e, cx, cy, w, h, seed, lit), flies(g, x, y, t, seed) — grime as flat shapes',
  'Colour: every fill a muddy mid value with one _D shade; whites are dirty linen, darks are ink (never pure white or black); ONE accent object per shot (RED, GOLD or FIRE); rgba only for grime and hatching. A place: bands or a wall, the pool, architecture with shade/mottle/hatch, 2-5 stains, a peel, a crack, its own floor material, clutter that tells the place, drawn from about x -300 to 2300 and y -300 to 1300.',
  'Never: gradients, textures, paper, watercolour, noise, blur, filters, a uniform stroke.',
];

const FACES = [
  `Expressions (snap, never blend): ${list(V.expressions)}; default deadpan.`,
  `  ${INK}.exprAt([[0, 'deadpan'], [s.beat, 'shock']], env.t) — the expression at t from cues (snaps on twos); pass it as \`expr\` when drawing a person`,
  '  a shock = the snap + a head jolt (headDy -10 to -22 for 0.2 s); speech = a jaw flap (talk spans), blinks come by themselves',
  `Face parts (people modules draw heads with them; ${INK}.face(t, seed, expr, { talk, look }) gives the state f):`,
  '  eye(g, e, x, y, rx, ry, f, { seed, lw, bag, bags }) — a dirty-white egg, a tiny pupil, a heavy upper lid; one eye 5-10 % bigger; the far eye 0.6-0.72 wide in 3/4',
  '  brow(g, e, x, y, w, side, f, { arch, droop }) — one tapered stroke; mouth(g, e, x, y, w, f, { open, teeth: few|snag|gap|row|none, under }) — a crooked line or a dark hole with uneven yellow teeth',
  '  stubble(…), wart(…), pores(…) — skin marks; broken veins as flat rgba red blobs',
  'Rules: build order = back ear and hair mass, the lumpy head blob (13-18 points), stubble, hat, eyes and brows, cheek lines, the nose LAST, the mouth, marks; the jaw opening moves only the chin points of the one head outline; 4-6 grit marks per face; ugly-lovable and grim, never goofy (no snout noses, at most two strong exaggerations per face).',
];

const RIG = [
  `Views: ${list(V.views)} (a signed ring yaw from ${INK}.turn mirrors the drawing to face screen-left); turns walk the ring one view per animation frame, never a 180 deg flip.`,
  `Poses: ${INK}.pose(name, D, ph = 0, over) with name one of ${list(V.poses)}; ph in [0, 1) for the cyclic ones (feed twos time); over = { hL, hR, fL, fR, kL, kR, lean, bob } overrides (hand targets in body space: x = the character's left, y down, feet at 0, z forward).`,
  `Hands: ${list(V.hands)} (kL / kR in the pose); mittens 1.3-1.8x realistic.`,
  `Drawing: ${INK}.drawFigure(g, e, character (a person or its .character), { x, y, s, lean, bow }, pose, view, expr, t, { headYaw, headDy, layer: { L, R }, talk, look, beforeHand(J, e), after(J, e) }) — the feet at x, y (world), scale s (0.6-1.0 wide or medium, 1.25-4.2 for over-the-shoulder backs); returns the joints. The film's people modules wrap it (person.draw, kit-docs ${C_CAM_MODULE_TOPICS.people}).`,
  'Arm layers: far arms behind the body, raised hands behind the head, the near arm in front (layer 2 forces a hand in front: folded arms, writing).',
  `Contacts (world space, BEFORE the camera; fig = { character, placement: { x, y, s, yaw, bow }, pose }):`,
  `  ${INK}.palmWorld(fig, 'L' | 'R') — where the palm is: draw the held thing there`,
  `  ${INK}.reachPalm(fig, side, [x, y], keep?) — the hand target that puts the palm ON the point (merge it into the pose as hL / hR); reachPalmChecked(…) also gives the miss in px`,
  `  ${INK}.figToWorld(placement, flip, lean, pt), ${INK}.bowPt(pt, hy, deg) — a body point (a face in a bow) in world space`,
  `  ${INK}.solvePose(character, pose, view) — the joints; ${INK}.anchorWorld(fig, name) — a named body or face point (chin, mouth, …) in world space`,
  `  ${INK}.hand(g, e, x, y, ang, size, skin, kind) — a loose mitten (a prop's hand, a crowd)`,
  'Rules: hands ON props (solve the palm, draw the prop there, close the hand over it), never "near"; never a hand across a face; stage people within reach (arms 162-242 units); shoulders well below the open-jaw chin.',
];

const CAMERA = [
  `Cut table (build it in build(), times from ctx.anchor(...).t): [{ at, name?, x, y, z, rot?, ease?, to?, end? }, …], at strictly ascending; x, y = the world point at the frame centre; z = zoom ${String(V.zoom[0])}-${String(V.zoom[1])}; rot = Dutch roll in degrees, at most +-${String(V.maxRoll)}; a move runs from the framing to \`to\` over [at, end] with ease ${list(V.cutEases)} ('cut' = no move).`,
  `  e.g. ${C_CAM_SNIPPETS.cuts}`,
  `  ${C_CAM_SNIPPETS.camera} — the first thing the painter draws (it resets the transform); cam.env scales the ink at that zoom (pass it to every ink call, person.draw and place.draw); cam.toScreen(x, y), cam.toWorld(x, y), cam.visibleRect()`,
  '  cuts are selected on twos (a cut at `at` shows from the first 1/12 s step >= at); moves inside a framing run smoothly',
  `  ${INK}.fgScreen(g, draw) — screen space (foreground silhouettes at the lens); ${INK}.fgWorld(g, cam, draw) — back in world space; ${INK}.silhouette(g, pts, fill?) — a flat ink shape, no outline`,
  `  ${INK}.coverage(cuts, { x0, y0, x1, y1 }) — framings whose frame leaves the drawn place (must be empty)`,
  'Framings: wide 0.8-1.2 (the place, a group); medium / two-shot 1.3-1.6; close-up 1.7-2.6 (the reaction, off-centre); extreme close-up / insert 2.4-5.4 (the gag object); push-in = z up 5-40 % inside a framing; pull-back = z down (a reveal); low angle = the figure scaled up, feet below the frame; over-the-shoulder = a person drawn huge from the back (view back, s 1.25-4.2) in the foreground; reverse = the next framing restages the place from the other side; shake = +-8 px on twos for 0.2 s on an impact.',
  "Rhythm: 2-5 framings per shot, cut on the narration's beats (a framing 0.4-2.4 s, an extreme close-up 0.4-1.5 s); one focal point off-centre per framing; a Dutch tilt (2-7 deg, either sign) only on tense beats, calm framings and titles level; one foreground silhouette per framing, only where it adds depth, never over the focal point; solve contacts first and frame them, never move a contact to suit the frame.",
];

const LETTERING = [
  `Ink lettering (CC0 strokes drawn with the ink line; never ctx.text, never a font). Faces: ${list(V.letterFaces)} (hand = loose handwriting for signs, ledgers, tags, sound words; poster = fat capitals for titles and the line of the film).`,
  `  ${INK}.drawText(text, { face, size, x, y, seed, fill, track?, rot?, align?: 'left' | 'center' | 'right', wobble?, width?, layers?, charScale? }) — the string comes first; returns its layout`,
  `  e.g. ${C_CAM_SNIPPETS.hand}`,
  `  ${INK}.posterLayers(size) — outline, rust extrusion and bone fill of a poster word; ${INK}.thudScale(t, t0) — letters thud in one by one on twos from t0 (0.04 s apart)`,
  `  e.g. ${C_CAM_SNIPPETS.poster}`,
  `  ${INK}.layoutText(text, options), ${INK}.wrapText(text, maxWidth, size, face) — layout only (measure, wrap lines)`,
  'Rules: every word comes from the narration or the research notes (real names, numbers, dates; a sound word on its beat); letter it ON the thing it names (a sign, a tag, a ledger line, a gauge); at most 6 words on a poster; no captions in films.',
];

const TOPICS: Readonly<Record<CCamTopic, readonly string[]>> = {
  [C_CAM_TOPICS.index]: INDEX,
  [C_CAM_TOPICS.stage]: STAGE,
  [C_CAM_TOPICS.brushes]: BRUSHES,
  [C_CAM_TOPICS.faces]: FACES,
  [C_CAM_TOPICS.rig]: RIG,
  [C_CAM_TOPICS.camera]: CAMERA,
  [C_CAM_TOPICS.lettering]: LETTERING,
};

/** Every Grim Ink topic name. */
export const C_CAM_TOPIC_NAMES: readonly string[] = Object.values(C_CAM_TOPICS);

const isCCamTopic = (name: string): name is CCamTopic => C_CAM_TOPIC_NAMES.includes(name);

/** The text of a Grim Ink topic, or undefined for any other name. */
export function describeCCamTopic(name: string): string | undefined {
  if (!isCCamTopic(name)) return undefined;
  const title = name === C_CAM_TOPICS.index ? 'grim-ink (world c-cam)' : `${name} (world Grim Ink)`;
  return [title, ...TOPICS[name], SEE].join('\n');
}
