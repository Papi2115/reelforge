/**
 * The speedrun split timer (`screen.splits(spec)`, a B1 breakthrough; PLAN.md#13.15 B1 rework): a
 * run of steps and how long each takes, as a speedrunner's splits. The steps wait greyed in a
 * column, the big timer spins up and lands EXACTLY on each step's real value on its beat, the step
 * prints its value and an optional delta (gold when faster, crimson when slower), the last split
 * flashes gold. A toolkit, never a template: `intent` (required) says what the run shows; every
 * value is a real number of the narration, in clock time (m:ss) or in its own unit (DAYS, WEEKS).
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASES, seg, sid } from '../core/math.js';
import type { TvPainter } from '../tv/painter.js';
import type { B1Sprite } from '../vocab/sprite.js';
import {
  BLINDS_S,
  capsText,
  checkHold,
  drawPanel,
  enterSchema,
  failer,
  intentSchema,
  printTimes,
  type Cue,
  type Fail,
} from './menu-kit.js';

const fail: Fail = failer('splits()');
const ROW_Y = 30;
const PITCH = 16;

export const splitsSchema = z.strictObject({
  intent: intentSchema('run'),
  at: whenParam,
  until: whenParam,
  title: z.string().min(1).max(14).default('SPLITS'),
  unit: z
    .union([z.literal('clock'), z.string().min(1).max(6)])
    .default('clock')
    .describe("'clock' = values are seconds shown as m:ss; otherwise the narration's unit (DAYS)"),
  splits: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(10).describe('The step, in the narration words'),
        value: z.number().min(0).max(359_999).describe('Its real value (cumulative)'),
        at: whenParam.describe('The timer lands on it (its spoken phrase)'),
        delta: z
          .number()
          .min(-99_999)
          .max(99_999)
          .optional()
          .describe('Faster (< 0) or slower than before'),
      }),
    )
    .min(2)
    .max(6),
  runner: z.string().min(1).optional().describe("The film's sprite id running along the bottom"),
  enter: enterSchema,
});

export type SplitsInput = z.input<typeof splitsSchema>;
type Spec = z.output<typeof splitsSchema>;

interface Split {
  readonly name: string;
  readonly value: number;
  readonly text: string;
  readonly at: number;
  readonly delta: string | undefined;
  readonly faster: boolean;
  readonly y: number;
}

export interface SplitsPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly title: string;
  readonly unit: string;
  readonly splits: readonly Split[];
  /** When the timer starts spinning toward the first split. */
  readonly start: number;
  readonly printAt: readonly number[];
  readonly runner: B1Sprite | undefined;
  readonly enter: 'blinds' | 'cut';
  readonly seed: number;
}

