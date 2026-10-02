/**
 * Finds whisper.cpp installs: user-configured path -> REELFORGE_WHISPER env -> app data dir
 * (`%LOCALAPPDATA%\ReelForge\whisper\bin\<backend>`, filled by WhisperManager.install). Returns
 * every usable install in preference order so a failing GPU build can fall back to a CPU one.
 */
import os from 'node:os';
import path from 'node:path';
import type { BinaryBackend } from './assets.js';
import type { WhisperError } from './errors.js';
import { nodeFileSystem, type LocateFileSystem } from '../ffmpeg/locate.js';
import { err, ok, type Result } from '../result.js';
import type { WhisperBackend } from '../schemas/words.js';

export const WHISPER_ENV_VAR = 'REELFORGE_WHISPER';

/** Preference order of app-data builds: GPU first, then OpenBLAS, then plain CPU. */
export const BACKEND_ORDER: readonly BinaryBackend[] = ['cuda', 'blas', 'cpu'];

export type WhisperSource = 'configured' | 'env' | 'app-data';

export interface WhisperInstall {
  readonly cliPath: string;
  /** `whisper-vad-speech-segments` next to the CLI; null when this build lacks it. */
  readonly vadToolPath: string | null;
  /** App-data installs know their build; user-provided ones are `custom`. */
  readonly backend: WhisperBackend;
  readonly source: WhisperSource;
}

export interface WhisperLocateOptions {
  /** whisper-cli binary or its directory, chosen by the user in settings. */
  readonly configuredPath?: string | undefined;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Root of app-managed installs (default: `defaultWhisperRoot()`). */
  readonly root?: string;
  readonly platform?: NodeJS.Platform;
  readonly fs?: LocateFileSystem;
}

function envValue(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}

/** `%LOCALAPPDATA%\ReelForge\whisper` (Windows) or `~/.local/share/ReelForge/whisper`. */
export function defaultWhisperRoot(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const base = envValue(env, 'LOCALAPPDATA') ?? path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'ReelForge', 'whisper');
}

/** Directory an app-data backend is extracted to. */
export function backendDir(root: string, backend: BinaryBackend): string {
  return path.join(root, 'bin', backend);
}

const exe = (name: string, platform: NodeJS.Platform): string =>
  platform === 'win32' ? `${name}.exe` : name;

/** A user path may be the CLI itself or a directory holding it (directly, in Release/ or bin/). */
function cliCandidates(value: string, platform: NodeJS.Platform): string[] {
  const trimmed = value.trim().replace(/^"(.*)"$/, '$1');
  if (trimmed === '') return [];
  const cliName = exe('whisper-cli', platform);
  if (path.basename(trimmed).toLowerCase() === cliName.toLowerCase()) return [trimmed];
  return [
    path.join(trimmed, cliName),
    path.join(trimmed, 'Release', cliName),
    path.join(trimmed, 'bin', cliName),
  ];
}

function installAt(
  cliPath: string,
  backend: WhisperBackend,
  source: WhisperSource,
  platform: NodeJS.Platform,
  fs: LocateFileSystem,
): WhisperInstall {
  const vad = path.join(path.dirname(cliPath), exe('whisper-vad-speech-segments', platform));
  return { cliPath, vadToolPath: fs.isFile(vad) ? vad : null, backend, source };
}

export function locateWhisper(
  options: WhisperLocateOptions = {},
): Result<WhisperInstall[], WhisperError> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const fs = options.fs ?? nodeFileSystem;
  const root = options.root ?? defaultWhisperRoot(env);
  const searched: string[] = [];
  const found: WhisperInstall[] = [];
  const firstExisting = (candidates: readonly string[]): string | undefined => {
    searched.push(...candidates);
    return candidates.find((candidate) => fs.isFile(candidate));
  };

  if (options.configuredPath !== undefined && options.configuredPath.trim() !== '') {
    // An explicit user choice is authoritative: a wrong path is reported, not silently replaced.
    const hit = firstExisting(cliCandidates(options.configuredPath, platform));
    if (hit === undefined) {
      return err({
        kind: 'not-installed',
        message: `whisper-cli not found at the configured path: ${options.configuredPath}`,
        searched,
      });
    }
    found.push(installAt(hit, 'custom', 'configured', platform, fs));
  } else {
    const fromEnv = envValue(env, WHISPER_ENV_VAR);
    const hit = fromEnv === undefined ? undefined : firstExisting(cliCandidates(fromEnv, platform));
    if (hit !== undefined) found.push(installAt(hit, 'custom', 'env', platform, fs));
  }
  for (const backend of BACKEND_ORDER) {
    const hit = firstExisting(cliCandidates(backendDir(root, backend), platform));
    if (hit !== undefined) found.push(installAt(hit, backend, 'app-data', platform, fs));
  }
  if (found.length === 0) {
    return err({
      kind: 'not-installed',
      message: `whisper.cpp is not installed (download it from settings, or set ${WHISPER_ENV_VAR})`,
      searched,
    });
  }
  return ok(found);
}
