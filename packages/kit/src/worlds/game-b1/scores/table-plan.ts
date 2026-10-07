/**
 * The high-score table (`screen.scoreTable(spec)`, the showcase's shot 4, generalised): the
 * console in attract mode prints the story's facts as a score table. A toolkit, not a template:
 * the scene says what the table is FOR (`intent`, required), which facts are the rows (ranked by
 * the order of events, the score a real number or year of the story, never an invented figure),
 * which row is this shot's fact (`hero`: it slams in after a beat of silence), which rows are
 * still locked ('???', like the level map's lock), how the initials are entered and whether Dad's
 * grease pencil rings the score on the glass. Schema, layout and the checks zod cannot say
 * (fonts, widths, timing: the beat of silence, a hold of at most 4 s after the last beat).
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { joyWidth, missingGlyphs, scoreCells } from '../core/fonts.js';
import { missingHandGlyphs } from '../core/hand.js';
import { hash, sid } from '../core/math.js';
import { C } from '../palette.js';

export const PROMPTS = ['INSERT COIN', 'PRESS START', 'PLAYER 1', 'GAME OVER'] as const;

export const scoreTableSchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('What the table claims (e.g. "only the boom has happened; the crash is next")'),
  at: whenParam.describe('The attract screen starts drawing in'),
  until: whenParam.describe('The table is gone'),
  title: z.string().min(1).max(16).default('HIGH SCORES'),
  rows: z
    .array(
      z.strictObject({
        who: z
          .string()
          .min(1)
          .max(10)
          .optional()
          .describe('Who / what holds the rank (narration words); locked rows show ???'),
        score: z
          .union([z.int().min(0).max(9_999_999), z.string().min(1).max(8)])
          .optional()
          .describe('A real number or year from the story (never invented)'),
        locked: z.boolean().optional().describe('Not happened yet: ??? (default: rows after hero)'),
      }),
    )
    .min(2)
    .max(8)
    .describe('Ranked by the order of events'),
  hero: z.int().min(0).max(7).default(0).describe("The row that is this shot's fact"),
  print: whenParam.optional().describe('The first row prints (default: once drawn in)'),
  slam: z.strictObject({
    at: whenParam.describe("The hero's score slams in (after a beat of silence)"),
    shake: z.number().min(0).max(6).default(3),
  }),
  initials: z
    .enum(['arcade', 'typed', 'none'])
    .default('arcade')
    .describe('arcade = each letter scrolls into place at an irregular cadence'),
  prompt: z
    .union([
      z.literal(false),
      z.strictObject({ text: z.enum(PROMPTS).default('INSERT COIN'), at: whenParam }),
    ])
    .default(false)
    .describe('The machine prompt that blinks (burned into the phosphor)'),
  ring: z
    .strictObject({
      at: whenParam,
      note: z.string().min(1).max(8).optional().describe('A word beside it in the same hand'),
    })
    .optional()
    .describe('A grease pencil rings the hero score on the glass'),
  enter: z.enum(['draw-in', 'cut']).default('draw-in'),
});

export type ScoreTableInput = z.input<typeof scoreTableSchema>;
type Spec = z.output<typeof scoreTableSchema>;

export type RowKind = 'done' | 'hero' | 'locked';

export interface RowPlan {
  readonly rank: string;
  readonly who: string;
  readonly score: string;
  readonly kind: RowKind;
  /** Top of the row in picture px (the hero: top of its digits). */
  readonly y: number;
  /** One 2600 unit off the grid (an HMOVE nudge) on one row. */
  readonly dx: number;
  readonly at: number;
  readonly colour: number;
}

export interface TablePlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly title: string;
  readonly rows: readonly RowPlan[];
  readonly hero: RowPlan;
  readonly slam: { readonly at: number; readonly shake: number };
  readonly initials: Spec['initials'];
  readonly prompt: { readonly text: string; readonly at: number } | undefined;
  readonly ring: { readonly at: number; readonly note: string | undefined } | undefined;
  readonly drawIn: number | undefined;
  readonly cols: { readonly left: number; readonly who: number; readonly score: number };
  /** The hero score's box in picture px (x, y, w, h). */
  readonly box: readonly [number, number, number, number];
  readonly seed: number;
}

