/**
 * Per-channel secrets (PLAN.md#13.13, ADR-031): the ElevenLabs API key of each channel, encrypted
 * with Electron `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux)
 * and stored as base64 ciphertext in `<userData>/channel-secrets.bin.json` — never in
 * channels.json, never in a project folder, never in git, never in a log. Plain text is refused:
 * without OS encryption (or with Linux's `basic_text` fallback) nothing is stored
 * (`encryption-unavailable`). Values leave this module only through `get` (main process callers);
 * the IPC handlers expose `has` / `set` / `delete`. Electron-free: safeStorage is injected.
 */
import { readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { errorCode, writeAtomic } from '@reelforge/claude-bridge';
import {
  CHANNEL_SECRET_NAMES,
  CHANNEL_SECRETS_FILE_VERSION,
  channelSecretsFileSchema,
  type ChannelSecretName,
  type ChannelSecretsFile,
} from '@reelforge/shared';
import type { SecretErrorKind } from '../../shared/channels-contract.js';
import type { Logger } from '../logger.js';

/** The part of Electron's `safeStorage` the store uses. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  /** Linux only (Electron); `basic_text` = a hard-coded key, treated as unavailable. */
  getSelectedStorageBackend?(): string;
}

export interface SecretError {
  readonly kind: SecretErrorKind;
  /** Never contains a secret value. */
  readonly message: string;
}

export type SecretResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SecretError };

export interface ChannelSecretStoreOptions {
  readonly file: string;
  readonly safeStorage: SafeStorageLike;
  readonly platform: NodeJS.Platform;
  readonly log: Logger;
  readonly now?: () => Date;
}

function ok<T>(value: T): SecretResult<T> {
  return { ok: true, value };
}

function fail<T>(kind: SecretErrorKind, message: string): SecretResult<T> {
  return { ok: false, error: { kind, message } };
}

/** Error text without a stack (a stack never holds the value, but keep logs short). */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withoutChannel(
  secrets: ChannelSecretsFile['secrets'],
  channelId: string,
): ChannelSecretsFile['secrets'] {
  return Object.fromEntries(Object.entries(secrets).filter(([id]) => id !== channelId));
}

function emptyFile(): ChannelSecretsFile {
  return { version: CHANNEL_SECRETS_FILE_VERSION, secrets: {} };
}

