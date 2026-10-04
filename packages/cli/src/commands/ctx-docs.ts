/**
 * `reelforge kit-docs ctx|camera|text|annotate|...`: reference of the scene context (`ctx.camera`,
 * `ctx.text`, `ctx.annotate`, `ctx.anchor`, `ctx.ambient`, ...), next to the kit catalog. In the first real run (PLAN.md#10.4)
 * every scene author asked `kit-docs camera` / `kit-docs text` and then guessed option names;
 * text options are generated from the engine's own schemas so they cannot drift.
 */
import {
  EASINGS,
  kineticOptionsSchema,
  lowerThirdOptionsSchema,
  titleOptionsSchema,
} from '@reelforge/engine';
import { SFX_CATEGORY, SFX_RECIPES, SFX_USE, SFX_VARIANTS } from '@reelforge/pipeline';
import { z } from 'zod';
import { annotateDocs } from './annotate-docs.js';
import { paramDocs } from './schema-docs.js';

const TIMING =
  'from?: s = 0, to?: s = shot length, ease?: name = "easeInOutCubic", fov?: deg|[start, end]';

const CAMERA = [
  'ctx.camera — rigs return (t) => pose and apply it; create AND call them in update(): ctx.camera.orbit({...})(t)',
  `  common: ${TIMING}; vectors are [x, y, z]; angles in degrees (0 = camera on +Z)`,
  '  pushIn({ dist: [start, end], target?: [x,y,z] = [0,0,0], direction?: [x,y,z] = [0,0.25,1], ...common }) — end < start pushes in',
  '  orbit({ radius, degrees: [start, end], height? = 0, target?, ...common })',
  '  dolly({ start: [x,y,z], end: [x,y,z], target?, targetEnd?, ...common })',
  '  crane({ height: [start, end], dist, degrees? = 0, target?, targetHeight?: [start, end], ...common })',
  '  lookAt({ position: [x,y,z], target: [x,y,z], targetEnd?, ...common })',
  '  shake(rigOrPose, { amplitude, frequency? = 8, from?, to?, decay? }) — e.g. ctx.camera.shake(ctx.camera.orbit({...}), { amplitude: 0.05 })(t)',
  '  set({ position: [x,y,z], target?: [x,y,z], fov? }) — fixed pose',
  'cinematic moves — call in update() every frame AFTER setting the pose (rig/set); they modify that pose for the frame and return { progress }',
  '  t0/t1: local seconds or anchors (ctx.anchor(...) from build: t0 = hit.t, t1 = hit.tEnd); ease? = "easeInOutCubic"; hold start before t0, end after t1',
  '  subject/target: [x,y,z] or an object (kit prop: its bounding-box centre); default = the look-at target of the pose',
  '  rackFocus({ from, to, t0, t1, ease?, bokeh? = 3 }) — focus moves from→to (distance in units, [x,y,z] or object); the rest blurs into dithered bokeh (bokeh = blur px at 2x/0.5x the focus distance, 0..6); sky/neonGrid count as infinitely far',
  '  dollyZoom({ from, to, t0, t1, subject?, ease? }) — camera distance to the subject from→to along the view axis, fov compensates: the subject keeps its size, the background stretches (from < to: background closes in)',
  "  orbit({ degrees, t0, t1, axis? = 'y', radius?, target?, ease? }) — turns the pose around its target ('y' turntable, 'x' arc over the subject, or [x,y,z]); with { radius, degrees: [a, b] } it is the rig above",
  '  parallax({ amount, t0, t1, layers?, ease? }) — camera travels amount units to its right (negative = left); layers: [{ kit: "floatingCubes" | "env" | ..., ratio }, { objects: [a, b], ratio }, { near?, far?, ratio }] (ratio 0 = pinned to the frame, 1 = natural, 2 = foreground races past)',
  '  one rackFocus and one dollyZoom hold a frame (the latest started); orbits and parallaxes add up; order: orbit -> dollyZoom -> parallax',
].join('\n');

function optionLine(schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  return paramDocs(json)
    .map((param) => {
      const fallback =
        param.defaultValue === undefined ? '' : ` = ${JSON.stringify(param.defaultValue)}`;
      return `${param.name}?: ${param.type}${fallback}`;
    })
    .join(', ');
}

