/**
 * `reelforge kit-docs ctx|camera|text|annotate|...`: reference of the scene context (`ctx.camera`,
 * `ctx.text`, `ctx.annotate`, `ctx.anchor`, ...), next to the kit catalog. In the first real run (PLAN.md#10.4)
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
};

/** Names `kit-docs` resolves here (`ctx` = all of them). */
export const CTX_TOPICS: readonly string[] = ['ctx', ...Object.keys(TOPICS)];

/** All of ctx, one topic (`camera`, `ctx.camera`, `text.title`, ...), or undefined. */
export function describeCtxTopic(input: string): string | undefined {
  const name = input.replace(/^ctx\.?/, '');
  if (name === '') {
    const parts = [CAMERA, textDocs(), annotateDocs(), ANCHOR, sfxDocs(), RNG, easeDocs(), SHOT];
    return [`ctx (scene context; scenes import nothing, everything comes from ctx)`, ...parts].join(
      '\n',
    );
  }
  const topic = TOPICS[name.split('.')[0] ?? ''];
  return topic?.();
}
