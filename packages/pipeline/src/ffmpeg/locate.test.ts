import { describe, expect, it } from 'vitest';
import { locateFfmpeg, type LocateFileSystem } from './locate.js';

function fakeFs(
  files: readonly string[],
  dirs: Readonly<Record<string, string[]>> = {},
): LocateFileSystem {
  const fileSet = new Set(files.map((file) => file.toLowerCase()));
  return {
    isFile: (filePath) => fileSet.has(filePath.toLowerCase()),
    listDir: (dirPath) => dirs[dirPath] ?? [],
  };
}

describe('locateFfmpeg (win32)', () => {
  const platform = 'win32' as const;

  it('uses a configured binary path and finds the sibling ffprobe', () => {
    const result = locateFfmpeg({
      platform,
      env: {},
      configuredPath: 'C:\\Tools\\My ffmpeg\\bin\\ffmpeg.exe',
      fs: fakeFs([
        'C:\\Tools\\My ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Tools\\My ffmpeg\\bin\\ffprobe.exe',
      ]),
    });
    expect(result).toEqual({
      ok: true,
      value: {
        ffmpegPath: 'C:\\Tools\\My ffmpeg\\bin\\ffmpeg.exe',
        ffprobePath: 'C:\\Tools\\My ffmpeg\\bin\\ffprobe.exe',
        source: 'configured',
      },
    });
  });

  it('accepts a configured directory (with or without bin)', () => {
    const result = locateFfmpeg({
      platform,
      env: {},
      configuredPath: '"C:\\Creatorize Suite\\ffmpeg"',
      fs: fakeFs(['C:\\Creatorize Suite\\ffmpeg\\bin\\ffmpeg.exe']),
    });
    expect(result.ok && result.value.ffmpegPath).toBe(
      'C:\\Creatorize Suite\\ffmpeg\\bin\\ffmpeg.exe',
    );
    expect(result.ok && result.value.ffprobePath).toBeNull();
  });

  it('reports a wrong configured path instead of falling back', () => {
    const result = locateFfmpeg({
      platform,
      env: { PATH: 'C:\\bin' },
      configuredPath: 'D:\\nope',
      fs: fakeFs(['C:\\bin\\ffmpeg.exe']),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('not-found');
      expect(result.error.kind === 'not-found' && result.error.searched).toContain(
        'D:\\nope\\ffmpeg.exe',
      );
    }
  });

  it('prefers the env var over PATH', () => {
    const result = locateFfmpeg({
      platform,
      env: { REELFORGE_FFMPEG: 'E:\\ff\\ffmpeg.exe', Path: 'C:\\bin' },
      fs: fakeFs(['E:\\ff\\ffmpeg.exe', 'C:\\bin\\ffmpeg.exe']),
    });
    expect(result.ok && result.value).toMatchObject({
      ffmpegPath: 'E:\\ff\\ffmpeg.exe',
      source: 'env',
    });
  });

  it('searches PATH case-insensitively (Path) and skips empty/quoted entries', () => {
    const result = locateFfmpeg({
      platform,
      env: { Path: ';"C:\\Program Files\\x";C:\\bin' },
      fs: fakeFs(['C:\\bin\\ffmpeg.exe']),
    });
    expect(result.ok && result.value).toMatchObject({
      ffmpegPath: 'C:\\bin\\ffmpeg.exe',
      source: 'path',
    });
  });

  it('finds a versioned winget package', () => {
    const packages = 'C:\\Users\\Papi\\AppData\\Local\\Microsoft\\WinGet\\Packages';
    const pkg = `${packages}\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe`;
    const exe = `${pkg}\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe`;
    const result = locateFfmpeg({
      platform,
      env: { LOCALAPPDATA: 'C:\\Users\\Papi\\AppData\\Local' },
      fs: fakeFs([exe], {
        [packages]: ['Other.Tool_x', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe'],
        [pkg]: ['ffmpeg-8.1.1-full_build'],
      }),
    });
    expect(result.ok && result.value).toMatchObject({ ffmpegPath: exe, source: 'common-dir' });
  });

  it('returns not-found with the searched candidates', () => {
    const result = locateFfmpeg({ platform, env: { PATH: 'C:\\bin' }, fs: fakeFs([]) });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'not-found') {
      expect(result.error.searched).toContain('C:\\bin\\ffmpeg.exe');
      expect(result.error.searched).toContain('C:\\ffmpeg\\bin\\ffmpeg.exe');
    }
  });
});

describe('locateFfmpeg (posix)', () => {
  it('searches PATH without .exe and no Windows dirs', () => {
    const result = locateFfmpeg({
      platform: 'linux',
      env: { PATH: '/usr/local/bin:/usr/bin' },
      fs: fakeFs(['/usr/bin/ffmpeg', '/usr/bin/ffprobe']),
    });
    expect(result).toEqual({
      ok: true,
      value: { ffmpegPath: '/usr/bin/ffmpeg', ffprobePath: '/usr/bin/ffprobe', source: 'path' },
    });
  });
});
