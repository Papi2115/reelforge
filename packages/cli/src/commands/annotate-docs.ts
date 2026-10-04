/**
 * `reelforge kit-docs annotate`: reference of `ctx.annotate` for scene authors, generated from the
 * engine's option schemas (so it cannot drift), plus targets, a "when to use what" table and
 * examples (PLAN.md#11.8).
 */
import {
  ANNOTATION_ANIMATIONS,
  ANNOTATION_TYPE_NAMES,
  ANNOTATION_TYPES,
  TARGET_FORMS,
} from '@reelforge/engine';
import { z } from 'zod';
import { formatParam, paramDocs } from './schema-docs.js';

/** Options every annotation has; listed once instead of on every line. */
const COMMON = new Set([
  'id',
  'at',
  'until',
  'phrase',
  'nth',
  'enter',
  'exit',
  'enterDuration',
  'exitDuration',
  'color',
  'outline',
]);
const TARGET_OPTIONS = new Set(['target', 'from', 'to']);

function typeLine(type: (typeof ANNOTATION_TYPE_NAMES)[number]): string {
  const { schema, color, enter } = ANNOTATION_TYPES[type];
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const own = paramDocs(json)
    .filter((param) => !COMMON.has(param.name))
    .map((param) =>
      formatParam(TARGET_OPTIONS.has(param.name) ? { ...param, type: 'Target' } : param),
    );
  return `  ${type}({ ${own.join(', ')} })  [color = "${color}", enter = "${enter}"]`;
}

const WHEN = [
  'when to use what (meaning of the narration -> form; vary forms, max ~8 marks per minute):',
  '  a name (person, product, place name) -> pin on the object, or a small ctx.text.lowerThird',
  '  a number / amount / date -> kit.fx.counter or a big ctx.text.title; badge for "1, 2, 3" steps',
  '  a definition / "what is X" -> callout with a title (term) and the short definition',
  '  "this part" / "here" / a place being pointed at -> arrow or ring on it',
  '  a comparison / "these three" / a group -> bracket over the group (or two callouts)',
  '  a claim / a quote / a verdict -> stamp ("CONFIRMED", "FAKE") or underline the key word',
  '  a list -> numbered badges 1-9 on the items, revealed on their words',
  '  emphasis / "the only one" -> spotlight, ring or highlight on the words',
  '  size / distance -> dimension line with the value',
  '  a claim with a pinned source (plan kind source-chip, B-roll from research) -> sourceChip({ name }) in a free corner, the whole shot',
  'do: one or two marks at a time, labels short (1-3 words), time them with phrase: (the spoken word)',
  "don't: cover the main subject for long, stack labels, use the same form 3 times in a row",
].join('\n');

const EXAMPLES = [
  'examples (in update(t, s, ctx), every frame):',
  "  ctx.annotate.arrow({ target: { object: s.calc, anchor: 'keypad' }, phrase: 'the keypad', until: 4 })",
  "  ctx.annotate.ring({ target: { object: s.calc, anchor: 'screen' }, radius: 0.07, at: s.hit.t })",
  "  ctx.annotate.pin({ target: s.phone, text: 'NOKIA 3310', phrase: 'Nokia' })",
  "  ctx.annotate.callout({ title: 'LCD', text: 'Liquid crystal display', target: s.calc, at: 2, until: 6 })",
  "  ctx.annotate.bracket({ from: s.items[0], to: s.items[2], text: '3 SUSPECTS', at: 1 })",
  "  ctx.text.title('IT RUNS DOOM', { id: 'claim' }); ctx.annotate.underline({ target: { card: 'claim', words: [2, 2] }, style: 'scribble' })",
  "  ctx.annotate.stamp({ text: 'CONFIRMED', pos: [0.75, 0.7], phrase: 'confirmed' })",
  "  ctx.annotate.badge({ value: 2, target: { object: s.items[1], anchor: 'top' }, nudge: [0, -12] })",
  "  ctx.annotate.dimension({ from: s.calc, to: s.calc, text: '14 CM' })",
  '  ctx.annotate.spotlight({ target: s.calc, at: 3, until: 6 })',
  "  ctx.annotate.sourceChip({ name: 'nasa.gov', index: 1, at: 0.5 })",
].join('\n');

export function annotateDocs(): string {
  return [
    'ctx.annotate — pixel-art marks drawn with the text (same palette/dither); call in update() every frame like ctx.text',
    `  Target: ${TARGET_FORMS}`,
    '  targets are projected with the final camera of the frame, so marks follow camera and object moves; a whole object (no anchor) also gives its screen bounds (ring/spotlight/bracket fit them)',
    `  common options: id?, phrase?: "spoken phrase" (from words.json; sets at, QA checks ±150 ms), nth? = 1, at? (local s; default = when phrase is spoken, else 0), until?, enter?/exit?: ${ANNOTATION_ANIMATIONS.map((name) => `"${name}"`).join('|')}, enterDuration?, exitDuration? = 0.3, color?: palette token, outline?: token|false = "outline"`,
    '  sizes (radius, length, offset, depth, size, feather) are shares of the frame height; thickness, gap, padding, nudge are pixels; scale is the integer text scale (>= 2 on phones)',
    ...ANNOTATION_TYPE_NAMES.map(typeLine),
    '  each call returns { id, type }; QA (reelforge frames) reports labels overlapping cards or leaving the safe area, targets off screen or hidden, and marks missing their phrase',
    WHEN,
    EXAMPLES,
  ].join('\n');
}
