/**
 * The Grim Ink vocabulary (PLAN.md#14.20) as the kit-docs and prompts name it, in ONE place next
 * to `C_CAM_API` (c-cam-api.ts re-exports it): the `env.ink.<family>` namespaces of the scene
 * stage (`ink.<family>` inside people / places modules), their kit-docs topics and complete calls
 * that run through the real kit (packages/cli/src/commands/c-cam-vocab.test.ts). Values in the
 * snippets show the shape of a call on topics far from the showcase films, never a design.
 */

/** `env.ink.<family>` of the scene stage; `ink.<family>` in modules (bound, no g / e). */
export const C_CAM_VOCAB_API = {
  props: 'env.ink.props',
  instruments: 'env.ink.instruments',
  crowd: 'env.ink.crowd',
  acting: 'env.ink.acting',
  fx: 'env.ink.fx',
} as const;

export type CCamVocabFamily = keyof typeof C_CAM_VOCAB_API;

/**
 * `reelforge kit-docs <topic>` names of the vocabulary (kit-docs-c-cam-vocab.ts): one per family,
 * the props in two halves (`props`: places and furniture, `things`: hands, tables, gear, vehicles).
 */
export const C_CAM_VOCAB_TOPICS = {
  props: 'ink-props',
  things: 'ink-things',
  instruments: 'ink-instruments',
  crowd: 'ink-crowd',
  acting: 'ink-acting',
  fx: 'ink-fx',
} as const;

const P = C_CAM_VOCAB_API;

/** Complete calls (over `ctx`, `g`, `env`, `cam` and the shot's `s`), one or two per family. */
export const C_CAM_VOCAB_SNIPPETS = {
  /** A prop that lights the place: its pool goes behind the people (`pool: true` draws it first). */
  prop: `const lamp = ${P.props}.lamp(g, cam.env, { x: 1460, y: 900, kind: 'stand', level: 0.3, t: env.t, pool: true })`,
  /** A held thing ON a solved palm (palm = env.ink.palmWorld(…)). */
  held: `${P.props}.tool(g, cam.env, { x: palm[0], y: palm[1], kind: 'key', rot: 90, turn: env.time.seg(env.t, s.knock, s.knock + 0.5) })`,
  /** The climax extreme close-up on a control: its state is a number from t. */
  instrument: `const lever = ${P.instruments}.lever(g, cam.env, { x: 980, y: 760, pull: env.time.key(env.time.twos(env.t), [[0, 0], [s.knock, 1, 'out']]) })`,
  /** Background people reacting from a beat, back row first. */
  crowd: `${P.crowd}.rows(g, cam.env, { x0: -100, x1: 2020, y: 1000, rows: 3, reaction: 'gasp', t: env.t, t0: s.gone, palette: 'muted', seed: 41 })`,
  /** A two-body gag: both people's draw options and the thing in play, solved in world space. */
  acting: `const act = ${P.acting}.handOver({ a: { who: ctx.kit.people.broker, x: 900, y: 930, s: 0.9, view: 1 }, b: { who: ctx.kit.people.clerk, x: 1180, y: 930, s: 0.9, view: -1 }, t: env.t, t0: s.knock, weight: 0.6 })`,
  /** Draw each person with the gag's cue, then the thing where the gag says. */
  actingDraw: `ctx.kit.people.broker.draw(g, cam.env, { ...act.a, t: env.t }); ctx.kit.people.clerk.draw(g, cam.env, { ...act.b, t: env.t }); ${P.props}.container(g, cam.env, { x: act.item.x, y: act.item.y + 40, kind: 'sack', size: 0.5 })`,
  /** A small effect on the beat (nothing outside [t0, t0 + dur]). */
  fx: `${P.fx}.dust(g, cam.env, { x: 1180, y: 940, t: env.t, t0: s.gone })`,
} as const;

export type CCamVocabSnippet = keyof typeof C_CAM_VOCAB_SNIPPETS;
