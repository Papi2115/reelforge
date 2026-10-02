import { describe, expect, it } from 'vitest';
import { normalizeTimeZone, parseResetTime, zonedTimeToEpoch } from './reset-time.js';

// 2026-10-02 03:00 UTC (= 05:00 in Europe/Warsaw, CEST +2).
const NOW = Date.UTC(2026, 9, 2, 3, 0);
const utc = (hour: number, minute = 0, day = 2, month = 10): number =>
  Date.UTC(2026, month - 1, day, hour, minute);

describe('parseResetTime', () => {
  it('reads the assumed CLI wording "resets 5am (UTC)"', () => {
    expect(parseResetTime("You've hit your usage limit · resets 5am (UTC)", NOW, 'UTC')).toBe(
      utc(5),
    );
  });

  it('rolls a time of day that already passed to the next day', () => {
    expect(parseResetTime('Limit reached · resets 2am (UTC)', NOW, 'UTC')).toBe(utc(2, 0, 3));
  });

  it('honours 12-hour edge cases, minutes and 24-hour clocks', () => {
    expect(parseResetTime('resets 12am (UTC)', NOW, 'UTC')).toBe(utc(0, 0, 3));
    expect(parseResetTime('resets 12pm (UTC)', NOW, 'UTC')).toBe(utc(12));
    expect(parseResetTime('resets at 5:30 PM (UTC)', NOW, 'UTC')).toBe(utc(17, 30));
    expect(parseResetTime('resets 17:45 (GMT)', NOW, 'UTC')).toBe(utc(17, 45));
  });

  it('uses an IANA zone from the message, else the default zone', () => {
    // 09:00 Warsaw (CEST, UTC+2) = 07:00 UTC.
    expect(parseResetTime('resets 9am (Europe/Warsaw)', NOW, 'UTC')).toBe(utc(7));
    expect(parseResetTime('resets 9am', NOW, 'Europe/Warsaw')).toBe(utc(7));
    // Unknown zone label -> default zone.
    expect(parseResetTime('resets 9am (Mars/Base)', NOW, 'UTC')).toBe(utc(9));
  });

  it('handles weekly resets with a date, rolling to next year when long past', () => {
    expect(parseResetTime('Weekly limit · resets Oct 9, 5pm (UTC)', NOW, 'UTC')).toBe(
      utc(17, 0, 9),
    );
    expect(parseResetTime('resets Jan 3 at 8am (UTC)', NOW, 'UTC')).toBe(
      Date.UTC(2027, 0, 3, 8, 0),
    );
  });

  it('reads relative durations', () => {
    expect(parseResetTime('Try again in 2 hours', NOW)).toBe(NOW + 2 * 3_600_000);
    expect(parseResetTime('resets in 1h 30m', NOW)).toBe(NOW + 90 * 60_000);
    expect(parseResetTime('in 45 minutes and 30 seconds', NOW)).toBe(NOW + 45 * 60_000 + 30_000);
  });

  it('returns undefined when there is nothing to parse', () => {
    expect(parseResetTime(undefined, NOW)).toBeUndefined();
    expect(parseResetTime('API Error: Rate limit reached', NOW)).toBeUndefined();
    expect(parseResetTime('resets 5 (UTC)', NOW, 'UTC')).toBeUndefined();
    expect(parseResetTime('resets 25:00', NOW, 'UTC')).toBeUndefined();
  });
});

describe('time zone helpers', () => {
  it('normalizes UTC aliases and rejects unknown zones', () => {
    expect(normalizeTimeZone('utc')).toBe('UTC');
    expect(normalizeTimeZone(' GMT ')).toBe('UTC');
    expect(normalizeTimeZone('Europe/Warsaw')).toBe('Europe/Warsaw');
    expect(normalizeTimeZone('nope/nope')).toBeUndefined();
  });

  it('converts wall time across a DST change (Warsaw, last Sunday of October)', () => {
    const wall = { year: 2026, month: 10, day: 26, hour: 9, minute: 0 };
    expect(zonedTimeToEpoch(wall, 'Europe/Warsaw')).toBe(Date.UTC(2026, 9, 26, 8, 0)); // CET +1
    expect(zonedTimeToEpoch({ ...wall, day: 24 }, 'Europe/Warsaw')).toBe(
      Date.UTC(2026, 9, 24, 7, 0),
    );
  });
});
