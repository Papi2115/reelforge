import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WHISPER_ENV_VAR, backendDir, defaultWhisperRoot, locateWhisper } from './locate.js';
import type { LocateFileSystem } from '../ffmpeg/locate.js';

const ROOT = path.join('C:', 'Users', 'Papi', 'AppData', 'Local', 'ReelForge', 'whisper');

function fakeFs(files: readonly string[]): LocateFileSystem {
  const set = new Set(files);
  return { isFile: (file) => set.has(file), listDir: () => [] };
}

const cli = (dir: string): string => path.join(dir, 'Release', 'whisper-cli.exe');
const vad = (dir: string): string => path.join(dir, 'Release', 'whisper-vad-speech-segments.exe');

describe('defaultWhisperRoot', () => {
  it('lives under %LOCALAPPDATA%\\ReelForge\\whisper', () => {
    expect(defaultWhisperRoot({ LocalAppData: path.join('C:', 'L') })).toBe(
      path.join('C:', 'L', 'ReelForge', 'whisper'),
    );
  });
});

describe('locateWhisper', () => {
  const cuda = backendDir(ROOT, 'cuda');
  const blas = backendDir(ROOT, 'blas');

  it('lists app-data builds GPU first, with their VAD tool', () => {
    const fs = fakeFs([cli(blas), cli(cuda), vad(cuda)]);
    const result = locateWhisper({ root: ROOT, env: {}, fs, platform: 'win32' });
    expect(result).toEqual({
      ok: true,
      value: [
        { cliPath: cli(cuda), vadToolPath: vad(cuda), backend: 'cuda', source: 'app-data' },
        { cliPath: cli(blas), vadToolPath: null, backend: 'blas', source: 'app-data' },
      ],
    });
  });

  it('puts a configured binary (file or directory, spaces allowed) first', () => {
    const custom = path.join('D:', 'Creatorize Suite', 'whisper');
    const fs = fakeFs([path.join(custom, 'whisper-cli.exe'), cli(blas)]);
    const viaDir = locateWhisper({
      root: ROOT,
      env: {},
      fs,
      platform: 'win32',
      configuredPath: `"${custom}"`,
    });
    expect(viaDir.ok && viaDir.value.map((i) => [i.source, i.backend])).toEqual([
      ['configured', 'custom'],
      ['app-data', 'blas'],
    ]);
    const viaFile = locateWhisper({
      root: ROOT,
      env: {},
      fs,
      platform: 'win32',
      configuredPath: path.join(custom, 'whisper-cli.exe'),
    });
    expect(viaFile.ok && viaFile.value[0]?.cliPath).toBe(path.join(custom, 'whisper-cli.exe'));
  });

  it('reports a wrong configured path instead of silently using another build', () => {
    const fs = fakeFs([cli(cuda)]);
    const result = locateWhisper({
      root: ROOT,
      env: {},
      fs,
      platform: 'win32',
      configuredPath: 'D:\\nope',
    });
    expect(result).toMatchObject({ ok: false, error: { kind: 'not-installed' } });
  });

  it('uses the REELFORGE_WHISPER env var', () => {
    const fromEnv = path.join('E:', 'tools', 'whisper');
    const fs = fakeFs([cli(fromEnv)]);
    const result = locateWhisper({
      root: ROOT,
      env: { [WHISPER_ENV_VAR]: fromEnv },
      fs,
      platform: 'win32',
    });
    expect(result.ok && result.value[0]).toMatchObject({ cliPath: cli(fromEnv), source: 'env' });
  });

  it('lists every searched path when nothing is installed', () => {
    const result = locateWhisper({ root: ROOT, env: {}, fs: fakeFs([]), platform: 'win32' });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'not-installed') {
      expect(result.error.searched).toContain(cli(cuda));
      expect(result.error.message).toContain(WHISPER_ENV_VAR);
    }
  });
});
