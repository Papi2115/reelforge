/**
 * The instruction-manual page (`screen.manual(spec)`, the showcase's shot 8, generalised): the
 * film's mechanism as the "HOW TO PLAY" page of a cheap two-colour game manual. A toolkit, not a
 * template: the scene says what the page claims (`intent`, required), the numbered rules (words
 * of the narration, <= 5), FIG. 1 drawn from the world's shapes (cartridges on a shelf, people in
 * a queue, a pile of boxes, houses in a row; one `hit` printed in colour), Dad's pencil ticks
 * that follow the narrator, one red correction (a word struck, his word written and circled) and
 * a pencil note in the margin; the page slides in over the frame and / or turns away. At most six
 * blocks (rules + the figure). Schema, layout and the checks zod cannot say.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { missingHandGlyphs } from '../core/hand.js';
import { hash, sid } from '../core/math.js';
import { LAYOUTS, SHAPES, type Layout, type Shape } from './figure.js';
import { missingPrintGlyphs, printWidth } from './print-font.js';

export const manualSchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('The mechanism the page claims (e.g. "a flood of copies kills a market")'),
  at: whenParam.describe('The page starts sliding in (or is there, enter: cut)'),
  until: whenParam.describe('The page is gone (turned away or cut)'),
  title: z.string().min(1).max(16).default('HOW TO PLAY'),
  steps: z
    .array(z.string().min(1).max(60))
    .min(1)
    .max(5)
    .describe("The numbered rules in narration words; '\\n' breaks a rule (<= 2 lines)"),
  figure: z.strictObject({
    caption: z.string().min(1).max(18).describe('Printed after "FIG. 1"'),
    shape: z.enum(SHAPES),
    layout: z.enum(LAYOUTS).default('shelf'),
    count: z.int().min(2).max(12).default(6),
    hit: z.int().min(0).max(11).optional().describe('The one item printed in colour'),
    callouts: z
      .array(z.strictObject({ item: z.int().min(0).max(11), step: z.int().min(1).max(5) }))
      .max(2)
      .default([])
      .describe('Numbered badges tying an item to a rule'),
  }),
  ticks: z
    .array(whenParam)
    .max(5)
    .default([])
    .describe("Dad's pencil ticks beside rules 1, 2, ... at these times (follow the narrator)"),
  correction: z
    .strictObject({
      step: z.int().min(1).max(5),
      strike: z.string().min(1).max(16).describe('Printed word(s) of that rule he strikes'),
      write: z.string().min(1).max(8).describe('His word above it, circled (narration word)'),
      at: whenParam,
    })
    .optional()
    .describe('The one red-pen correction: the point of the page'),
  note: z
    .strictObject({ text: z.string().min(1).max(12), at: whenParam })
    .optional()
    .describe('A pencil note in the left margin'),
  enter: z.enum(['slide', 'cut']).default('slide'),
  exit: z.enum(['turn', 'cut']).default('cut'),
});

export type ManualInput = z.input<typeof manualSchema>;
type Spec = z.output<typeof manualSchema>;

export interface StepPlan {
  readonly lines: readonly string[];
  /** Top of the first line (print space px). */
  readonly y: number;
}

export interface ManualPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly title: string;
  readonly steps: readonly StepPlan[];
  readonly figure: {
    readonly caption: string;
    readonly shape: Shape;
    readonly layout: Layout;
    readonly count: number;
    readonly hit: number | undefined;
    readonly callouts: readonly { item: number; step: number }[];
  };
  readonly ticks: readonly number[];
  readonly correction:
    | {
        readonly step: number;
        readonly strike: string;
        readonly write: string;
        /** Written above the struck word, or after the end of its line. */
        readonly place: 'above' | 'after';
        readonly at: number;
      }
    | undefined;
  readonly note: { readonly text: string; readonly at: number } | undefined;
  readonly enter: Spec['enter'];
  readonly exit: Spec['exit'];
  readonly seed: number;
}

const CALL = 'kit.fx.b1Screen().manual()';
export const SLIDE = 0.8;
export const TURN = 0.5;
export const STEP_X = 356;
export const LINE_PITCH = 17;
const FIRST_STEP_Y = 86;
const STEP_BOTTOM = 300;

function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

function printable(what: string, text: string): string {
  const upper = text.toUpperCase();
  const missing = missingPrintGlyphs(upper);
  if (missing.length > 0)
    fail(`${what} "${text}": the manual's type cannot set ${missing.join(' ')}`);
  return upper;
}

function handable(what: string, text: string): string {
  const upper = text.toUpperCase();
  const missing = missingHandGlyphs(upper);
  if (missing.length > 0) fail(`${what} "${text}": Dad's hand cannot write ${missing.join(' ')}`);
  return upper;
}

function layoutSteps(steps: readonly string[], seed: number): StepPlan[] {
  let y = FIRST_STEP_Y;
  return steps.map((step, i) => {
    const lines = printable(`steps[${String(i)}]`, step).split('\n');
    if (lines.length > 2) fail(`steps[${String(i)}]: ${String(lines.length)} lines, max 2`);
    for (const line of lines) {
      const w = printWidth(line, 2);
      if (w > 248)
        fail(
          `steps[${String(i)}] line "${line}" is ${String(w)} px wide (max 248): break it with \\n`,
        );
    }
    const plan = { lines, y };
    y += lines.length * LINE_PITCH + 7 + Math.floor(hash(seed, i, 11) * 5);
    if (y - 7 > STEP_BOTTOM) fail(`the rules do not fit the page: shorten them or use fewer`);
    return plan;
  });
}

