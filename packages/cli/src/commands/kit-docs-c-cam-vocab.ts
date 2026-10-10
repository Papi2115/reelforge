/**
 * `reelforge kit-docs ink-props | ink-things | ink-instruments | ink-crowd | ink-acting | ink-fx`
 * (PLAN.md#14.20): the Grim Ink vocabulary — parameterized, period-neutral props, instruments,
 * crowds, two-body acting gags and small effects ported from the concept films — one short topic
 * per family (the props in two halves), each under 6 KB. Entry names, docs and options come from
 * the kit's own registries (`vocabDocs`), the namespaces and calls from the prompts' one list
 * (`C_CAM_VOCAB_API`, `C_CAM_VOCAB_SNIPPETS`), so neither can drift.
 */
import { vocabDocs, type VocabEntryDoc, type VocabFamily } from '@reelforge/kit';
import {
  C_CAM_API,
  C_CAM_TOPICS,
  C_CAM_VOCAB_API,
  C_CAM_VOCAB_SNIPPETS,
  C_CAM_VOCAB_TOPICS,
} from '@reelforge/prompts';

/** The props split in two topics: places and furniture / things in hands and on tables. */
const THINGS_TOPIC = C_CAM_VOCAB_TOPICS.things;
const PLACE_PROPS = [
  'door',
  'windowFrame',
  'arch',
  'column',
  'ladder',
  'board',
  'panel',
  'bell',
  'table',
  'seat',
  'lamp',
  'banner',
];

export const C_CAM_VOCAB_TOPIC_NAMES: readonly string[] = Object.values(C_CAM_VOCAB_TOPICS);

const PROP_RULES = [
  `One options object per call, (g, e, opts) with e = cam.env (in a people / places module: ink.props.<name>(opts)). x, y = the anchor: the floor centre of a standing thing, the grip of a held one. Returns { box, points, label?, light? }: put palms ON points (env.ink.reachPalm onto points.grip / handle / top), put things ON points.top, letter real words at label (the prop never letters): ${C_CAM_API.ink}.drawText(word, { ...res.label, face: 'hand', seed, fill }) (a centred baseline spot; shrink size when the word is wider than label.fit), draw light with ${C_CAM_API.ink}.pool BEHIND the people.`,
  'tone = a material (wood, paleWood, iron, steel, brass, straw, paper, cloth, leather, stone, clay, glass, paint) or a palette token with a _D shade (RUST, OLIVE, GREYBLUE…); wear 0-1 = grime, chips, stains; seed varies the wobble. Kinds are period-neutral: pick the one of your period and place, vary between films. A prop is there because the narration needs it (one accent prop per shot), never as decoration.',
];

const INTRO: Readonly<Record<VocabFamily, readonly string[]>> = {
  props: PROP_RULES,
  instruments: [
    `Controls and readouts, (g, e, opts): their state (pull, turn, press, value, flip, tick) is a number you compute from t (env.time.key(env.time.twos(env.t), [[0, 0], [s.beat, 1, 'out']]), env.time.seg). The climax extreme close-up: frame the control at z 2.4-5.4, put the hand ON points.grip / target / top with reachPalm, fire an fx on the beat. Words (keys, gauges, lights) are drawText(word, { ...res.label, face, seed, fill }) at the returned label / labels spots, from the narration or research.`,
  ],
  crowd: [
    `Background people are simple on purpose (flat colour, dot eyes, no hatching) so the film's people read in front. (g, e, opts); draw rows back to front behind the main people; reactions start at t0 and ripple out by stagger, acted on twos; one crowd reaction per beat. Foreground pieces go inside ${C_CAM_API.ink}.fgScreen(g, () => …) (screen space) and never over the focal point.`,
  ],
  acting: [
    `Two-body gags draw nothing: ({ a, b, t, t0, dur, … }) with a, b = { who: ${C_CAM_API.people}.<id>, x, y, s, view, pose?, bow?, lean? } = the placement you draw them with. Spread res.a / res.b into person.draw(g, cam.env, { …res.a, t: env.t }) (add expr / gag yourself; res.a.expr only when the gag sets one), draw the thing at res.item / res.gripA (rotA), feed res.impact to fx.impact. Stage the two within reach (feet 0.8-1.6 arm lengths apart for hands that meet): unreachable hands are clamped. One physical gag per shot, on a narration beat, with a reason.`,
  ],
  fx: [
    'Small flat effects for a beat, (g, e, opts) with t and t0: nothing outside [t0, t0 + dur], moving on twos; never a texture, a gradient or a glow. fx.shake returns an offset to add to a cut framing or a thing.',
  ],
};

