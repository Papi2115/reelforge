/**
 * Typing schedule of the retro terminal (pure): input lines are typed after the prompt at `cps`
 * characters per second, output lines appear at once; each line starts after the previous one
 * (plus a pause) or at its own `at` (e.g. a spoken word's time), never before the previous line
 * has finished. `terminalRows(schedule, t)` gives what is on screen at t.
 */

export interface TerminalEntry {
  readonly text: string;
  /** Typed after the prompt (true) or printed output (false). */
  readonly input: boolean;
  /** Earliest local time it starts (typing or appearing). */
  readonly at?: number | undefined;
  readonly tone?: TerminalTone | undefined;
}

export const TERMINAL_TONES = ['normal', 'dim', 'alert', 'ok'] as const;
export type TerminalTone = (typeof TERMINAL_TONES)[number];

export interface TypingOptions {
  /** Local time of the first line. */
  readonly start: number;
  /** Typed characters per second. */
  readonly cps: number;
  /** Pause after a typed line (the "Enter"). */
  readonly pause: number;
  /** Gap between printed lines. */
  readonly outputGap: number;
}

export interface TimedLine extends TerminalEntry {
  readonly index: number;
  /** When the row appears (an input row shows its empty prompt from here). */
  readonly shownFrom: number;
  /** Typing starts / output appears. */
  readonly start: number;
  /** Fully typed. */
  readonly end: number;
}

export interface TerminalSchedule {
  readonly lines: readonly TimedLine[];
  /** When the idle prompt (after the last line) appears. */
  readonly idleFrom: number;
  readonly cps: number;
}

export function scheduleLines(
  entries: readonly TerminalEntry[],
  options: TypingOptions,
): TerminalSchedule {
  const lines: TimedLine[] = [];
  let clock = options.start;
  let previousEnd = options.start;
  entries.forEach((entry, index) => {
    const start = Math.max(entry.at ?? clock, index === 0 ? -Infinity : previousEnd);
    const length = Array.from(entry.text).length;
    const end = entry.input ? start + length / options.cps : start;
    const shownFrom = entry.input
      ? Math.min(start, index === 0 ? options.start : previousEnd)
      : start;
    lines.push({ ...entry, index, shownFrom, start, end });
    clock = end + (entry.input ? options.pause : options.outputGap);
    previousEnd = end;
  });
  return { lines, idleFrom: clock, cps: options.cps };
}

export interface TerminalRow {
  /** Entry index, or -1 for the idle prompt. */
  readonly index: number;
  readonly text: string;
  readonly input: boolean;
  readonly tone: TerminalTone;
}

export interface TerminalState {
  readonly rows: readonly TerminalRow[];
  /** Row index (into rows) and character column of the cursor; undefined = no prompt open. */
  readonly cursor: { readonly row: number; readonly column: number } | undefined;
  /** True while characters are being typed (the cursor does not blink then). */
  readonly typing: boolean;
}

/** Rows on screen at t (before scrolling and wrapping). */
export function terminalRows(schedule: TerminalSchedule, t: number): TerminalState {
  const rows: TerminalRow[] = [];
  let cursor: TerminalState['cursor'];
  let typing = false;
  for (const line of schedule.lines) {
    if (t < line.shownFrom) break;
    const tone = line.tone ?? 'normal';
    if (!line.input) {
      if (t >= line.start) rows.push({ index: line.index, text: line.text, input: false, tone });
      continue;
    }
    const chars = Array.from(line.text);
    const count = Math.max(
      0,
      Math.min(chars.length, Math.floor((t - line.start) * schedule.cps + 1e-9)),
    );
    rows.push({ index: line.index, text: chars.slice(0, count).join(''), input: true, tone });
    if (t < line.end + 1e-9 && count < chars.length) {
      cursor = { row: rows.length - 1, column: count };
      typing = t >= line.start;
    }
  }
  const last = schedule.lines.at(-1);
  const finished = last === undefined || t >= schedule.idleFrom;
  if (cursor === undefined && finished) {
    rows.push({ index: -1, text: '', input: true, tone: 'normal' });
    cursor = { row: rows.length - 1, column: 0 };
  }
  return { rows, cursor, typing };
}
