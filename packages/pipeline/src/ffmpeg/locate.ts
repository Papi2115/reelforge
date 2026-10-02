/**
 * Finds the ffmpeg binary: user-configured path -> REELFORGE_FFMPEG env -> PATH -> common Windows
 * install dirs (winget, scoop, chocolatey, C:\ffmpeg, Program Files). ffprobe is looked up next to it.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { FfmpegError } from './errors.js';
import { err, ok, type Result } from '../result.js';

export const FFMPEG_ENV_VAR = 'REELFORGE_FFMPEG';

export type FfmpegSource = 'configured' | 'env' | 'path' | 'common-dir';

export interface FfmpegBinary {
  readonly ffmpegPath: string;
  /** Sibling ffprobe, when present. */
  readonly ffprobePath: string | null;
  readonly source: FfmpegSource;
}

/** Filesystem access used by the locator; injectable for tests. */
export interface LocateFileSystem {
  isFile(filePath: string): boolean;
  /** Directory entry names; empty when the directory does not exist. */
  listDir(dirPath: string): readonly string[];
}

export interface LocateOptions {
  /** Path chosen by the user in settings: a binary or a directory containing it. */
  readonly configuredPath?: string | undefined;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly platform?: NodeJS.Platform;
  readonly fs?: LocateFileSystem;
}

export const nodeFileSystem: LocateFileSystem = {
  isFile(filePath) {
    try {
      return statSync(filePath).isFile();
    } catch {
      // Missing or unreadable path: simply not a candidate.
      return false;
    }
  },
  listDir(dirPath) {
    try {
      return readdirSync(dirPath);
    } catch {
      // Missing or unreadable directory: no entries to offer.
      return [];
    }
  },
};

interface Platform {
  readonly path: path.PlatformPath;
  readonly exe: (name: string) => string;
}

function platformOf(platform: NodeJS.Platform): Platform {
  if (platform === 'win32') {
    return { path: path.win32, exe: (name) => `${name}.exe` };
  }
  return { path: path.posix, exe: (name) => name };
}

/** Reads an env var case-insensitively on Windows (`Path` vs `PATH`). */
function envValue(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
  platform: NodeJS.Platform,
): string | undefined {
  if (platform !== 'win32') return env[name];
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  return key === undefined ? undefined : env[key];
}

/** Directories where ffmpeg is commonly installed on Windows (winget packages are versioned). */
export function commonWindowsDirs(
  env: Readonly<Record<string, string | undefined>>,
  fs: LocateFileSystem,
): string[] {
  const p = path.win32;
  const dirs: string[] = [];
  const localAppData = envValue(env, 'LOCALAPPDATA', 'win32');
  const userProfile = envValue(env, 'USERPROFILE', 'win32');
  const programFiles = envValue(env, 'PROGRAMFILES', 'win32');
  const programData = envValue(env, 'PROGRAMDATA', 'win32');
  if (localAppData !== undefined) {
    dirs.push(p.join(localAppData, 'Microsoft', 'WinGet', 'Links'));
    const packages = p.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    for (const pkg of fs.listDir(packages).filter((name) => /ffmpeg/i.test(name))) {
      const pkgDir = p.join(packages, pkg);
      dirs.push(p.join(pkgDir, 'bin'));
      for (const build of fs.listDir(pkgDir)) dirs.push(p.join(pkgDir, build, 'bin'));
    }
  }
  if (userProfile !== undefined) dirs.push(p.join(userProfile, 'scoop', 'shims'));
  if (programData !== undefined) dirs.push(p.join(programData, 'chocolatey', 'bin'));
  if (programFiles !== undefined) dirs.push(p.join(programFiles, 'ffmpeg', 'bin'));
  dirs.push('C:\\ffmpeg\\bin');
  return dirs;
}

interface Candidate {
  readonly file: string;
  readonly source: FfmpegSource;
}

/** A configured path may point at the binary itself or at its directory. */
function expandUserPath(value: string, platform: Platform, source: FfmpegSource): Candidate[] {
  const trimmed = value.trim().replace(/^"(.*)"$/, '$1');
  if (trimmed === '') return [];
  const exeName = platform.exe('ffmpeg');
  if (platform.path.basename(trimmed).toLowerCase() === exeName.toLowerCase()) {
    return [{ file: trimmed, source }];
  }
  return [
    { file: platform.path.join(trimmed, exeName), source },
    { file: platform.path.join(trimmed, 'bin', exeName), source },
    { file: trimmed, source },
  ];
}

function binaryFrom(candidate: Candidate, platform: Platform, fs: LocateFileSystem): FfmpegBinary {
  const ffprobePath = platform.path.join(
    platform.path.dirname(candidate.file),
    platform.exe('ffprobe'),
  );
  return {
    ffmpegPath: candidate.file,
    ffprobePath: fs.isFile(ffprobePath) ? ffprobePath : null,
    source: candidate.source,
  };
}

export function locateFfmpeg(options: LocateOptions = {}): Result<FfmpegBinary, FfmpegError> {
  const platformName = options.platform ?? process.platform;
  const platform = platformOf(platformName);
  const env = options.env ?? process.env;
  const fs = options.fs ?? nodeFileSystem;

  // An explicit user choice is authoritative: a wrong path is reported, not silently replaced.
  if (options.configuredPath !== undefined && options.configuredPath.trim() !== '') {
    const configured = expandUserPath(options.configuredPath, platform, 'configured');
    const hit = configured.find((candidate) => fs.isFile(candidate.file));
    if (hit !== undefined) return ok(binaryFrom(hit, platform, fs));
    return err({
      kind: 'not-found',
      message: `ffmpeg not found at the configured path: ${options.configuredPath}`,
      searched: configured.map((candidate) => candidate.file),
    });
  }

  const candidates: Candidate[] = [];
  const fromEnv = envValue(env, FFMPEG_ENV_VAR, platformName);
  if (fromEnv !== undefined) candidates.push(...expandUserPath(fromEnv, platform, 'env'));
  const pathValue = envValue(env, 'PATH', platformName) ?? '';
  const delimiter = platformName === 'win32' ? ';' : ':';
  for (const dir of pathValue.split(delimiter)) {
    const clean = dir.trim().replace(/^"(.*)"$/, '$1');
    if (clean !== '')
      candidates.push({ file: platform.path.join(clean, platform.exe('ffmpeg')), source: 'path' });
  }
  if (platformName === 'win32') {
    for (const dir of commonWindowsDirs(env, fs)) {
      candidates.push({ file: path.win32.join(dir, 'ffmpeg.exe'), source: 'common-dir' });
    }
  }

  const hit = candidates.find((candidate) => fs.isFile(candidate.file));
  if (hit !== undefined) return ok(binaryFrom(hit, platform, fs));
  return err({
    kind: 'not-found',
    message: `ffmpeg not found (set it in settings or via ${FFMPEG_ENV_VAR})`,
    searched: candidates.map((candidate) => candidate.file),
  });
}
