/**
 * Finds whisper.cpp builds the user already has (Settings: "Use existing installation found at
 * …"): the REELFORGE_WHISPER env var, every PATH directory and a few common folders (cloned
 * repo builds, unzipped release builds in Downloads). App-managed installs under the whisper root
 * are not "existing" ones and are left out. Read-only: nothing is run.
 */
import path from 'node:path';
import { WHISPER_ENV_VAR, cliCandidates, defaultWhisperRoot, envValue } from './locate.js';
import { nodeFileSystem, type LocateFileSystem } from '../ffmpeg/locate.js';

export type DiscoveredSource = 'env' | 'path' | 'common-dir';

export interface DiscoveredWhisper {
  readonly cliPath: string;
  readonly source: DiscoveredSource;
}

export interface DiscoverOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly platform?: NodeJS.Platform;
  readonly fs?: LocateFileSystem;
  /** App-managed root (default `defaultWhisperRoot()`), excluded from the results. */
  readonly root?: string;
}

/** Folder names of the official Windows release zips once unpacked. */
const RELEASE_FOLDERS = [
  'whisper-cublas-12.4.0-bin-x64',
  'whisper-cublas-11.8.0-bin-x64',
  'whisper-blas-bin-x64',
  'whisper-bin-x64',
];

function commonDirs(
  env: Readonly<Record<string, string | undefined>>,
  platform: NodeJS.Platform,
): string[] {
  const home = envValue(env, platform === 'win32' ? 'USERPROFILE' : 'HOME');
  const repoBuilds = (dir: string): string[] => [
    dir,
    path.join(dir, 'build', 'bin', 'Release'),
    path.join(dir, 'build', 'bin'),
  ];
  const dirs: string[] = [];
  if (home !== undefined) {
    dirs.push(...repoBuilds(path.join(home, 'whisper.cpp')), path.join(home, 'whisper'));
    for (const folder of RELEASE_FOLDERS) dirs.push(path.join(home, 'Downloads', folder));
  }
  if (platform === 'win32') {
    dirs.push(...repoBuilds(path.join('C:\\', 'whisper.cpp')), path.join('C:\\', 'whisper'));
    const local = envValue(env, 'LOCALAPPDATA');
    if (local !== undefined) dirs.push(path.join(local, 'Programs', 'whisper.cpp'));
    const programs = envValue(env, 'PROGRAMFILES');
    if (programs !== undefined) dirs.push(path.join(programs, 'whisper.cpp'));
  }
  return dirs;
}

export function discoverWhisperInstalls(options: DiscoverOptions = {}): DiscoveredWhisper[] {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const fs = options.fs ?? nodeFileSystem;
  const root = options.root ?? defaultWhisperRoot(env);
  const key = (file: string): string =>
    platform === 'win32' ? path.normalize(file).toLowerCase() : path.normalize(file);
  const rootKey = key(root + path.sep);
  const seen = new Set<string>();
  const found: DiscoveredWhisper[] = [];
  const consider = (dir: string, source: DiscoveredSource): void => {
    const hit = cliCandidates(dir, platform).find((candidate) => fs.isFile(candidate));
    if (hit === undefined) return;
    const id = key(hit);
    if (seen.has(id) || id.startsWith(rootKey)) return;
    seen.add(id);
    found.push({ cliPath: hit, source });
  };
  const fromEnv = envValue(env, WHISPER_ENV_VAR);
  if (fromEnv !== undefined) consider(fromEnv, 'env');
  const delimiter = platform === 'win32' ? ';' : ':';
  for (const dir of (envValue(env, 'PATH') ?? '').split(delimiter)) {
    if (dir.trim() !== '') consider(dir, 'path');
  }
  for (const dir of commonDirs(env, platform)) consider(dir, 'common-dir');
  return found;
}
