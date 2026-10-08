/**
 * The local taste profiles (PLAN.md#12.13, ADR-022; per channel since PLAN.md#13.13, ADR-031):
 * `<userData>/taste.json` for the default channel, `taste-<id>.json` for every other channel and
 * `taste-<id>--<style>.json` when a channel keeps one per world (taste-scope.ts picks the file).
 * Each is zod-validated and written atomically, loaded on first use (a few KB; a broken file is
 * moved aside and that profile starts empty). With learning on (the channel's switch, else the app
 * setting `taste.learning`) the stage runners of a project get a `TasteLearner` bound to that
 * project: its channel's condensed profile for the storyboard / scene prompts and the user's
 * decisions (variant picks, locks, rebuilds) as signals; with `off` nothing is learned and the
 * prompts stay exactly as without it. Nothing leaves the machine except the profile text inside
 * those prompts. Electron-free; the IPC handlers are in taste-ipc.ts.
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
import {
  resolveTasteScope,
  worldProfiles,
  type ResolvedTasteScope,
  type TasteTarget,
} from './taste-scope.js';

export interface TasteServiceOptions {
  /** App data folder: the profiles live here. */
  readonly dir: string;
  /** `<userData>/channels.json` (read only; channels-ipc.ts writes it). */
  readonly channelsFile: string;
  readonly settings: () => AppSettings;
  readonly log: Logger;
  readonly now?: () => Date;
}

/** Preferences listed in Settings → Taste. */
const MAX_LISTED = 12;

export class TasteService {
  private readonly profiles = new Map<string, TasteProfileFile>();
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: TasteServiceOptions) {}

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  /** Which profile file the target uses and whether its channel learns. */
  scope(target: TasteTarget): ResolvedTasteScope {
    return resolveTasteScope(
      {
        dir: this.options.dir,
        channelsFile: this.options.channelsFile,
        settings: this.options.settings,
        now: () => this.now(),
        warn: (message) => {
          this.options.log.warn(`taste scope: ${message}`);
        },
      },
      target,
    );
  }

  /** The profile in `file` (loaded once; this service is its only writer). */
  profileOf(file: string): TasteProfileFile {
    const known = this.profiles.get(file);
    if (known !== undefined) return known;
    const loaded = this.load(file);
    this.profiles.set(file, loaded);
    return loaded;
  }

  /** The condensed text for the prompts; undefined when off or with too little evidence. */
  profileText(target: TasteTarget): string | undefined {
    const scope = this.scope(target);
    if (scope.learning !== 'auto') return undefined;
    return tasteProfileText(this.profileOf(scope.file), this.now());
  }

  /** What the stage runners of the project in `dir` get (reads channel and switch on every use). */
  learner(dir: string): TasteLearner {
    const target: TasteTarget = { kind: 'project', dir };
    return {
      profile: () => this.profileText(target),
      record: (signals) => {
        void this.record(target, signals);
      },
    };
  }

  /** Adds decisions (nothing while learning is off); resolves when they are on disk. */
  record(target: TasteTarget, signals: readonly TasteSignal[]): Promise<void> {
    const scope = this.scope(target);
    if (scope.learning !== 'auto' || signals.length === 0) return Promise.resolve();
    return this.enqueue(scope.file, (current) => applyTasteSignals(current, signals, this.now()));
  }

  /** Lock (approved as is) or rebuild signals of shots of the project in `dir`. */
  async recordShots(
    dir: string,
    shotIds: readonly string[],
    kind: 'lock' | 'rebuild',
  ): Promise<void> {
    if (shotIds.length === 0 || this.scope({ kind: 'project', dir }).learning !== 'auto') return;
    const signals = await shotTasteSignals(dir, shotIds, kind);
    if (!signals.ok) {
      this.options.log.warn(`taste signals of ${kind}: ${signals.error.message}`);
      return;
    }
    await this.record({ kind: 'project', dir }, signals.value);
  }

  /** "Forget everything" of the target's profile only. */
  reset(target: TasteTarget): Promise<void> {
    return this.enqueue(this.scope(target).file, () => emptyTasteProfile());
  }

  /** The target's profile as written to its file (for "Export profile"). */
  exportJson(target: TasteTarget): string {
    return `${JSON.stringify(this.profileOf(this.scope(target).file), null, 2)}\n`;
  }

  state(target: TasteTarget): TasteState {
    const now = this.now();
    const scope = this.scope(target);
    const profile = this.profileOf(scope.file);
    const channel = scope.channel;
    const worlds =
      channel?.tastePerWorld === true
        ? worldProfiles(this.options.dir, channel, (message) => {
            this.options.log.warn(`taste worlds: ${message}`);
          })
        : [];
    return {
      status: 'ok',
      learning: scope.learning,
      profile: scope.learning === 'auto' ? (tasteProfileText(profile, now) ?? null) : null,
      preferences: tastePreferences(profile, now)
        .slice(0, MAX_LISTED)
        .map((entry) => ({ ...entry, strength: Math.max(-1, Math.min(1, entry.strength)) })),
      signals: { ...profile.signals },
      minSignals: MIN_PROFILE_SIGNALS,
      updatedAt: profile.updatedAt,
      file: scope.file,
      scope: {
        channelId: channel?.id ?? null,
        channelName: channel?.name ?? null,
        color: channel?.color ?? null,
        // The app setting decides for channels without their own switch.
        channelLearning: channel?.tasteLearning ?? null,
        fromProject: scope.fromProject,
        perWorld: channel?.tastePerWorld === true,
        world: scope.world ?? null,
        worlds:
          scope.world === undefined || worlds.includes(scope.world)
            ? worlds
            : [...worlds, scope.world].sort(),
        channels: (scope.channels?.channels ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          color: entry.color ?? null,
        })),
      },
    };
  }

  /** Resolves when every queued write has finished. */
  async whenSaved(): Promise<void> {
    await this.writes;
  }

  private load(file: string): TasteProfileFile {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') {
        this.options.log.warn(`taste profile unreadable, starting empty: ${describeError(error)}`);
      }
      return emptyTasteProfile();
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      return this.moveAside(file, `not JSON: ${describeError(error)}`);
    }
    const parsed = tasteProfileFileSchema.safeParse(raw);
    return parsed.success ? parsed.data : this.moveAside(file, parsed.error.message);
  }

  /** A broken profile is kept next to it (`<name>.corrupt-<time>.json`); it restarts empty. */
  private moveAside(file: string, reason: string): TasteProfileFile {
    const parsedFile = path.parse(file);
    const stamp = this.now().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(
      parsedFile.dir,
      `${parsedFile.name}.corrupt-${stamp}${parsedFile.ext}`,
    );
    try {
      renameSync(file, backup);
      this.options.log.warn(
        `taste profile invalid (${reason}); moved to ${backup}, starting empty`,
      );
    } catch (error) {
      this.options.log.error(
        `taste profile invalid (${reason}), backup failed: ${describeError(error)}`,
      );
    }
    return emptyTasteProfile();
  }

  private enqueue(
    file: string,
    change: (current: TasteProfileFile) => TasteProfileFile,
  ): Promise<void> {
    const run = this.writes.then(async () => {
      const next = tasteProfileFileSchema.parse(change(this.profileOf(file)));
      try {
        await writeAtomic(file, `${JSON.stringify(next, null, 2)}\n`);
        this.profiles.set(file, next);
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
