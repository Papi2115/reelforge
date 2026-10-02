import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  capabilitiesOf,
  err,
  ok,
  type LocateOptions,
  type WhisperLocateOptions,
} from '@reelforge/pipeline';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import { SettingsService } from './settings-service.js';
import { ToolsService, type ProbedFfmpeg, type ToolProbes } from './tools-service.js';

const GOOD_FFMPEG = 'D:\\Tools\\ff mpeg\\bin\\ffmpeg.exe';
const GOOD_WHISPER = 'D:\\Tools\\whisper\\whisper-cli.exe';

function probed(ffmpegPath: string, source: ProbedFfmpeg['binary']['source']): ProbedFfmpeg {
  const encoders = new Set(['libx264', 'h264_nvenc']);
  const filters = new Set(['afftdn', 'loudnorm']);
  return {
    binary: { ffmpegPath, ffprobePath: null, source },
    info: {
      version: '8.1.1-essentials',
      license: 'GPL',
      version3: true,
      hasWhisper: false,
      configureFlags: ['--enable-gpl'],
      encoders,
      filters,
      capabilities: capabilitiesOf(encoders, filters),
    },
  };
}

interface Calls {
  ffmpeg: LocateOptions[];
  whisper: WhisperLocateOptions[];
}

function fakeProbes(calls: Calls): ToolProbes {
  return {
    ffmpeg: (options) => {
      calls.ffmpeg.push(options);
      const configured = options.configuredPath;
      if (configured === undefined)
        return Promise.resolve(ok(probed('C:\\ffmpeg\\bin\\ffmpeg.exe', 'common-dir')));
      if (configured === GOOD_FFMPEG) return Promise.resolve(ok(probed(configured, 'configured')));
      return Promise.resolve(
        err({ kind: 'probe-failed', message: `${configured} does not look like ffmpeg` }),
      );
    },
    whisper: (options) => {
      calls.whisper.push(options);
      if (options.configuredPath === GOOD_WHISPER) {
        return ok([
          { cliPath: GOOD_WHISPER, vadToolPath: null, backend: 'custom', source: 'configured' },
        ]);
      }
      return err({ kind: 'not-installed', message: 'whisper.cpp is not installed', searched: [] });
    },
  };
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge tools '));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function setup(picked: string | undefined): {
  tools: ToolsService;
  settings: SettingsService;
  calls: Calls;
} {
  const log = createLogger(() => undefined);
  const settings = SettingsService.load({ file: path.join(dir, 'settings.json'), log });
  const calls: Calls = { ffmpeg: [], whisper: [] };
  const tools = new ToolsService({
    settings,
    pickFile: () => Promise.resolve(picked),
    log,
    probes: fakeProbes(calls),
  });
  return { tools, settings, calls };
}

describe('ToolsService', () => {
  it('reports auto-detected ffmpeg with version + licence, and missing whisper', async () => {
    const { tools, calls } = setup(undefined);
    expect(await tools.status(false)).toEqual({
      ffmpeg: {
        status: 'found',
        path: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
        source: 'common-dir',
        version: '8.1.1-essentials',
        license: 'GPL',
        version3: true,
        hardwareEncoders: ['nvenc'],
        ffprobe: false,
      },
      whisper: { status: 'missing', message: 'whisper.cpp is not installed', configured: false },
    });
    await tools.status(false);
    expect(calls.ffmpeg).toHaveLength(1);
    await tools.status(true);
    expect(calls.ffmpeg).toHaveLength(2);
  });

  it('saves a browsed path only when it is a working binary', async () => {
    const bad = setup('C:\\Windows\\notepad.exe');
    expect(await bad.tools.browse('ffmpeg')).toEqual({
      status: 'invalid',
      message: 'C:\\Windows\\notepad.exe does not look like ffmpeg',
    });
    expect(bad.settings.get().tools.ffmpegPath).toBeNull();
  });

  it('uses the saved ffmpeg path from then on and resets to auto-detect', async () => {
    const { tools, settings, calls } = setup(GOOD_FFMPEG);
    const saved = await tools.browse('ffmpeg');
    expect(saved).toMatchObject({
      status: 'saved',
      tools: { ffmpeg: { status: 'found', path: GOOD_FFMPEG, source: 'configured' } },
    });
    expect(settings.get().tools.ffmpegPath).toBe(GOOD_FFMPEG);
    expect(calls.ffmpeg.at(-1)).toEqual({ configuredPath: GOOD_FFMPEG });

    const reset = await tools.reset('ffmpeg');
    expect(settings.get().tools.ffmpegPath).toBeNull();
    expect(reset.ffmpeg).toMatchObject({ status: 'found', source: 'common-dir' });
  });

  it('browses whisper-cli and cancels cleanly', async () => {
    const { tools, settings } = setup(GOOD_WHISPER);
    expect(await tools.browse('whisper')).toMatchObject({
      status: 'saved',
      tools: {
        whisper: { status: 'found', installs: [{ path: GOOD_WHISPER, source: 'configured' }] },
      },
    });
    expect(settings.get().tools.whisperPath).toBe(GOOD_WHISPER);
    const cancelled = setup(undefined);
    expect(await cancelled.tools.browse('whisper')).toEqual({ status: 'cancelled' });
  });
});
