/**
 * App settings store (PLAN.md#6.7): `<userData>/settings.json`, zod-validated (shared schema),
 * written atomically (tmp + rename). A corrupt or newer-version file is moved aside as a backup and
 * the defaults are used, so a broken file never blocks startup. Loading is synchronous (a few KB,
 * before `app.ready`: the GPU preference becomes a Chromium switch); writes are serialized.
 */
import { readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { errorCode, writeAtomic } from '@reelforge/claude-bridge';
import {
  appSettingsSchema,
  applyAppSettingsPatch,
  defaultAppSettings,
  migrateAppSettings,
  type AppSettings,
  type AppSettingsPatch,
} from '@reelforge/shared';
import { describeError, type Logger } from './logger.js';

export type ToolPathKey = 'ffmpegPath' | 'whisperPath';

export interface SettingsServiceOptions {
  readonly file: string;
  readonly log: Logger;
  readonly now?: () => Date;
}

export type SettingsWriteResult =
  | { readonly status: 'ok'; readonly settings: AppSettings }
  | { readonly status: 'error'; readonly message: string };

/** `settings.corrupt-2026-10-02T06-31-00-000Z.json` next to the settings file. */
export function settingsBackupFile(file: string, reason: string, now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name}.${reason}-${stamp}${parsed.ext}`);
}

export class SettingsService {
  private current: AppSettings;
  private writes: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly options: SettingsServiceOptions,
    initial: AppSettings,
  ) {
    this.current = initial;
  }

  /** Reads the file; missing -> defaults (written on the first change); broken -> backup + defaults. */
  static load(options: SettingsServiceOptions): SettingsService {
    const { file, log } = options;
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') {
        log.warn(`settings unreadable, using defaults: ${describeError(error)}`);
      }
      return new SettingsService(options, defaultAppSettings());
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      SettingsService.backup(options, 'corrupt', `not JSON: ${describeError(error)}`);
      return new SettingsService(options, defaultAppSettings());
    }
    const migrated = migrateAppSettings(raw);
    if (!migrated.ok) {
      SettingsService.backup(options, migrated.reason, migrated.message);
      return new SettingsService(options, defaultAppSettings());
    }
    const service = new SettingsService(options, migrated.settings);
    if (migrated.migratedFrom !== null) {
      log.info(`settings migrated from version ${String(migrated.migratedFrom)}`);
      void service.enqueue(async () => {
        const saved = await service.persist(migrated.settings);
        if (saved.status === 'error') log.warn(saved.message);
        return saved;
      });
    }
    return service;
  }

  private static backup(options: SettingsServiceOptions, reason: string, message: string): void {
    const target = settingsBackupFile(options.file, reason, (options.now ?? (() => new Date()))());
    try {
      renameSync(options.file, target);
      options.log.warn(`settings ${reason} (${message}); moved to ${target}, using defaults`);
    } catch (error) {
      options.log.error(
        `settings ${reason} (${message}) and the backup failed: ${describeError(error)}`,
      );
    }
  }

  /** Consumers call this on every use (no copies), so a change applies to the next turn/export. */
  get(): AppSettings {
    return this.current;
  }

  update(patch: AppSettingsPatch): Promise<SettingsWriteResult> {
    return this.enqueue(() => {
      let next: AppSettings;
      try {
        next = applyAppSettingsPatch(this.current, patch);
      } catch (error) {
        return Promise.resolve({
          status: 'error',
          message: `invalid settings: ${describeError(error)}`,
        });
      }
      return this.commit(next);
    });
  }

  /** Tool paths are set by main only (its own file picker, or reset to auto-detect with null). */
  setToolPath(key: ToolPathKey, value: string | null): Promise<SettingsWriteResult> {
    return this.enqueue(() =>
      this.commit({ ...this.current, tools: { ...this.current.tools, [key]: value } }),
    );
  }

  /** The export folder is set by main only (its folder picker, or null for `<project>/out`). */
  setExportFolder(value: string | null): Promise<SettingsWriteResult> {
    return this.enqueue(() =>
      this.commit({ ...this.current, export: { ...this.current.export, outputDir: value } }),
    );
  }

  /** Resolves when every queued write has finished. */
  async whenSaved(): Promise<void> {
    await this.writes;
  }

  private enqueue(task: () => Promise<SettingsWriteResult>): Promise<SettingsWriteResult> {
    const result = this.writes.then(task);
    this.writes = result.catch(() => undefined);
    return result;
  }

  private async commit(candidate: AppSettings): Promise<SettingsWriteResult> {
    const valid = appSettingsSchema.safeParse(candidate);
    if (!valid.success)
      return { status: 'error', message: `invalid settings: ${valid.error.message}` };
    const next = valid.data;
    const saved = await this.persist(next);
    if (saved.status === 'error') return saved;
    this.current = next;
    return saved;
  }

  private async persist(settings: AppSettings): Promise<SettingsWriteResult> {
    try {
      await writeAtomic(this.options.file, `${JSON.stringify(settings, null, 2)}\n`);
      return { status: 'ok', settings };
    } catch (error) {
      return { status: 'error', message: `settings not saved: ${describeError(error)}` };
    }
  }
}
