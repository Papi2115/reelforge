/**
 * The local taste profile (PLAN.md#12.13, ADR-022): `<userData>/taste.json`, zod-validated and
 * written atomically, loaded once at start (a few KB; a broken file is moved aside and the
 * profile starts empty). With `taste.learning` = `auto` the stage runners get a `TasteLearner`:
 * the condensed profile for the storyboard / scene prompts and the user's decisions (variant
 * picks, locks, rebuilds) as signals; with `off` nothing is learned and the prompts stay exactly
 * as without it. Nothing leaves the machine except the profile text inside those prompts.
 * Electron-free; the IPC handlers are in taste-ipc.ts.
 */
import { readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { errorCode, writeAtomic } from '@reelforge/claude-bridge';
import {
  emptyTasteProfile,
  tasteProfileFileSchema,
  type AppSettings,
  type TasteProfileFile,
  type TasteSignal,
} from '@reelforge/shared';
import {
  MIN_PROFILE_SIGNALS,
  applyTasteSignals,
  shotTasteSignals,
  tastePreferences,
  tasteProfileText,
  type TasteLearner,
} from '@reelforge/stages';
import type { TasteState } from '../../shared/taste-contract.js';
import { describeError, type Logger } from '../logger.js';

export interface TasteServiceOptions {
  readonly file: string;
  readonly settings: () => AppSettings;
  readonly log: Logger;
  readonly now?: () => Date;
}

/** Preferences listed in Settings → Taste. */
const MAX_LISTED = 12;

function loadProfile(options: TasteServiceOptions): TasteProfileFile {
  let text: string;
  try {
    text = readFileSync(options.file, 'utf8');
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      options.log.warn(`taste profile unreadable, starting empty: ${describeError(error)}`);
    }
    return emptyTasteProfile();
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return moveAside(options, `not JSON: ${describeError(error)}`);
  }
  const parsed = tasteProfileFileSchema.safeParse(raw);
  return parsed.success ? parsed.data : moveAside(options, parsed.error.message);
}

/** A broken taste.json is kept next to it (`taste.corrupt-<time>.json`); the profile restarts. */
function moveAside(options: TasteServiceOptions, reason: string): TasteProfileFile {
  const parsedFile = path.parse(options.file);
  const stamp = (options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const backup = path.join(parsedFile.dir, `${parsedFile.name}.corrupt-${stamp}${parsedFile.ext}`);
  try {
    renameSync(options.file, backup);
    options.log.warn(`taste profile invalid (${reason}); moved to ${backup}, starting empty`);
  } catch (error) {
    options.log.error(`taste profile invalid (${reason}), backup failed: ${describeError(error)}`);
  }
  return emptyTasteProfile();
}

export class TasteService {
  private current: TasteProfileFile;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: TasteServiceOptions) {
    this.current = loadProfile(options);
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  get learning(): boolean {
    return this.options.settings().taste.learning === 'auto';
  }

  get profile(): TasteProfileFile {
    return this.current;
  }

  /** The condensed text for the prompts; undefined when off or with too little evidence. */
  profileText(): string | undefined {
    return this.learning ? tasteProfileText(this.current, this.now()) : undefined;
  }

  /** What the stage runners get (reads the switch on every use). */
  learner(): TasteLearner {
    return {
      profile: () => this.profileText(),
      record: (signals) => {
        void this.record(signals);
      },
    };
  }

  /** Adds decisions (nothing while learning is off); resolves when they are on disk. */
  record(signals: readonly TasteSignal[]): Promise<void> {
    if (!this.learning || signals.length === 0) return Promise.resolve();
    return this.enqueue(() => applyTasteSignals(this.current, signals, this.now()));
  }

  /** Lock (approved as is) or rebuild signals of shots of the project in `dir`. */
  async recordShots(
    dir: string,
    shotIds: readonly string[],
    kind: 'lock' | 'rebuild',
  ): Promise<void> {
    if (!this.learning || shotIds.length === 0) return;
    const signals = await shotTasteSignals(dir, shotIds, kind);
    if (!signals.ok) {
      this.options.log.warn(`taste signals of ${kind}: ${signals.error.message}`);
      return;
    }
    await this.record(signals.value);
  }

  /** "Forget everything". */
  reset(): Promise<void> {
    return this.enqueue(() => emptyTasteProfile());
  }

  /** The profile as written to taste.json (for "Export profile"). */
  exportJson(): string {
    return `${JSON.stringify(this.current, null, 2)}\n`;
  }

  state(): TasteState {
    const now = this.now();
    return {
      status: 'ok',
      learning: this.options.settings().taste.learning,
      profile: this.profileText() ?? null,
      preferences: tastePreferences(this.current, now)
        .slice(0, MAX_LISTED)
        .map((entry) => ({ ...entry, strength: Math.max(-1, Math.min(1, entry.strength)) })),
      signals: { ...this.current.signals },
      minSignals: MIN_PROFILE_SIGNALS,
      updatedAt: this.current.updatedAt,
      file: this.options.file,
    };
  }

  /** Resolves when every queued write has finished. */
  async whenSaved(): Promise<void> {
    await this.writes;
  }

  private enqueue(change: () => TasteProfileFile): Promise<void> {
    const run = this.writes.then(async () => {
      const next = tasteProfileFileSchema.parse(change());
      try {
        await writeAtomic(this.options.file, `${JSON.stringify(next, null, 2)}\n`);
        this.current = next;
      } catch (error) {
        this.options.log.warn(`taste profile not saved: ${describeError(error)}`);
      }
    });
    this.writes = run.catch((error: unknown) => {
      this.options.log.warn(`taste profile update failed: ${describeError(error)}`);
    });
    return this.writes.then(() => undefined);
  }
}
