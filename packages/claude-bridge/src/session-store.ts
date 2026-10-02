/**
 * `<project>/.reelforge/sessions.json` (schema in @reelforge/shared): session ids per purpose and
 * the in-flight turn, written atomically (tmp + rename) with per-file serialized updates.
 */
import path from 'node:path';
import {
  SESSIONS_FILE_VERSION,
  sessionsFileSchema,
  type SessionPurpose,
  type SessionRecord,
  type SessionsFile,
} from '@reelforge/shared';
import { z } from 'zod';
import { readJsonFile, writeAtomic, type JsonFileError } from './json-file.js';
import { err, ok, type Result } from './result.js';

export const SESSIONS_FILE = path.join('.reelforge', 'sessions.json');

export type StoreError = JsonFileError;

export function sessionsFilePath(projectDir: string): string {
  return path.join(projectDir, SESSIONS_FILE);
}

function emptyFile(): SessionsFile {
  return { version: SESSIONS_FILE_VERSION, sessions: {} };
}

export function readSessionsFile(projectDir: string): Promise<Result<SessionsFile, StoreError>> {
  return readJsonFile(sessionsFilePath(projectDir), sessionsFileSchema, emptyFile);
}

export type SessionMutator = (record: SessionRecord | undefined) => SessionRecord | undefined;

/** Serializes read-modify-write cycles per sessions file within this process. */
export class SessionStore {
  private readonly chains = new Map<string, Promise<unknown>>();

  read(projectDir: string): Promise<Result<SessionsFile, StoreError>> {
    return readSessionsFile(projectDir);
  }

  async get(
    projectDir: string,
    purpose: SessionPurpose,
  ): Promise<Result<SessionRecord | undefined, StoreError>> {
    const file = await this.read(projectDir);
    return file.ok ? ok(file.value.sessions[purpose]) : file;
  }

  /** Applies `mutate` to one purpose's record and writes the file atomically. */
  update(
    projectDir: string,
    purpose: SessionPurpose,
    mutate: SessionMutator,
  ): Promise<Result<SessionRecord | undefined, StoreError>> {
    const file = sessionsFilePath(projectDir);
    const previous = this.chains.get(file) ?? Promise.resolve();
    const next = previous.then(() => this.applyUpdate(projectDir, purpose, mutate));
    this.chains.set(file, next);
    return next;
  }

  private async applyUpdate(
    projectDir: string,
    purpose: SessionPurpose,
    mutate: SessionMutator,
  ): Promise<Result<SessionRecord | undefined, StoreError>> {
    const current = await readSessionsFile(projectDir);
    if (!current.ok) return current;
    const record = mutate(current.value.sessions[purpose]);
    const sessions: SessionsFile['sessions'] = { ...current.value.sessions, [purpose]: record };
    const updated: SessionsFile = { version: SESSIONS_FILE_VERSION, sessions };
    const validated = sessionsFileSchema.safeParse(updated);
    const file = sessionsFilePath(projectDir);
    if (!validated.success) {
      return err({ kind: 'corrupt', path: file, message: z.prettifyError(validated.error) });
    }
    try {
      await writeAtomic(file, `${JSON.stringify(validated.data, null, 2)}\n`);
    } catch (error) {
      return err({ kind: 'io', path: file, message: String(error) });
    }
    return ok(record);
  }
}