const CALL = 'kit.fx.b1Screen().scoreTable()';
const RANKS = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'] as const;
export const LEFT = 60;
export const PROMPT_Y = 266;
export const HERO_CELL = [10, 6] as const;
const TOP = 96;
const BOTTOM = 252;
const DRAW_IN = 0.55;

function fail(message: string): never {
  throw new KitError('invalid-params', `${CALL}: ${message}`);
}

function joyText(what: string, text: string): string {
  const upper = text.toUpperCase();
  const missing = missingGlyphs(upper, 'joy');
  if (missing.length > 0) fail(`${what} "${text}": the B1 font cannot draw ${missing.join(' ')}`);
  return upper;
}

function scoreText(row: Spec['rows'][number], i: number, hero: boolean): string {
  if (row.score === undefined) {
    if (hero) fail(`rows[${String(i)}] is the hero: give it its score (a number from the story)`);
    return '----';
  }
  const text = String(row.score);
  if (hero && !/^\d{1,7}$/.test(text))
    fail(`rows[${String(i)}].score "${text}": the hero score is 1-7 digits (Score Block)`);
  return joyText(`rows[${String(i)}].score`, text);
}

function kindOf(row: Spec['rows'][number], i: number, hero: number): RowKind {
  if (i === hero) {
    if (row.locked === true) fail(`rows[${String(i)}] is the hero and cannot be locked`);
    return 'hero';
  }
  return (row.locked ?? i > hero) ? 'locked' : 'done';
}

/** Print times: rows appear one by one at uneven gaps (0.3-0.45 s). */
function printTimes(n: number, first: number, seed: number): number[] {
  const out: number[] = [];
  let at = first;
  for (let i = 0; i < n; i += 1) {
    out.push(at);
    at += 0.3 + hash(seed, i, 1) * 0.15;
  }
  return out;
}

function layoutTops(n: number, hero: number, pitch: number): number[] {
  const out: number[] = [];
  let y = TOP;
  for (let i = 0; i < n; i += 1) {
    if (i === hero) {
      y += 6;
      out.push(Math.round(y));
      y += 30 + 28;
      continue;
    }
    out.push(Math.round(y));
    y += i % 2 === 1 ? Math.floor(pitch) : Math.ceil(pitch);
  }
  return out;
}

/**
 * Row tops: done rows, the hero (30 px digits), locked rows; pitch 23 / 24 px (uneven), squeezed
 * down to 15 px to fit above the prompt (or the bottom band without one).
 */
function rowTops(n: number, hero: number, bottom: number): number[] {
  for (let pitch = 23.5; pitch >= 15; pitch -= 0.5) {
    const out = layoutTops(n, hero, pitch);
    const last = (out[n - 1] ?? TOP) + (hero === n - 1 ? 30 : 12);
    if (last <= bottom) return out;
  }
  return fail(
    `${String(n)} rows do not fit one screen${bottom === BOTTOM ? ' with a prompt' : ''}: use fewer rows`,
  );
}

function rowColour(kind: RowKind, lockedIndex: number): number {
  if (kind === 'done') return C.TAN;
  if (kind === 'hero') return C.GREY;
  return lockedIndex === 0 ? C.GREY : C.GREY_D;
}

