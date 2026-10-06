import { err, ok } from '@reelforge/claude-bridge';
import { defaultAppSettings, type AppSettings } from '@reelforge/shared';
import type { AudioTools, PipelineAudioToolsOptions } from '@reelforge/stages';
import { describe, expect, it } from 'vitest';
import { appStageSettings, sharedClaudeRunner, settingsAudioTools } from './stage-runtime.js';

function fakeTools(id: number): AudioTools {
  return {
    durationS: () => Promise.resolve(ok(id)),
    clean: () => Promise.resolve(err({ kind: 'n/a', message: 'n/a' })),
    transcribe: () => Promise.resolve(err({ kind: 'n/a', message: 'n/a' })),
    hasWhisperModel: () => id > 1,
    mix: () => Promise.resolve(err({ kind: 'n/a', message: 'n/a' })),
  };
}

describe('stage runtime', () => {
  it('rebuilds the audio tools when a tool path changes in the settings', async () => {
    let settings: AppSettings = defaultAppSettings();
    const created: PipelineAudioToolsOptions[] = [];
    const tools = settingsAudioTools(
      () => settings,
      (options) => {
        created.push(options);
        return fakeTools(created.length);
      },
    );
    expect(await tools.durationS('a.wav')).toEqual(ok(1));
    expect(tools.hasWhisperModel('small')).toBe(false);
    expect(created).toHaveLength(1);
    settings = { ...settings, tools: { ...settings.tools, ffmpegPath: 'D:\\ffmpeg\\bin' } };
    expect(await tools.durationS('a.wav')).toEqual(ok(2));
    expect(created.at(-1)?.ffmpegPath).toBe('D:\\ffmpeg\\bin');
    expect(created).toHaveLength(2);
  });

  it('turns a missing Claude setup into a blocked turn', async () => {
    const runner = sharedClaudeRunner(() =>
      Promise.resolve(err({ kind: 'not-connected', message: 'Claude Code is not logged in.' })),
    );
    const result = await runner.run({
      projectDir: 'C:\\p',
      stage: 'research',
      purpose: 'script',
      prompt: 'x',
      model: 'sonnet',
      newSession: true,
    });
    expect(result).toMatchObject({ status: 'blocked', message: 'Claude Code is not logged in.' });
  });

  it('scene settings: two shots at once, two fix turns (one in Economy mode)', () => {
    const app = defaultAppSettings();
    expect(appStageSettings(app).scenes).toMatchObject({ concurrency: 2, maxFixIterations: 2 });
    expect(appStageSettings({ ...app, economy: true }).scenes.maxFixIterations).toBe(1);
  });

  it('lets experimental worlds count only with the Settings switch (PLAN.md#13.6)', () => {
    const app = defaultAppSettings();
    expect(appStageSettings(app)).not.toHaveProperty('experimentalWorlds');
    const on = appStageSettings({ ...app, experimental: { worlds: true } });
    expect(on.experimentalWorlds).toBe(true);
  });
});
