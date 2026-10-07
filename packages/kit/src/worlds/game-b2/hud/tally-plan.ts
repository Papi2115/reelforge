/**
 * The intermission tally spec (`hud.tally(spec)`, PLAN.md#13.4, showcase shot 8): Doom's
 * end-of-level screen as a chapter recap. Named counters count up one after another on a seeded,
 * uneven cadence (a stall, a brake before it lands), formatted as the story says (4,000,000 /
 * 37% / ~5 WEEKS / 1:42), optional EST. tags, par / best lines under a rule, a pencil underline,
 * then a still beat and a rubber stamp. `intent` is required. The plan resolves every tick time
 * and value and rejects what reads badly (a hold over 4 s, text the face cannot draw, too wide).
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { textWidth, unsupportedChars } from '../core/font.js';
import { hash3, rng } from '../core/rand.js';

const caps = (max: number) =>
  z
    .string()
    .max(max)
    .transform((text) => text.toUpperCase());

export const TALLY_FORMATS = ['comma', 'plain', 'percent', 'unit', 'time'] as const;

export const tallyRowSchema = z.strictObject({
  label: caps(8).describe('MADE, SOLD, TIME, PAR (a word of the narration or the screen)'),
  value: z.number().min(0).max(999_999_999),
  format: z
    .enum(TALLY_FORMATS)
    .default('comma')
    .describe('comma 4,000,000 · plain 1983 · percent 37% · unit 5 WEEKS · time m:ss'),
  unit: z
    .tuple([caps(8), caps(8)])
    .optional()
    .describe("format 'unit': [one, many], e.g. ['WEEK', 'WEEKS']"),
  approx: z.boolean().default(false).describe('A ~ appears in front once it lands'),
  est: z.boolean().default(false).describe('EST. beside it: a commonly cited, unverified figure'),
  role: z
    .enum(['count', 'par', 'best'])
    .default('count')
    .describe('par / best = a reference line under a rule'),
  underline: z.boolean().default(false).describe('Pencil underline in two strokes after it lands'),
  at: whenParam.optional().describe('Start of its count (default: after the previous row)'),
  dur: z.number().min(0.2).max(3).optional().describe('Seconds it counts'),
  stall: z.boolean().optional().describe('One long stall mid-count (default: the first row)'),
  brake: z.boolean().optional().describe('Brakes before it lands (default: the second row)'),
});

export const tallySchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('The recap claim the numbers make (millions made, far fewer sold)'),
  at: whenParam,
  until: whenParam,
  title: caps(18).default('').describe('The chapter (CHRISTMAS 1982)'),
  sub: caps(18).default('').describe('Under it (FINISHED)'),
  rows: z.array(tallyRowSchema).min(1).max(6),
  stamp: z
    .strictObject({
      text: caps(10).describe('One word of the narration (UNSOLD): the accent, the focal point'),
      at: whenParam.optional().describe('Impact (default: a 0.7 s still beat after the last row)'),
    })
    .optional(),
  backdrop: z
    .enum(['freeze', 'live', 'dark'])
    .default('freeze')
    .describe('freeze = the view at `at` held behind the plate, live = the view keeps going'),
  enter: z.enum(['melt', 'cut']).default('melt').describe('melt = the view melts away (Doom)'),
  exit: z.enum(['dissolve', 'melt', 'cut']).default('dissolve'),
});

export type TallyInput = z.input<typeof tallySchema>;
export type TallySpec = z.output<typeof tallySchema>;
export type TallyRowSpec = z.output<typeof tallyRowSchema>;

export interface TallyRow {
  readonly label: string;
  readonly role: TallyRowSpec['role'];
  readonly est: boolean;
  readonly underline: boolean;
  /** Baseline y on the screen. */
  readonly y: number;
  /** Tick times and the value shown after each. */
  readonly times: readonly number[];
  readonly texts: readonly string[];
  /** What it shows before its first tick. */
  readonly zero: string;
  readonly final: string;
  readonly at: number;
  readonly landed: number;
  readonly jitter: number;
}

