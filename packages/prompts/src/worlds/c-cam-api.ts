/**
 * The Grim Ink (c-cam) scene API as the prompts, the kit-docs topics and the anti-slop guards name
 * it (PLAN.md#14.10), in ONE place so a rename is one edit here.
 *
 * All of it is real (packages/kit/src/worlds/c-cam/stage.ts, stage-ink.ts, modules/):
 * `ctx.kit.fx.inkStage()`, `stage.paint(t, (g, env) => …)`, `env.C`, `env.time.*`,
 * `env.brush.{inkLine, brushStroke, blob, curve}` (zoom 1) and `env.ink.*` = the kit's C-CAM draw
 * functions (draw/, lettering/) with their own signatures (`(g, inkEnv, …)`; `inkEnv` = `cam.env`
 * after the camera, or `env` itself at zoom 1), `drawText(text, o)` drawing on the stage. The
 * project modules `kit-ext/people/<id>.js` / `kit-ext/places/<id>.js` (`export const person =
 * {…}` / `export const place = {…}`, camelCase ids = file names, `reelforge kit-docs people` /
 * `places`) are `ctx.kit.people.<id>` / `ctx.kit.places.<id>`, drawn with `cam.env` after the
 * camera. The snippets run through the real kit stage in
 * packages/cli/src/commands/c-cam-snippets.test.ts. Values in the snippets show the shape of a
 * call on topics far from the showcase films, never a design.
 */

/** Namespaces and file locations of the world's scene API. */
export const C_CAM_API = {
  /** The stage fx: built once in build(), repainted every frame. */
  stage: 'ctx.kit.fx.inkStage',
  /** The per-frame painter: `stage.paint(t, (g, env) => …)`. */
  paint: 'stage.paint',
  /** Brushes bound at zoom 1 (screen space). */
  brush: 'env.brush',
  /** Pure time helpers: twos, key, step, seg, ease, lerp, clamp01, hash, rnd, noise1. */
  time: 'env.time',
  /** The palette (`env.C.INK`, `env.C.LINEN`, `env.C.RUST_D`, …). */
  palette: 'env.C',
  /** The kit's draw functions with their own signatures (camera, scenery, grime, face, rig, letters). */
  ink: 'env.ink',
  /** The film's hand-built people, one project module each. */
  people: 'ctx.kit.people',
  /** The film's places (sets used by 2+ shots), one project module each. */
  places: 'ctx.kit.places',
  peopleDir: 'kit-ext/people',
  placesDir: 'kit-ext/places',
  /** The one export of a module file. */
  personExport: 'export const person = { … }',
  placeExport: 'export const place = { … }',
  peoplePreview: 'reelforge people-preview',
  placesPreview: 'reelforge places-preview',
} as const;

const INK = C_CAM_API.ink;
const BRUSH = C_CAM_API.brush;

/**
 * The world's lettering calls (`env.ink.drawText`, …): the on-screen string is the FIRST
 * argument (the text-provenance guard reads it, packages/stages/src/slop/c-cam-labels.ts).
 */
export const C_CAM_TEXT_METHODS = ['drawText', 'layoutText', 'wrapText'] as const;

/**
 * The storyboard's cast and place tags (the world has no `newRoles`: its people are hand-built
 * per film, PLAN.md#14.11 reads these from the intents).
 */
export const C_CAM_CAST_TAG = 'cast:';
export const C_CAM_PLACE_TAG = 'place:';

/** `reelforge kit-docs <topic>` names of the world (packages/cli/src/commands/kit-docs-c-cam.ts). */
export const C_CAM_TOPICS = {
  index: 'grim-ink',
  stage: 'ink-stage',
  brushes: 'ink-brushes',
  faces: 'ink-faces',
  rig: 'ink-rig',
  camera: 'ink-camera',
  lettering: 'ink-lettering',
} as const;

export type CCamTopic = (typeof C_CAM_TOPICS)[keyof typeof C_CAM_TOPICS];

/** The project-module topics of PLAN.md#14.8 (packages/cli/src/commands/kit-docs-c-cam-people.ts). */
export const C_CAM_MODULE_TOPICS = { people: 'people', places: 'places' } as const;

