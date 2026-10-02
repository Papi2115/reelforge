import { describe, expect, it } from 'vitest';
import { extraElectronArgs, isCiMode, perfBar } from './ci-mode.js';
import { runMediaTool } from './pipeline-film.js';

describe('CI mode of the app tests', () => {
  it('is on only for REELFORGE_CI=1', () => {
    expect(isCiMode({ REELFORGE_CI: '1' })).toBe(true);
    expect(isCiMode({ REELFORGE_CI: 'true' })).toBe(false);
    expect(isCiMode({})).toBe(false);
  });

  it('keeps the strict perf bars outside CI', () => {
    expect(perfBar(28, 15, false)).toBe(28);
    expect(perfBar(28, 15, true)).toBe(15);
  });

  it('parses extra Chromium switches for the launch', () => {
    expect(extraElectronArgs({})).toEqual([]);
    expect(
      extraElectronArgs({
        REELFORGE_TEST_ELECTRON_ARGS: ' --use-angle=d3d11-warp  --disable-audio-output ',
      }),
    ).toEqual(['--use-angle=d3d11-warp', '--disable-audio-output']);
    expect(() => extraElectronArgs({ REELFORGE_TEST_ELECTRON_ARGS: '--ok evil.js' })).toThrow(
      /"evil\.js" is not a --switch/,
    );
  });
});

describe('runMediaTool', () => {
  it('says that a missing binary could not start (not "failed: undefined")', () => {
    expect(() => runMediaTool('reelforge-no-such-tool', ['-version'])).toThrow(
      /^reelforge-no-such-tool could not start \(.*ENOENT.*\): the app tests need ffmpeg and ffprobe on PATH$/,
    );
  });

  it('reports the exit status and stderr of a failed run', () => {
    expect(() =>
      runMediaTool(process.execPath, ['-e', 'console.error("bad"); process.exit(3)']),
    ).toThrow(/exited with 3: bad$/);
  });
});
