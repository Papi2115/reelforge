import {
  DEFAULT_STAGE_MODELS,
  MODEL_ALIASES,
  STAGES,
  resolveModel,
  type ClaudeLauncher,
} from '@reelforge/claude-bridge';
import { DEFAULT_STYLE_ID, STYLE_PRESET_IDS } from '@reelforge/engine';
import { WHISPER_MODEL_IDS } from '@reelforge/pipeline';
import {
  DEFAULT_SETTINGS_STAGE_MODELS,
  SETTINGS_DEFAULT_STYLE,
  SETTINGS_MODEL_ALIASES,
  SETTINGS_STAGES,
  SETTINGS_WHISPER_MODELS,
  applyAppSettingsPatch,
  defaultAppSettings,
  type AppSettingsPatch,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  bridgeModelOptions,
  chatTurnModel,
  exportSettings,
  ffmpegLocateOptions,
  qaIterations,
  usageBudgetFor,
  whisperManagerOptions,
  whisperModel,
} from './settings-consumers.js';

const launcher: ClaudeLauncher = { command: 'claude.exe', args: [] };
const settingsWith = (patch: AppSettingsPatch): ReturnType<typeof defaultAppSettings> =>
  applyAppSettingsPatch(defaultAppSettings(), patch);

describe('settings mirror the packages they configure', () => {
  it('model aliases, stages, default models, whisper models and default style', () => {
    expect([...SETTINGS_MODEL_ALIASES].sort()).toEqual([...MODEL_ALIASES].sort());
    expect([...SETTINGS_STAGES].sort()).toEqual(STAGES.filter((stage) => stage !== 'chat').sort());
    for (const stage of SETTINGS_STAGES) {
      expect(DEFAULT_SETTINGS_STAGE_MODELS[stage], stage).toBe(DEFAULT_STAGE_MODELS[stage]);
    }
    expect([...SETTINGS_WHISPER_MODELS]).toEqual([...WHISPER_MODEL_IDS]);
    expect(SETTINGS_DEFAULT_STYLE).toBe(DEFAULT_STYLE_ID);
    expect(STYLE_PRESET_IDS).toContain(SETTINGS_DEFAULT_STYLE);
  });
});

describe('bridge consumers', () => {
  it('defaults reproduce the bridge defaults for every stage', () => {
    const options = bridgeModelOptions(defaultAppSettings());
    expect(options.economy).toBe(false);
    expect(options.models).toEqual(DEFAULT_STAGE_MODELS);
  });

  it('a per-stage choice reaches resolveModel; Economy puts every stage on Sonnet', () => {
    const custom = bridgeModelOptions(
      settingsWith({ models: { critic: 'sonnet', storyboard: 'opus' } }),
    );
    const request = (stage: (typeof STAGES)[number]): Parameters<typeof resolveModel>[0] => ({
      projectDir: 'C:/project',
      stage,
      prompt: 'x',
    });
    expect(resolveModel(request('critic'), { launcher, ...custom })).toBe('sonnet');
    expect(resolveModel(request('storyboard'), { launcher, ...custom })).toBe('opus');
    expect(resolveModel(request('scene-build'), { launcher, ...custom })).toBe('opus');

    const economy = bridgeModelOptions(settingsWith({ economy: true }));
    for (const stage of STAGES) {
      expect(resolveModel(request(stage), { launcher, ...economy }), stage).toBe('sonnet');
    }
  });

  it('chat model with the boost toggle, Economy and QA iterations', () => {
    const settings = defaultAppSettings();
    expect(chatTurnModel(settings, false)).toBe('sonnet');
    expect(chatTurnModel(settings, true)).toBe('opus');
    expect(chatTurnModel(settingsWith({ economy: true }), true)).toBe('sonnet');
    expect(bridgeModelOptions(settingsWith({ chat: { model: 'haiku' } })).models.chat).toBe(
      'haiku',
    );
    expect(qaIterations(settings)).toBe(2);
    expect(qaIterations(settingsWith({ economy: true }))).toBe(1);
  });

  it('soft budget follows the current settings', () => {
    let settings = defaultAppSettings();
    const budgetFor = usageBudgetFor(() => settings);
    expect(budgetFor('C:/project')).toBeUndefined();
    settings = settingsWith({ usage: { softBudgetUsd: 25 } });
    expect(budgetFor('C:/project')).toEqual({ costUsd: 25 });
  });
});

describe('export and tool consumers', () => {
  it('workers default to half the cores, clamp to the cores and map the encoder', () => {
    expect(exportSettings(defaultAppSettings(), 16)).toEqual({
      workers: 8,
      encoder: 'auto',
      chromiumArgs: [],
    });
    expect(exportSettings(defaultAppSettings(), 1).workers).toBe(1);
    const custom = settingsWith({
      performance: { exportWorkers: 12, encoder: 'cpu', gpu: 'high-performance' },
    });
    expect(exportSettings(custom, 8)).toEqual({
      workers: 8,
      encoder: 'libx264',
      chromiumArgs: ['--force_high_performance_gpu'],
    });
    expect(exportSettings(settingsWith({ performance: { encoder: 'nvenc' } }), 8).encoder).toBe(
      'h264_nvenc',
    );
    expect(
      exportSettings(settingsWith({ performance: { gpu: 'low-power' } }), 8).chromiumArgs,
    ).toEqual(['--force_low_power_gpu']);
  });

  it('tool paths: null means auto-detect', () => {
    const settings = defaultAppSettings();
    expect(ffmpegLocateOptions(settings)).toEqual({ configuredPath: undefined });
    expect(whisperManagerOptions(settings)).toEqual({ configuredPath: undefined });
    expect(whisperModel(settings)).toBe('large-v3-turbo-q5_0');
    const configured = {
      ...settings,
      tools: { ...settings.tools, ffmpegPath: 'D:\\ff mpeg\\bin', whisperPath: 'D:\\whisper' },
    };
    expect(ffmpegLocateOptions(configured)).toEqual({ configuredPath: 'D:\\ff mpeg\\bin' });
    expect(whisperManagerOptions(configured)).toEqual({ configuredPath: 'D:\\whisper' });
  });
});