export interface TallyPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly title: string;
  readonly sub: string;
  readonly rows: readonly TallyRow[];
  readonly stamp?: { text: string; at: number };
  readonly backdrop: TallySpec['backdrop'];
  readonly enter: TallySpec['enter'];
  readonly exit: TallySpec['exit'];
  /** Plate rect. */
  readonly plate: readonly [number, number, number, number];
  readonly meltEnd: number;
  readonly outAt: number;
}

export const MELT_S = 0.6;
export const EXIT_S = { dissolve: 0.64, melt: 0.6, cut: 0 } as const;
/** Value column (right-aligned) and the EST. column. */
export const VALUE_X = 254;
export const EST_X = 264;

/** Tick times in [t0, t1]: jittered gaps, an optional stall, an optional brake on the last ticks. */
function ticks(seed: number, t0: number, t1: number, n: number, stall: boolean, brake: boolean) {
  const random = rng(seed);
  const stallAt = stall ? Math.floor(n * (0.45 + random() * 0.2)) : -1;
  const gaps: number[] = [];
  for (let k = 0; k < n; k += 1) {
    let gap = 0.55 + random() * 0.95;
    if (k === stallAt) gap += 3.4;
    if (brake && k > n - 4) gap *= 1 + (k - (n - 4)) * 0.85;
    gaps.push(gap);
  }
  const sum = gaps.reduce((a, b) => a + b, 0);
  let t = t0;
  return gaps.map((gap) => (t += (gap / sum) * (t1 - t0)));
}

/** Counter values: decelerating, never round until the last tick lands on the target. */
function values(seed: number, n: number, target: number): number[] {
  const out: number[] = [];
  let previous = 0;
  for (let k = 0; k < n; k += 1) {
    const p = 1 - (1 - (k + 1) / n) ** 1.7;
    const jittered = Math.round(target * p * (0.965 + hash3(seed, k, 3) * 0.03));
    out.push(k === n - 1 ? target : Math.min(target - 1, Math.max(previous + 1, jittered)));
    previous = out[k] ?? previous;
  }
  return out;
}

const commas = (v: number): string => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function format(row: TallyRowSpec, v: number, done: boolean): string {
  const approx = done && row.approx ? '~' : '';
  if (row.format === 'percent') return `${approx}${String(v)}%`;
  if (row.format === 'plain') return `${approx}${String(v)}`;
  if (row.format === 'time')
    return `${approx}${String(Math.floor(v / 60))}:${String(v % 60).padStart(2, '0')}`;
  if (row.format === 'unit') {
    const [one, many] = row.unit ?? ['', ''];
    return `${approx}${String(v)} ${v === 1 ? one : many}`;
  }
  return `${approx}${commas(v)}`;
}

/** Steps a counter takes: big numbers 12-17 ticks, small ones count every unit. */
function stepsOf(row: TallyRowSpec): number {
  const v = Math.round(row.value);
  if (v <= 0) return 1;
  if (row.format === 'time') return Math.min(9, v);
  if (v <= 14) return v;
  return 12 + Math.min(5, Math.floor(Math.log10(v)));
}

/** Width of a value with the tally's descending comma (6 px) at scale 2. */
export function valueWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === ',' ? 6 : textWidth(ch, 2) + 2;
  return w - 2;
}