/** Complete calls the prompts quote (over `ctx`, `stage`, `g`, `env`, `cam` and the shot's `s`). */
export const C_CAM_SNIPPETS = {
  /** build(): one stage per shot. */
  stage: `const stage = ${C_CAM_API.stage}(); ctx.scene.add(stage)`,
  /** update(t): the painter, a pure function of env.t. */
  paint: `${C_CAM_API.paint}(t, (g, env) => paintShot(g, env, s, ctx))`,
  /** build(): beat times from the narration (local seconds). */
  anchors:
    "const s = { stage, knock: ctx.anchor('knocked twice').t, gone: ctx.anchor('already gone').t }",
  /** build(): the cut table, 2-5 framings on the beats; zoom 0.8-5.4, roll +-7 deg. */
  cuts: "s.cuts = [{ at: 0, name: 'wide', x: 960, y: 560, z: 1 }, { at: s.knock, name: 'door', x: 1420, y: 610, z: 3.4, rot: -4 }, { at: s.gone, name: 'face', x: 760, y: 430, z: 2.1, ease: 'out', to: { x: 780, y: 420, z: 2.4 }, end: s.gone + 1.2 }]",
  /** paint: the camera first (it resets the transform); `cam.env` scales the ink at that zoom. */
  camera: `const cam = ${INK}.applyCamera(g, ${INK}.resolveCut(s.cuts, env.t))`,
  /** paint: a place module of this film, wider than any framing, at the camera's ink width. */
  place: `${C_CAM_API.places}.pawnShop.draw(g, cam.env, env.t, { light: true })`,
  /** paint: a person's pose for this frame, acting on twos (a library pose for its own body). */
  pose: `const pose = ${C_CAM_API.people}.broker.pose('stand', 0, { lean: ${C_CAM_API.time}.key(${C_CAM_API.time}.twos(env.t), [[0, 0], [s.knock, 6, 'out']]) })`,
  /** paint: one hand-built person of this film (feet at x, y; s = scale; view yaw 1 = three-quarter). */
  person: `${C_CAM_API.people}.broker.draw(g, cam.env, { x: 1240, y: 930, s: 0.9, view: 'three-quarter', pose, expr: ${INK}.exprAt([[0, 'deadpan'], [s.knock, 'shock']], env.t), t: env.t })`,
  /** A palm in world space (place the held thing there), solved before the camera. */
  palm: `const palm = ${INK}.palmWorld({ character: ${C_CAM_API.people}.broker, placement: { x: 1240, y: 930, s: 0.9, yaw: 1 }, pose }, 'R')`,
  /** A hand target that puts the palm ON a world point (merge it into the pose as hR). */
  reach: `const hR = ${INK}.reachPalm({ character: ${C_CAM_API.people}.broker, placement: { x: 1240, y: 930, s: 0.9, yaw: 1 }, pose }, 'R', [1180, 560])`,
  /** A shape with a shade crescent, mottle and hatching, in world space. */
  blob: `${INK}.blob(g, cam.env, [1300, 600, 1460, 590, 1480, 700, 1310, 720], env.C.CLAY, { seed: 4, shade: [env.C.CLAY_D, 18, 14], mottle: [env.C.CLAY_D, 8, 10], hatch: { n: 5, len: 36, ang: -30 }, lw: 7 })`,
  /** An uneven ink line (width swells 0.4-1.9x; never a uniform stroke). */
  line: `${INK}.inkLine(g, cam.env, [300, 820, 900, 836, 1600, 818], { seed: 9, w: 6 })`,
  /** Grime: a stain that drips, a crack, the one warm light pool behind the people. */
  stain: `${INK}.stain(g, cam.env, 1420, 300, 90, 140, 31)`,
  crack: `${INK}.crack(g, cam.env, 300, 220, 120, 32)`,
  pool: `${INK}.pool(g, 900, 780, 520, 150, env.C.FIRE, 0.12)`,
  /** A foreground silhouette at the lens, in screen space, flat ink, no outline. */
  fg: `${INK}.fgScreen(g, () => ${INK}.silhouette(g, [0, 1080, 0, 660, 210, 600, 380, 1080]))`,
  /** Hand lettering in the place (a sign, a ledger line, a sound word): ink strokes, never a font. */
  hand: `${INK}.drawText('CLOSED', { face: 'hand', size: 54, x: 1310, y: 380, seed: 12, fill: env.C.INK, rot: -3 })`,
  /** A poster word that thuds in letter by letter on twos (bone fill, rust extrusion). */
  poster: `${INK}.drawText('NOBODY CAME', { face: 'poster', size: 150, x: 960, y: 520, seed: 7, align: 'center', fill: env.C.EYE, layers: ${INK}.posterLayers(150), charScale: ${INK}.thudScale(env.t, 0.3) })`,
  /** Screen-space shapes at zoom 1 (a poster's emblem, a title field). */
  screenBlob: `${BRUSH}.blob([700, 300, 1200, 280, 1240, 760, 680, 780], env.C.MUSTARD, { seed: 3, shade: [env.C.MUSTARD_D, 24, 18], lw: 14 })`,
} as const;

export type CCamSnippet = keyof typeof C_CAM_SNIPPETS;

/** A snippet as inline code in a prompt. */
export const cCamSnippet = (name: CCamSnippet): string => `\`${C_CAM_SNIPPETS[name]}\``;