export function planScoreTable(spec: Spec, at: (when: number | string) => number): TablePlan {
  const start = at(spec.at);
  const until = at(spec.until);
  if (until <= start) fail('until must come after at');
  if (spec.hero >= spec.rows.length)
    fail(`hero ${String(spec.hero)}: there are only ${String(spec.rows.length)} rows`);
  const seed = Math.abs(sid(spec.intent)) % 100_000;
  const drawIn = spec.enter === 'draw-in' ? start + DRAW_IN : undefined;
  const first = spec.print === undefined ? (drawIn ?? start) + 0.25 : at(spec.print);
  const times = printTimes(spec.rows.length, first, seed);
  const tops = rowTops(spec.rows.length, spec.hero, spec.prompt === false ? 320 : BOTTOM);
  let locked = 0;
  const offGrid = spec.rows.length > 2 ? (spec.hero + 2) % spec.rows.length : -1;
  const rows = spec.rows.map((row, i): RowPlan => {
    const kind = kindOf(row, i, spec.hero);
    if (kind !== 'locked' && row.who === undefined)
      fail(`rows[${String(i)}]: give who (only a locked row may leave it out)`);
    const who = kind === 'locked' ? '???' : joyText(`rows[${String(i)}].who`, row.who ?? '');
    const colour = rowColour(kind, locked);
    if (kind === 'locked') locked += 1;
    return {
      rank: RANKS[i] ?? '',
      who,
      score: scoreText(row, i, kind === 'hero'),
      kind,
      y: tops[i] ?? TOP,
      dx: i === offGrid && kind !== 'hero' ? 4 : 0,
      at: times[i] ?? first,
      colour,
    };
  });
  const hero = rows[spec.hero];
  if (hero === undefined) fail('no hero row');
  const lastPrint = Math.max(...times);
  const slam = { at: at(spec.slam.at), shake: spec.slam.shake };
  if (slam.at - lastPrint < 0.4)
    fail(
      `slam.at ${slam.at.toFixed(2)}: leave a beat of silence (>= 0.4 s) after the last row prints (${lastPrint.toFixed(2)})`,
    );
  const otherWho = Math.max(
    ...rows.filter((r) => r.kind !== 'hero').map((r) => joyWidth(r.who, 2)),
  );
  const who = LEFT + 44;
  const score = who + Math.max(78, joyWidth(hero.who, 3) + 26, otherWho + 30);
  const heroW = scoreCells(hero.score, 0, 0, HERO_CELL[0], HERO_CELL[1], () => undefined);
  const widest = Math.max(
    score + heroW,
    ...rows.map((r) => score + r.dx + joyWidth(r.score, 2)),
    LEFT + joyWidth(joyText('title', spec.title), 2),
  );
  if (widest > 600) fail(`the table is ${String(widest)} px wide (max 600): shorten who or score`);
  const prompt =
    spec.prompt === false ? undefined : { text: spec.prompt.text, at: at(spec.prompt.at) };
  const ring =
    spec.ring === undefined
      ? undefined
      : { at: at(spec.ring.at), note: spec.ring.note?.toUpperCase() };
  if (ring?.note !== undefined) {
    const missing = missingHandGlyphs(ring.note);
    if (missing.length > 0)
      fail(`ring.note "${ring.note}": the hand cannot write ${missing.join(' ')}`);
  }
  const plan: TablePlan = {
    intent: spec.intent,
    at: start,
    until,
    title: spec.title.toUpperCase(),
    rows,
    hero,
    slam,
    initials: spec.initials,
    prompt,
    ring,
    drawIn,
    cols: { left: LEFT, who, score },
    box: [score, hero.y, heroW, 5 * HERO_CELL[1]],
    seed,
  };
  checkTiming(plan);
  return plan;
}

/** When the hero's initials are settled (the entry stops blinking). */
export function initialsDone(plan: TablePlan): number {
  if (plan.initials === 'none') return plan.slam.at;
  return plan.slam.at + 0.3 + plan.hero.who.length * 0.17 + 0.95;
}

function checkTiming(plan: TablePlan): void {
  const { at, until } = plan;
  const inside = (t: number, what: string) => {
    if (t < at || t >= until)
      fail(`${what} ${t.toFixed(2)} is outside the table (${at.toFixed(2)}-${until.toFixed(2)})`);
  };
  inside(plan.slam.at, 'slam.at');
  if (plan.prompt !== undefined) inside(plan.prompt.at, 'prompt.at');
  if (plan.ring !== undefined) inside(plan.ring.at, 'ring.at');
  const last = Math.max(
    initialsDone(plan),
    plan.ring === undefined ? 0 : plan.ring.at + 0.95,
    plan.prompt?.at ?? 0,
  );
  if (until - last > 4)
    fail(
      `the table holds ${(until - last).toFixed(1)} s after its last beat (max 4 s): end it sooner`,
    );
}