/** A value as the timer shows it: m:ss (or h:mm:ss) in clock mode, else the integer. */
export function formatValue(value: number, unit: string): string {
  const v = Math.max(0, Math.round(value));
  if (unit !== 'clock') return String(v);
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const s = String(v % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

export function planSplits(
  spec: Spec,
  at: (when: number | string) => number,
  sprite: (id: string) => B1Sprite,
): SplitsPlan {
  const start = at(spec.at);
  const until = at(spec.until);
  if (until <= start) fail('until must come after at');
  const seed = Math.abs(sid(spec.intent)) % 100_000;
  const unit = spec.unit === 'clock' ? 'clock' : capsText(fail, 'unit', spec.unit, 6);
  const first = start + (spec.enter === 'blinds' ? BLINDS_S : 0) + 0.1;
  const printAt = printTimes(spec.splits.length, first, 0.1, seed);
  const spin = (printAt[0] ?? first) + 0.1;
  let previous = { at: spin, value: -1 };
  const splits = spec.splits.map((split, i): Split => {
    const t = at(split.at);
    if (t < previous.at + 0.25)
      fail(
        `splits[${String(i)}].at ${t.toFixed(2)}: give the timer >= 0.25 s to spin up (from ${previous.at.toFixed(2)}; open the screen earlier or land this split later)`,
      );
    if (split.value < previous.value)
      fail(
        `splits[${String(i)}].value ${String(split.value)}: values are cumulative, never smaller than the one before`,
      );
    previous = { at: t, value: split.value };
    const delta = split.delta;
    return {
      name: capsText(fail, `splits[${String(i)}].name`, split.name, 10),
      value: split.value,
      text: formatValue(split.value, unit),
      at: t,
      delta:
        delta === undefined
          ? undefined
          : `${delta < 0 ? '-' : '+'}${formatValue(Math.abs(delta), unit)}`,
      faster: (delta ?? 0) < 0,
      y: ROW_Y + i * PITCH,
    };
  });
  checkHold(fail, until, previous.at + 0.6, 'the last split');
  return {
    intent: spec.intent,
    at: start,
    until,
    title: capsText(fail, 'title', spec.title, 14),
    unit,
    splits,
    start: spin,
    printAt,
    runner: spec.runner === undefined ? undefined : sprite(spec.runner),
    enter: spec.enter,
    seed,
  };
}

/** The running timer: eases from one split's value to the next, landing on each beat. */
export function timerAt(plan: SplitsPlan, t: number): number {
  let from = { at: plan.start, value: 0 };
  for (const split of plan.splits) {
    if (t < split.at) {
      const u = EASES.out(seg(t, from.at, split.at));
      return from.value + (split.value - from.value) * u;
    }
    from = { at: split.at, value: split.value };
  }
  return from.value;
}

function drawRows(g: TvPainter, plan: SplitsPlan, t: number): void {
  let current = plan.splits.findIndex((split) => t < split.at);
  if (current < 0) current = plan.splits.length;
  plan.splits.forEach((split, i) => {
    if (t < (plan.printAt[i] ?? plan.at)) return;
    if (i === current && t >= plan.start) g.rect(8, split.y - 2, 144, 11, 'tealDark');
    const done = t >= split.at;
    g.text(split.name, 12, split.y, { colour: done ? 'cream' : 'grey', size: 2 });
    if (!done) {
      g.text('-', 92, split.y, { colour: 'greyDark', size: 2 });
      return;
    }
    g.text(split.text, 92 - split.text.length * 3 + 12, split.y, { colour: 'cream', size: 2 });
    if (split.delta !== undefined && t >= split.at + 0.18)
      g.text(split.delta, 150 - split.delta.length * 3, split.y, {
        colour: split.faster ? 'gold' : 'crimson',
        size: 2,
      });
  });
}

function drawTimer(g: TvPainter, plan: SplitsPlan, t: number): void {
  const last = plan.splits.at(-1);
  const text = formatValue(timerAt(plan, t), plan.unit);
  const landed = last === undefined ? Number.POSITIVE_INFINITY : last.at;
  const done = t >= landed;
  const flash = done && t < landed + 0.5 && Math.floor((t - landed) * 8) % 2 === 0;
  const ink = done ? (flash ? 'white' : 'gold') : 'aqua';
  const digits = text.replace(/:/g, ' ');
  g.score(digits, 12, 128, { colour: ink, cell: [10, 8] });
  let x = 12;
  for (const ch of text) {
    if (ch === ':') {
      g.rect(x + 1, 131, 2, 3, ink);
      g.rect(x + 1, 138, 2, 3, ink);
    }
    x += ch === ' ' || ch === ':' ? 7.5 : 12.5;
  }
  if (plan.unit !== 'clock')
    g.text(plan.unit, 14 + digits.length * 12.5, 136, { colour: 'tan', size: 2 });
}

export function drawSplits(g: TvPainter, plan: SplitsPlan, t: number): void {
  drawPanel(g, plan.title, plan.at + 0.1, plan.seed);
  drawRows(g, plan, t);
  drawTimer(g, plan, t);
  const runner = plan.runner;
  if (runner === undefined) return;
  const last = plan.splits.at(-1)?.at ?? plan.until;
  const u = seg(Math.floor(t * 15) / 15, plan.start, last);
  const h = runner.height * runner.rowH;
  g.rect(8, 168, 144, 1, 'greyDark');
  g.draw(runner.id, Math.round(10 + u * (140 - runner.width * runner.size)), 168 - h, {
    flicker: false,
    ...(t >= last ? { frame: 0 } : {}),
  });
}

export function splitsCues(plan: SplitsPlan): Cue[] {
  const out: Cue[] = [{ t: plan.start, name: 'blip-up' }];
  plan.splits.forEach((split, i) => {
    out.push({ t: split.at, name: i === plan.splits.length - 1 ? 'success' : 'tick' });
  });
  return out.sort((a, b) => a.t - b.t);
}