function textDocs(): string {
  return [
    'ctx.text — pixel-font cards; call in update() every frame (not in build); at/until are local seconds',
    '  pos: [x, y] is the normalized frame position ([0,0] top-left, [1,1] bottom-right); keep inside ctx.text.safeArea',
    '  colours are palette tokens (text, textDim, accent1..4, ...); the display font has capital letters only',
    `  title(text, { ${optionLine(titleOptionsSchema)} })`,
    `  lowerThird(primary, secondary | null, { ${optionLine(lowerThirdOptionsSchema)} })`,
    `  kinetic(words: string | [{ text, t? }], { ${optionLine(kineticOptionsSchema)} })`,
    '  measure(text, { font?, scale?, maxWidth? }) -> { w, h, lines } in low-res pixels',
  ].join('\n');
}

const ANCHOR = [
  'ctx.anchor(phrase, nth? = 1) -> { t, tEnd } in LOCAL shot seconds; the phrase must be spoken in this shot (timing/words.json)',
  '  resolve anchors in build() and return them in the state; check with: reelforge anchors --shot <storyboard shot id>',
].join('\n');

/** Generated from the pipeline's recipe table, so new sounds appear here automatically. */
function sfxDocs(): string {
  return [
    'ctx.sfx.at(t, name) — build() only; t in local seconds (usually an anchor time)',
    '  built-in names (category; variants, picked in cues.json by seed % count): use',
    ...SFX_RECIPES.map(
      (name) =>
        `  ${name} (${SFX_CATEGORY[name]}; ${SFX_VARIANTS[name].join('/')}): ${SFX_USE[name]}`,
    ),
  ].join('\n');
}

const RNG = [
  'ctx.rng — seeded; never Math.random. ctx.rng() -> [0,1), rng.range(min, max), rng.int(min, max), rng.pick(list), rng.fork(label)',
  '  in update() it restarts from a fixed seed on every call (stable per t)',
].join('\n');

function easeDocs(): string {
  return `ctx.ease.<name>(k) with k in 0..1, also usable as a rig "ease": ${Object.keys(EASINGS).join(', ')}`;
}

const SHOT = [
  'ctx.shot — { id, duration (s), width, height, fps } of this shot',
  'ctx.palette — colour tokens: sky, ground, groundAlt, hero, heroTrim, accent1..accent4, keyLight, fillLight, shadow, text, textDim, outline',
  'ctx.three — the Three.js namespace; ctx.scene — this shot’s THREE.Scene (add objects, background, fog)',
].join('\n');

const AMBIENT = [
  'ctx.ambient — read-only ambient variation of this shot (project.json "ambientVariation": true; off = nothing changes)',
  "  enabled: boolean — true when the project varies its environments and the shot's look has a variation budget",
  '  params — { tones, cell, horizon, fade, lightAzimuth, lightElevation, debris, layout, cameraDrift, ... } | undefined when off',
  '  tone(name) -> the palette swatch name used for `name` in this shot (a member of its family, or `name` itself when off)',
  '  kit environments apply it by themselves: never hard-code one background for every shot; a scene that paints its own',
  "  background follows the shot's tones: scene.background = new ctx.three.Color(ctx.palette[ctx.ambient.tone('navy')] ?? ctx.palette.sky)",
].join('\n');

const TOPICS: Readonly<Record<string, () => string>> = {
  camera: () => CAMERA,
  text: textDocs,
  annotate: annotateDocs,
  anchor: () => ANCHOR,
  sfx: sfxDocs,
  rng: () => RNG,
  ease: easeDocs,
  shot: () => SHOT,
  palette: () => SHOT,
  ambient: () => AMBIENT,
};

/** Names `kit-docs` resolves here (`ctx` = all of them). */
export const CTX_TOPICS: readonly string[] = ['ctx', ...Object.keys(TOPICS)];

/** All of ctx, one topic (`camera`, `ctx.camera`, `text.title`, ...), or undefined. */
export function describeCtxTopic(input: string): string | undefined {
  const name = input.replace(/^ctx\.?/, '');
  if (name === '') {
    const parts = [
      CAMERA,
      textDocs(),
      annotateDocs(),
      ANCHOR,
      sfxDocs(),
      RNG,
      easeDocs(),
      SHOT,
      AMBIENT,
    ];
    return [`ctx (scene context; scenes import nothing, everything comes from ctx)`, ...parts].join(
      '\n',
    );
  }
  const topic = TOPICS[name.split('.')[0] ?? ''];
  return topic?.();
}
