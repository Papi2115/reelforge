/**
 * Locates the native `claude` executable (PLAN.md#5.1, ADR-001). On Windows the npm `claude.cmd` is
 * only a shim around `node_modules/@anthropic-ai/claude-code/bin/claude.exe`: we resolve the exe so
 * it can be spawned with shell:false.
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ResolveOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
}

export interface Resolution {
  readonly executable: string | undefined;
  /** Directories inspected, in order (shown by the connection wizard when nothing was found). */
  readonly searched: readonly string[];
}

function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name);
  const value = key === undefined ? undefined : env[key];
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Extra install locations beyond PATH. Windows: npm global prefix (`%APPDATA%\npm`, verified with
 * the npm install) and the native installer's `~\.local\bin` (unverified). POSIX: `~/.local/bin`.
 */
export function commonInstallDirs(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const home =
    (platform === 'win32' ? envValue(env, 'USERPROFILE') : envValue(env, 'HOME')) ?? os.homedir();
  const dirs = [paths.join(home, '.local', 'bin')];
  const appData = platform === 'win32' ? envValue(env, 'APPDATA') : undefined;
  if (appData !== undefined) dirs.unshift(paths.join(appData, 'npm'));
  return dirs;
}

/** Target exe of an npm cmd-shim line like `"%dp0%\node_modules\...\claude.exe" %*`. */
export function exeFromCmdShim(shimPath: string): string | undefined {
  let content: string;
  try {
    content = readFileSync(shimPath, 'utf8');
  } catch {
    return undefined; // unreadable shim: treat as "not this one", keep searching
  }
  const match = /"%dp0%\\([^"]+\.exe)"/i.exec(content);
  if (match?.[1] === undefined) return undefined;
  // The shim exists on this machine's filesystem, so join with the native path API; the target
  // inside it is always backslash-separated (identical to path.win32.join on Windows).
  const exe = path.join(path.dirname(shimPath), ...match[1].split('\\'));
  return existsSync(exe) ? exe : undefined;
}

/** PATH first, then common install dirs; never returns a `.cmd`. */
export function resolveClaudeExecutable(options: ResolveOptions = {}): Resolution {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const delimiter = platform === 'win32' ? ';' : ':';
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const pathDirs = (envValue(env, 'PATH') ?? '').split(delimiter).filter((dir) => dir !== '');
  const searched = [...new Set([...pathDirs, ...commonInstallDirs(env, platform)])];
  for (const dir of searched) {
    if (platform !== 'win32') {
      const file = paths.join(dir, 'claude');
      if (existsSync(file)) return { executable: file, searched };
      continue;
    }
    const exe = paths.join(dir, 'claude.exe');
    if (existsSync(exe)) return { executable: exe, searched };
    const shim = paths.join(dir, 'claude.cmd');
    const target = existsSync(shim) ? exeFromCmdShim(shim) : undefined;
    if (target !== undefined) return { executable: target, searched };
  }
  return { executable: undefined, searched };
}
