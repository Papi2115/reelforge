import { describe, expect, it } from 'vitest';
import { createLogger, describeError, formatLogLine } from './logger.js';

const time = new Date('2026-10-02T12:00:00.000Z');

describe('formatLogLine', () => {
  it('writes one greppable line per entry', () => {
    expect(formatLogLine(time, 'warn', 'main', 'first\r\nsecond')).toBe(
      '2026-10-02T12:00:00.000Z WARN  [main] first\\nsecond\n',
    );
  });
});

describe('createLogger', () => {
  it('prefixes child scopes', () => {
    const lines: string[] = [];
    const logger = createLogger(
      (line) => lines.push(line),
      'main',
      () => time,
    );
    logger.info('ready');
    logger.child('ipc').error('bad payload');
    expect(lines).toEqual([
      '2026-10-02T12:00:00.000Z INFO  [main] ready\n',
      '2026-10-02T12:00:00.000Z ERROR [main:ipc] bad payload\n',
    ]);
  });
});

describe('describeError', () => {
  it('prefers the stack and stringifies non-errors', () => {
    expect(describeError(new Error('boom'))).toContain('boom');
    expect(describeError(42)).toBe('42');
  });
});
