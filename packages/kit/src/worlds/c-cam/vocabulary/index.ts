/**
 * Grim Ink vocabulary (PLAN.md#14.20): the parameterized, period-neutral props, instruments, crowd,
 * acting and small effects ported from the C-CAM concept films (inventory:
 * docs/worlds/c-cam-VOCABULARY.md). Scenes reach them as `env.ink.<family>.<name>` (stage-ink.ts:
 * drawing entries take `(g, e, opts)` with `e` = `cam.env`), people / places modules as
 * `ink.<family>.<name>(opts)` (bound to the module's g and ink width, ink-tools.ts). Docs per family
 * come from the same registries (`VOCAB_DOCS`, kit-docs `ink-props` … `ink-fx`).
 */
import type { BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { ACTING, ACTING_ITEMS } from './acting.js';
import type { VocabDoc, VocabFamily } from './common.js';
import { CROWD, CROWD_ITEMS } from './crowd.js';
import { FX, FX_DRAWS, FX_DRAW_ITEMS, FX_RUNS, FX_RUN_ITEMS } from './fx.js';
import { INSTRUMENTS, INSTRUMENT_ITEMS } from './instruments.js';
import { PROPS, PROPS_ITEMS } from './props.js';

export {
  VOCAB_FAMILIES,
  vocabTopic,
  MATERIALS,
  TONES,
  type VocabFamily,
  type VocabDoc,
  type Drawn,
  type LabelSpot,
  type LightSpec,
} from './common.js';
export { BODY_KINDS, HEAD_KINDS, REACTIONS } from './crowd-body.js';
export { CROWD_PALETTES } from './crowd-palettes.js';
export type { ActingCue } from './acting-core.js';
export type { GagResult } from './acting-gags.js';

/** The scene-facing namespaces of `env.ink` (drawing entries take `(g, e, opts)`). */
export const VOCAB = Object.freeze({
  props: PROPS,
  instruments: INSTRUMENTS,
  crowd: CROWD,
  acting: ACTING,
  fx: FX,
});

const ITEMS: Readonly<Record<VocabFamily, Readonly<Record<string, VocabDoc>>>> = {
  props: PROPS_ITEMS,
  instruments: INSTRUMENT_ITEMS,
  crowd: CROWD_ITEMS,
  acting: ACTING_ITEMS,
  fx: { ...FX_DRAW_ITEMS, ...FX_RUN_ITEMS },
};

/** One entry's docs. */
export interface VocabEntryDoc extends VocabDoc {
  readonly name: string;
}

/** The docs of every entry of a family, in registry order. */
export function vocabDocs(family: VocabFamily): readonly VocabEntryDoc[] {
  return Object.entries(ITEMS[family]).map(([name, item]) => ({
    name,
    doc: item.doc,
    params: item.params,
    ...(item.returns === undefined ? {} : { returns: item.returns }),
  }));
}

/** Entry names per family (docs, lint allow-lists, tests). */
export const VOCAB_NAMES: Readonly<Record<VocabFamily, readonly string[]>> = Object.freeze({
  props: Object.keys(ITEMS.props),
  instruments: Object.keys(ITEMS.instruments),
  crowd: Object.keys(ITEMS.crowd),
  acting: Object.keys(ITEMS.acting),
  fx: Object.keys(ITEMS.fx),
});

type DrawFn = (g: Paint2D, e: BrushEnv, opts?: never) => unknown;

type BoundDraws<F> = {
  readonly [K in keyof F]: F[K] extends (g: Paint2D, e: BrushEnv, ...rest: infer A) => infer R
    ? (...rest: A) => R
    : never;
};

function bindDraws<F extends Readonly<Record<string, DrawFn>>>(
  g: Paint2D,
  env: BrushEnv,
  family: F,
): BoundDraws<F> {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(family)) {
    out[name] = (opts?: never): unknown => fn(g, env, opts);
  }
  return Object.freeze(out) as unknown as BoundDraws<F>;
}

/** The namespaces bound to a module's g and ink width: `ink.props.door({ … })`. */
export function bindVocabulary(g: Paint2D, env: BrushEnv) {
  return {
    props: bindDraws(g, env, PROPS),
    instruments: bindDraws(g, env, INSTRUMENTS),
    crowd: bindDraws(g, env, CROWD),
    acting: ACTING,
    fx: Object.freeze({ ...bindDraws(g, env, FX_DRAWS), ...FX_RUNS }),
  };
}
