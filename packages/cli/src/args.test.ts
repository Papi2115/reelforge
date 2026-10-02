import { describe, expect, it } from 'vitest';
import {
  COMMON_OPTIONS,
  parseCommandArgs,
  parseInteger,
  parsePositiveSeconds,
  parseTimes,
} from './args.js';
import { UsageError } from './errors.js';

describe('parseTimes', () => {
  it('parses comma-separated seconds, ignoring blanks and spaces', () => {
    expect(parseTimes('0, 2.5,,5')).toEqual([0, 2.5, 5]);
  });

  it('rejects negative, non-numeric and empty lists with the option name', () => {
    expect(() => parseTimes('1,-2')).toThrow(/--at: "-2" is not a time in seconds/);
    expect(() => parseTimes('abc', '--step')).toThrow(/--step: "abc"/);
    expect(() => parseTimes(' , ')).toThrow(UsageError);
  });
});

describe('number options', () => {
  it('checks integer ranges and positive seconds', () => {
    expect(parseInteger('3', '--per-shot', 1, 8)).toBe(3);
    expect(() => parseInteger('9', '--per-shot', 1, 8)).toThrow(
      /--per-shot: "9" must be a whole number from 1 to 8/,
    );
    expect(() => parseInteger('1.5', '--nth', 1, 9)).toThrow(UsageError);
    expect(parsePositiveSeconds('0.5', '--step')).toBe(0.5);
    expect(() => parsePositiveSeconds('0', '--step')).toThrow(/must be a number of seconds > 0/);
  });
});

describe('parseCommandArgs', () => {
  it('turns unknown options and stray positionals into usage errors', () => {
    expect(() => parseCommandArgs(['--nope'], COMMON_OPTIONS, false)).toThrow(UsageError);
    expect(() => parseCommandArgs(['extra'], COMMON_OPTIONS, false)).toThrow(UsageError);
  });

  it('drops the `--` separator pnpm forwards', () => {
    const { values, positionals } = parseCommandArgs(
      ['--', '--json', 'a.js'],
      COMMON_OPTIONS,
      true,
    );
    expect(values.json).toBe(true);
    expect(positionals).toEqual(['a.js']);
  });
});