export class ChannelSecretStore {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: ChannelSecretStoreOptions) {}

  /** OS encryption is usable (checked on every write: it needs `app.ready`). */
  encryptionAvailable(): boolean {
    const storage = this.options.safeStorage;
    if (!storage.isEncryptionAvailable()) return false;
    if (this.options.platform === 'linux') {
      const backend = storage.getSelectedStorageBackend?.();
      return backend !== 'basic_text' && backend !== 'unknown';
    }
    return true;
  }

  async has(channelId: string, name: ChannelSecretName): Promise<SecretResult<boolean>> {
    const file = await this.read();
    return file.ok ? ok(file.value.secrets[channelId]?.[name] !== undefined) : file;
  }

  /** Names of the secrets a channel has stored. */
  async names(channelId: string): Promise<SecretResult<ChannelSecretName[]>> {
    const file = await this.read();
    if (!file.ok) return file;
    const stored = file.value.secrets[channelId] ?? {};
    return ok(CHANNEL_SECRET_NAMES.filter((name) => stored[name] !== undefined));
  }

  /** The decrypted value; MAIN PROCESS ONLY (never return it over IPC or log it). */
  async get(channelId: string, name: ChannelSecretName): Promise<SecretResult<string | undefined>> {
    const file = await this.read();
    if (!file.ok) return file;
    const stored = file.value.secrets[channelId]?.[name];
    if (stored === undefined) return ok(undefined);
    if (!this.encryptionAvailable()) {
      return fail('encryption-unavailable', 'OS encryption is not available to read the key');
    }
    try {
      return ok(this.options.safeStorage.decryptString(Buffer.from(stored, 'base64')));
    } catch (error) {
      return fail('corrupt', `the stored ${name} cannot be decrypted: ${errorText(error)}`);
    }
  }

  set(channelId: string, name: ChannelSecretName, value: string): Promise<SecretResult<boolean>> {
    return this.enqueue(async () => {
      if (!this.encryptionAvailable()) {
        return fail(
          'encryption-unavailable',
          'OS encryption is not available; the key was not stored (it is never saved as plain text)',
        );
      }
      let cipher: string;
      try {
        cipher = this.options.safeStorage.encryptString(value).toString('base64');
      } catch (error) {
        return fail('encryption-unavailable', `encryption failed: ${errorText(error)}`);
      }
      const file = await this.readForWrite();
      if (!file.ok) return file;
      const secrets = {
        ...file.value.secrets,
        [channelId]: { ...file.value.secrets[channelId], [name]: cipher },
      };
      const written = await this.write({ ...file.value, secrets });
      if (written.ok) this.options.log.info(`stored ${name} of channel ${channelId} (encrypted)`);
      return written.ok ? ok(true) : written;
    });
  }

  delete(channelId: string, name: ChannelSecretName): Promise<SecretResult<boolean>> {
    return this.enqueue(async () => {
      const file = await this.readForWrite();
      if (!file.ok) return file;
      const current = file.value.secrets[channelId];
      if (current?.[name] === undefined) return ok(false);
      const rest = Object.fromEntries(Object.entries(current).filter(([key]) => key !== name));
      const others = withoutChannel(file.value.secrets, channelId);
      const secrets = Object.keys(rest).length === 0 ? others : { ...others, [channelId]: rest };
      const written = await this.write({ ...file.value, secrets });
      if (written.ok) this.options.log.info(`deleted ${name} of channel ${channelId}`);
      return written.ok ? ok(false) : written;
    });
  }

  /** Removes every secret of a deleted channel. */
  deleteChannel(channelId: string): Promise<SecretResult<boolean>> {
    return this.enqueue(async () => {
      const file = await this.readForWrite();
      if (!file.ok) return file;
      if (file.value.secrets[channelId] === undefined) return ok(false);
      const secrets = withoutChannel(file.value.secrets, channelId);
      const written = await this.write({ ...file.value, secrets });
      return written.ok ? ok(true) : written;
    });
  }

  /** Resolves when every queued write has finished. */
  async whenSaved(): Promise<void> {
    await this.writes;
  }

  private enqueue<T>(task: () => Promise<SecretResult<T>>): Promise<SecretResult<T>> {
    const run = this.writes.then(task);
    this.writes = run.catch((error: unknown) => {
      this.options.log.warn(`channel secrets update failed: ${errorText(error)}`);
    });
    return run;
  }

  private async read(): Promise<SecretResult<ChannelSecretsFile>> {
    const { file } = this.options;
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return ok(emptyFile());
      return fail('io', `${file}: ${errorText(error)}`);
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      return fail('corrupt', `${file} is not JSON: ${errorText(error)}`);
    }
    const parsed = channelSecretsFileSchema.safeParse(raw);
    // The schema error lists paths and expectations, never the ciphertext itself.
    return parsed.success
      ? ok(parsed.data)
      : fail(
          'corrupt',
          `${file} is not a valid secrets file (${String(parsed.error.issues.length)} issue(s))`,
        );
  }

  /** Like `read`, but a broken file is moved aside (ciphertext only) so new keys can be stored. */
  private async readForWrite(): Promise<SecretResult<ChannelSecretsFile>> {
    const current = await this.read();
    if (current.ok || current.error.kind !== 'corrupt') return current;
    const { file } = this.options;
    const stamp = (this.options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(file);
    const backup = path.join(parsed.dir, `${parsed.name}.corrupt-${stamp}${parsed.ext}`);
    try {
      await rename(file, backup);
    } catch (error) {
      return fail('io', `${file} is broken and could not be moved aside: ${errorText(error)}`);
    }
    this.options.log.warn(`channel secrets file was broken; moved to ${backup}`);
    return ok(emptyFile());
  }

  private async write(data: ChannelSecretsFile): Promise<SecretResult<true>> {
    const valid = channelSecretsFileSchema.safeParse(data);
    if (!valid.success) return fail('corrupt', 'refused to write an invalid secrets file');
    try {
      await writeAtomic(this.options.file, `${JSON.stringify(valid.data, null, 2)}\n`);
      return ok(true);
    } catch (error) {
      return fail('io', `${this.options.file}: ${errorText(error)}`);
    }
  }
}