/** `words` as whole words (not inside a longer word). */
function wordPattern(words: string): RegExp {
  return new RegExp(`(^|[^A-Z])${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z]|$)`);
}

/** The line of a rule holding `strike` as whole words (index into lines), or -1. */
export function strikeLine(step: StepPlan, strike: string): number {
  const pattern = wordPattern(strike);
  return step.lines.findIndex((line) => pattern.test(line));
}

/** The circle round the written correction: its radius from the word's length. */
export function correctionRadius(write: string): number {
  return Math.max(26, write.length * 11 + 1);
}

/** Index of `strike` as whole words in `line` (-1 when absent). */
export function strikeIndex(line: string, strike: string): number {
  const at = line.search(wordPattern(strike));
  return at < 0 ? -1 : at + (line[at] === strike[0] ? 0 : 1);
}

/**
 * Where Dad writes his word: above the struck word when the line above leaves room for it and its
 * circle, else after the end of the struck line when that fits the page; otherwise the rule must
 * be rewritten (a readable error).
 */
function correctionPlace(steps: readonly StepPlan[], index: number, strike: string, write: string) {
  const step = steps[index];
  const j = step === undefined ? -1 : strikeLine(step, strike);
  const line = step?.lines[j] ?? '';
  const i = strikeIndex(line, strike);
  const x0 = STEP_X + (i <= 0 ? 0 : printWidth(line.slice(0, i), 2) + 2);
  const above = j > 0 ? step?.lines[j - 1] : index > 0 ? steps[index - 1]?.lines.at(-1) : undefined;
  const blocked = j === 0 && index === 0 ? 606 : STEP_X + printWidth(above ?? '', 2);
  const r = correctionRadius(write);
  if (x0 - 9 + write.length * 8 - r >= blocked + 2) return 'above' as const;
  const end = STEP_X + printWidth(line, 2) + 12;
  if (end + write.length * 8 - 2 + r <= 632) return 'after' as const;
  return fail(
    `correction "${write}" has no room above or after "${strike}": move the word later in its line or shorten the line above`,
  );
}

export function planManual(spec: Spec, at: (when: number | string) => number): ManualPlan {
  const start = at(spec.at);
  const until = at(spec.until);
  const need = (spec.enter === 'slide' ? SLIDE : 0) + (spec.exit === 'turn' ? TURN : 0) + 1;
  if (until - start < need)
    fail(
      `the page needs >= ${need.toFixed(1)} s between at and until (got ${(until - start).toFixed(2)})`,
    );
  const seed = Math.abs(sid(spec.intent)) % 100_000;
  const title = printable('title', spec.title);
  if (printWidth(title, 3) > 280) fail(`title "${spec.title}" is too wide for the page`);
  const steps = layoutSteps(spec.steps, seed);
  const f = spec.figure;
  const caption = printable('figure.caption', f.caption);
  if (printWidth(`FIG. 1 ${caption}`, 2) > 240) fail(`figure.caption "${f.caption}" is too long`);
  if (f.hit !== undefined && f.hit >= f.count)
    fail(`figure.hit ${String(f.hit)}: the figure has ${String(f.count)} items`);
  for (const [i, c] of f.callouts.entries()) {
    if (c.item >= f.count)
      fail(`figure.callouts[${String(i)}].item: only ${String(f.count)} items`);
    if (c.step > steps.length)
      fail(`figure.callouts[${String(i)}].step: only ${String(steps.length)} rules`);
  }
  const maxCount = { shelf: 8, pile: 10, queue: 6 }[f.layout];
  if (f.count > maxCount)
    fail(`figure.count ${String(f.count)}: a ${f.layout} holds <= ${String(maxCount)}`);
  if (spec.ticks.length > steps.length)
    fail(`${String(spec.ticks.length)} ticks for ${String(steps.length)} rules`);
  const inside = (t: number, what: string): number => {
    if (t < start || t >= until)
      fail(`${what} ${t.toFixed(2)} is outside the page (${start.toFixed(2)}-${until.toFixed(2)})`);
    return t;
  };
  const ticks = spec.ticks.map((when, i) => inside(at(when), `ticks[${String(i)}]`));
  const c = spec.correction;
  let correction: ManualPlan['correction'];
  if (c !== undefined) {
    const step = steps[c.step - 1];
    if (step === undefined)
      fail(`correction.step ${String(c.step)}: only ${String(steps.length)} rules`);
    const strike = printable('correction.strike', c.strike);
    if (strikeLine(step, strike) < 0)
      fail(`correction.strike "${c.strike}" is not a word of rule ${String(c.step)}`);
    const write = handable('correction.write', c.write);
    const place = correctionPlace(steps, c.step - 1, strike, write);
    correction = { step: c.step, strike, write, place, at: inside(at(c.at), 'correction.at') };
  }
  const note =
    spec.note === undefined
      ? undefined
      : { text: handable('note.text', spec.note.text), at: inside(at(spec.note.at), 'note.at') };
  return {
    intent: spec.intent,
    at: start,
    until,
    title,
    steps,
    figure: {
      caption,
      shape: f.shape,
      layout: f.layout,
      count: f.count,
      hit: f.hit,
      callouts: f.callouts,
    },
    ticks,
    correction,
    note,
    enter: spec.enter,
    exit: spec.exit,
    seed,
  };
}
