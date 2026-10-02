/** Tiny line logger for the main process: `<ISO time> <LEVEL> [scope] message` to a sink. */
import { createWriteStream, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { LogLevel } from '../shared/ipc-contract.js';

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  log(level: LogLevel, message: string): void;
  child(scope: string): Logger;
}

export type LogSink = (line: string) => void;

/** One line per entry: newlines inside the message are escaped so the file stays greppable. */
export function formatLogLine(time: Date, level: LogLevel, scope: string, message: string): string {
  const flat = message.replace(/\r?\n/g, '\\n');
  return `${time.toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${flat}\n`;
}

export function createLogger(
  sink: LogSink,
  scope = 'main',
  now: () => Date = () => new Date(),
): Logger {
  const log = (level: LogLevel, message: string): void => {
    sink(formatLogLine(now(), level, scope, message));
  };
  return {
    debug: (message) => {
      log('debug', message);
    },
    info: (message) => {
      log('info', message);
    },
    warn: (message) => {
      log('warn', message);
    },
    error: (message) => {
      log('error', message);
    },
    log,
    child: (childScope) => createLogger(sink, `${scope}:${childScope}`, now),
  };
}

export interface FileLogSink {
  readonly write: LogSink;
  close(): void;
}

/** Appends to `file` (directories created) and mirrors every line to stderr. */
export function fileAndStderrSink(file: string): FileLogSink {
  mkdirSync(path.dirname(file), { recursive: true });
  const stream = createWriteStream(file, { flags: 'a' });
  stream.on('error', (error) => {
    process.stderr.write(`log file ${file} failed: ${error.message}\n`);
  });
  return {
    write: (line) => {
      stream.write(line);
      process.stderr.write(line);
    },
    close: () => {
      stream.end();
    },
  };
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}