export function planTally(
  spec: TallySpec,
  time: (when: number | string, what: string) => number,
  seed: number,
  fail: (message: string) => never,
): TallyPlan {
  const at = time(spec.at, 'tally.at');
  const until = time(spec.until, 'tally.until');
  const meltEnd = spec.enter === 'melt' ? at + MELT_S : at;
  const outAt = until - EXIT_S[spec.exit];
  const check = (text: string, where: string, max: number, scale: number): void => {
    const bad = unsupportedChars(text);
    if (bad.length > 0)
      fail(`tally.${where}: "${text}" has characters the face cannot draw: ${bad.join(' ')}`);
    if (textWidth(text, scale) > max) fail(`tally.${where}: "${text}" is too wide; shorten it`);
  };
  check(spec.title, 'title', 270, 3);
  check(spec.sub, 'sub', 270, 2);
  const top = spec.title === '' ? 50 : spec.sub === '' ? 86 : 108;
  let start = meltEnd + 0.15;
  let y = top;
  const rows = spec.rows.map((row, k): TallyRow => {
    check(row.label, `rows[${String(k)}].label`, 92, 2);
    if (row.format === 'unit' && row.unit === undefined)
      fail(`tally.rows[${String(k)}]: format 'unit' needs unit: [one, many]`);
    if (row.format === 'percent' && row.value > 100)
      fail(`tally.rows[${String(k)}]: a percent is 0-100`);
    const value = Math.round(row.value);
    const n = stepsOf(row);
    const big = value > 14;
    const dur = row.dur ?? (big ? 0.7 + hash3(seed, k, 1) * 0.25 : Math.min(0.75, 0.12 * n + 0.1));
    const begin = row.at === undefined ? start : time(row.at, `tally.rows[${String(k)}].at`);
    const counts = big
      ? values(seed + k, n, value)
      : Array.from({ length: n }, (_, i) => Math.round(((i + 1) / n) * value));
    const times = ticks(
      811 + seed + k * 12,
      begin + 0.1,
      begin + 0.1 + dur,
      n,
      row.stall ?? (k === 0 && big),
      row.brake ?? (k === 1 && big),
    );
    const texts = counts.map((v, i) => format(row, v, i === n - 1));
    const final = texts.at(-1) ?? '';
    if (valueWidth(final) > 190) fail(`tally.rows[${String(k)}]: "${final}" is too wide`);
    const landed = times.at(-1) ?? begin;
    if (row.role !== 'count' && (spec.rows[k - 1]?.role ?? 'count') === 'count' && k > 0) y += 8;
    const rowY = y + (k === 1 ? 1 : 0);
    y += 28;
    start = landed + 0.22 + 0.4 * hash3(seed, k, 7) + (row.role !== 'count' ? 0.1 : 0);
    const zero = format(row, 0, false);
    return {
      label: row.label,
      role: row.role,
      est: row.est,
      underline: row.underline,
      y: rowY,
      times,
      texts,
      zero,
      final,
      at: begin,
      landed,
      jitter: 71 + k,
    };
  });
  const lastLanded = Math.max(...rows.map((row) => row.landed));
  let stamp: TallyPlan['stamp'];
  if (spec.stamp !== undefined) {
    check(spec.stamp.text, 'stamp.text', 150, 4);
    const impact =
      spec.stamp.at === undefined ? lastLanded + 0.86 : time(spec.stamp.at, 'tally.stamp.at');
    stamp = { text: spec.stamp.text, at: impact };
  }
  const lastEvent = Math.max(lastLanded, stamp?.at ?? 0);
  if (lastEvent + 0.5 > outAt)
    fail(
      `tally: its numbers land at ${lastEvent.toFixed(2)} s but it leaves at ${outAt.toFixed(2)} s; give it more time (until) or fewer rows`,
    );
  if (outAt - lastEvent > 4)
    fail(
      `tally: it holds ${(outAt - lastEvent).toFixed(1)} s after its last number; hold at most 4 s (end it sooner)`,
    );
  const bottom = (rows.at(-1)?.y ?? top) + (stamp === undefined ? 36 : 62);
  const plate: [number, number, number, number] = [
    34,
    26,
    306,
    Math.max(170, Math.min(300, bottom - 26)),
  ];
  return {
    intent: spec.intent,
    at,
    until,
    title: spec.title,
    sub: spec.sub,
    rows,
    backdrop: spec.backdrop,
    enter: spec.enter,
    exit: spec.exit,
    plate,
    meltEnd,
    outAt,
    ...(stamp === undefined ? {} : { stamp }),
  };
}
