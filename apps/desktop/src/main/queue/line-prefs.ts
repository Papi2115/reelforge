/**
 * The production line's preferences in `<app data>/production-line.json` (not in `queues/`: every
 * `.json` there is read as a channel's queue): system notifications on/off (default on) and the
 * quiet hours. zod-validated, atomic writes, kept in memory after the first read.
 */
import path from 'node:path';
import { JsonFileStore } from '@reelforge/claude-bridge';
import {
  LINE_PREFS_VERSION,
  linePrefsSchema,
  type LinePrefs,
  type LinePrefsPatch,
} from '../../shared/queue-contract.js';
import type { Logger } from '../logger.js';

export const LINE_PREFS_FILE = 'production-line.json';

export function linePrefsFile(userDataDir: string): string {
  return path.join(userDataDir, LINE_PREFS_FILE);
}

export function defaultLinePrefs(): LinePrefs {
  return linePrefsSchema.parse({ version: LINE_PREFS_VERSION });
}

export class LinePrefsStore {
  private readonly store = new JsonFileStore(linePrefsSchema, defaultLinePrefs);
  private cached: LinePrefs = defaultLinePrefs();

  constructor(
    private readonly file: string,
    private readonly log: Logger,
  ) {}

  /** The last read or written preferences (defaults until `load`). */
  get current(): LinePrefs {
    return this.cached;
  }

  async load(): Promise<LinePrefs> {
    const read = await this.store.read(this.file);
    if (read.ok) this.cached = read.value;
    else
      this.log.warn(
        `production line preferences unreadable, using defaults: ${read.error.message}`,
      );
    return this.cached;
  }

  async update(patch: LinePrefsPatch): Promise<LinePrefs> {
    const written = await this.store.update(this.file, (current) => ({
      ...current,
      ...(patch.notifications === undefined ? {} : { notifications: patch.notifications }),
      ...(patch.quietHours === undefined ? {} : { quietHours: patch.quietHours }),
    }));
    if (written.ok) {
      this.cached = written.value;
      return written.value;
    }
    this.log.warn(`production line preferences not saved: ${written.error.message}`);
    return this.cached;
  }
}
