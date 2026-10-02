/**
 * Reset time from a usage-limit message (PLAN.md#5.4). The live wording is UNKNOWN (ADR-001); the
 * CLI's user-facing texts look like `You've hit your usage limit · resets 5am (UTC)`. Supported:
 * - relative: `in 2 hours`, `in 1h 30m`, `try again in 45 minutes`
 * - clock: `resets 5am`, `resets at 5:30 PM (Europe/Warsaw)`, `resets 17:00 (UTC)`,
 *   `resets Oct 9, 5pm` — next occurrence after `now`, in the given zone or the local one.
 * Returns epoch ms, or undefined when nothing parseable is present (caller falls back to backoff).
 */

const UNIT_MS: Readonly<Record<string, number>> = { h: 3_600_000, m: 60_000, s: 1_000 };
const RELATIVE_PATTERN =
  /\bin\s+((?:\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b(?:\s*,?\s*(?:and\s+)?)?)+)/i;
const RELATIVE_PART = /(\d+(?:\.\d+)?)\s*(h|m|s)[a-z]*/gi;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CLOCK_PATTERN =
  /\bresets?\s+(?:at\s+|on\s+)?(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*\(([^)]+)\))?/i;
const DAY_MS = 86_400_000;

function relativeReset(text: string, nowMs: number): number | undefined {
  const match = RELATIVE_PATTERN.exec(text);
  if (match?.[1] === undefined) return undefined;
  let total = 0;
  for (const part of match[1].matchAll(RELATIVE_PART)) {
    const unit = UNIT_MS[(part[2] ?? '').toLowerCase()];
    if (unit !== undefined) total += Number(part[1]) * unit;
  }
  return total > 0 ? nowMs + total : undefined;
}

/** `UTC`/`GMT`/IANA names accepted by Intl; anything else -> undefined. */
export function normalizeTimeZone(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  const trimmed = name.trim();
  if (/^(utc|gmt|z)$/i.test(trimmed)) return 'UTC';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return undefined; // not a zone Intl knows: caller uses the default zone
  }
}

interface WallTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function wallTimeOf(epochMs: number, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(epochMs);
  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: field('year'),
    month: field('month'),
    day: field('day'),
    hour: field('hour'),
    minute: field('minute'),
  };
}

function offsetMs(epochMs: number, timeZone: string): number {
  const wall = wallTimeOf(epochMs, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return asUtc - Math.floor(epochMs / 60_000) * 60_000;
}

/** Epoch ms of a wall-clock time in `timeZone` (day overflow allowed, e.g. day 32). */
export function zonedTimeToEpoch(wall: WallTime, timeZone: string): number {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const first = guess - offsetMs(guess, timeZone);
  const second = guess - offsetMs(first, timeZone);
  return second;
}

function clockReset(text: string, nowMs: number, defaultZone: string): number | undefined {
  const match = CLOCK_PATTERN.exec(text);
  if (match === null) return undefined;
  const [, monthName, dayText, hourText, minuteText, meridiem, zoneText] = match;
  if (minuteText === undefined && meridiem === undefined) return undefined;
  let hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (meridiem !== undefined) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return undefined;
  const zone = normalizeTimeZone(zoneText) ?? defaultZone;
  const today = wallTimeOf(nowMs, zone);
  if (monthName !== undefined && dayText !== undefined) {
    const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
    const wall = { year: today.year, month, day: Number(dayText), hour, minute };
    const candidate = zonedTimeToEpoch(wall, zone);
    return candidate > nowMs - DAY_MS
      ? candidate
      : zonedTimeToEpoch({ ...wall, year: wall.year + 1 }, zone);
  }
  const candidate = zonedTimeToEpoch({ ...today, hour, minute }, zone);
  return candidate > nowMs
    ? candidate
    : zonedTimeToEpoch({ ...today, day: today.day + 1, hour, minute }, zone);
}

export function localTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function parseResetTime(
  text: string | undefined,
  nowMs: number,
  defaultTimeZone: string = localTimeZone(),
): number | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  return relativeReset(text, nowMs) ?? clockReset(text, nowMs, defaultTimeZone);
}