const CALLS: Readonly<Record<string, readonly string[]>> = {
  [C_CAM_VOCAB_TOPICS.props]: [C_CAM_VOCAB_SNIPPETS.prop],
  [THINGS_TOPIC]: [C_CAM_VOCAB_SNIPPETS.held],
  [C_CAM_VOCAB_TOPICS.instruments]: [C_CAM_VOCAB_SNIPPETS.instrument],
  [C_CAM_VOCAB_TOPICS.crowd]: [C_CAM_VOCAB_SNIPPETS.crowd],
  [C_CAM_VOCAB_TOPICS.acting]: [C_CAM_VOCAB_SNIPPETS.acting, C_CAM_VOCAB_SNIPPETS.actingDraw],
  [C_CAM_VOCAB_TOPICS.fx]: [C_CAM_VOCAB_SNIPPETS.fx],
};

const PURE: ReadonlySet<string> = new Set(['acting', 'fx.shake']);

function entryLines(family: VocabFamily, entry: VocabEntryDoc): string[] {
  const pure = PURE.has(family) || PURE.has(`${family}.${entry.name}`);
  const call = `${C_CAM_VOCAB_API[family]}.${entry.name}(${pure ? '' : 'g, e, '}{ … })`;
  return [
    `${call} — ${entry.doc}`,
    `    ${entry.params}`,
    ...(entry.returns === undefined ? [] : [`    returns ${entry.returns}`]),
  ];
}

const FAMILY_OF_TOPIC: ReadonlyMap<string, VocabFamily> = new Map([
  [C_CAM_VOCAB_TOPICS.props, 'props'],
  [C_CAM_VOCAB_TOPICS.things, 'props'],
  [C_CAM_VOCAB_TOPICS.instruments, 'instruments'],
  [C_CAM_VOCAB_TOPICS.crowd, 'crowd'],
  [C_CAM_VOCAB_TOPICS.acting, 'acting'],
  [C_CAM_VOCAB_TOPICS.fx, 'fx'],
]);

const SEE = `vocabulary topics: ${C_CAM_VOCAB_TOPIC_NAMES.join(', ')}; the drawing API: ${C_CAM_TOPICS.index} (reelforge kit-docs <topic>)`;

/** The text of a vocabulary topic, or undefined for any other name. */
export function describeInkVocabTopic(name: string): string | undefined {
  const family = FAMILY_OF_TOPIC.get(name);
  if (family === undefined) return undefined;
  const entries = vocabDocs(family).filter((entry) =>
    family !== 'props' ? true : PLACE_PROPS.includes(entry.name) === (name !== THINGS_TOPIC),
  );
  const what =
    name === THINGS_TOPIC
      ? 'props, part 2: things in hands, on tables, gear, vehicles'
      : family === 'props'
        ? 'props, part 1: building pieces, furniture, light, cloth'
        : family;
  return [
    `${name} (world Grim Ink): ${what}`,
    ...INTRO[family],
    'e.g.',
    ...(CALLS[name] ?? []).map((call) => `  ${call}`),
    ...entries.flatMap((entry) => entryLines(family, entry)),
    SEE,
  ].join('\n');
}
