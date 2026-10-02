import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverWhisperInstalls } from './discover.js';
import { backendDir } from './locate.js';
import type { LocateFileSystem } from '../ffmpeg/locate.js';

const HOME = path.join('C:', 'Users', 'Papi Ż');
const ROOT = path.join(HOME, 'AppData', 'Local', 'ReelForge', 'whisper');

function fakeFs(files: readonly string[]): LocateFileSystem {
  const set = new Set(files);
  return { isFile: (file) => set.has(file), listDir: () => [] };
}

describe('discoverWhisperInstalls', () => {
  it('finds the env var, PATH and common folders, in that order, without duplicates', () => {
    const fromEnv = path.join('D:', 'tools', 'whisper', 'Release', 'whisper-cli.exe');
    const onPath = path.join('D:', 'bin', 'whisper-cli.exe');
    const repo = path.join(HOME, 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-cli.exe');
    const unzipped = path.join(
      HOME,
      'Downloads',
      'whisper-blas-bin-x64',
      'Release',
      'whisper-cli.exe',
    );
    const found = discoverWhisperInstalls({
      env: {
        REELFORGE_WHISPER: path.join('D:', 'tools', 'whisper'),
        Path: [path.join('D:', 'bin'), path.join('D:', 'tools', 'whisper', 'Release')].join(';'),
        USERPROFILE: HOME,
      },
      platform: 'win32',
      root: ROOT,
      fs: fakeFs([fromEnv, onPath, repo, unzipped]),
    });
    expect(found).toEqual([
      { cliPath: fromEnv, source: 'env' },
      { cliPath: onPath, source: 'path' },
      { cliPath: repo, source: 'common-dir' },
      { cliPath: unzipped, source: 'common-dir' },
    ]);
  });

  it('leaves out the app-managed builds', () => {
    const managed = path.join(backendDir(ROOT, 'blas'), 'Release', 'whisper-cli.exe');
    const found = discoverWhisperInstalls({
      env: { PATH: path.join(backendDir(ROOT, 'blas'), 'Release') },
      platform: 'win32',
      root: ROOT,
      fs: fakeFs([managed]),
    });
    expect(found).toEqual([]);
  });
});
