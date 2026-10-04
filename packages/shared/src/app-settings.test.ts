import { describe, expect, it } from 'vitest';
import {
  APP_SETTINGS_VERSION,
  appSettingsPatchSchema,
  appSettingsSchema,
  applyAppSettingsPatch,
  defaultAppSettings,
  migrateAppSettings,
} from './app-settings.js';

describe('app settings', () => {
  it('has the PLAN.md defaults', () => {
    expect(defaultAppSettings()).toEqual({
      version: APP_SETTINGS_VERSION,
      language: 'en',
      defaultStyle: 'voxel-pixel-crisp640',
      theme: 'dark',
      models: {
        research: 'sonnet',
        script: 'sonnet',
        storyboard: 'sonnet',
        'scene-build': 'opus',
        'scene-fix': 'opus',
        critic: 'haiku',
        'sound-cues': 'sonnet',
      },
      chat: { model: 'sonnet', boostModel: 'opus' },
      economy: false,
      usage: { softBudgetUsd: null },
      performance: { exportWorkers: 'auto', encoder: 'auto', gpu: 'auto' },
      tools: { ffmpegPath: null, whisperPath: null, whisperModel: 'large-v3-turbo-q5_0' },
      newProjectDefaults: { characters: 'pack', mascot: 'none' },
      music: { enabled: true },
      scenes: { finalReview: true },
      assetLibrary: { saveDownloaded: true, saveOwn: false },
      taste: { learning: 'auto' },
      export: {
        preset: '1080p30',
        quality: 'standard',
        includeChapters: true,
        includeThumbnail: true,
        outputDir: null,
      },
      onboarding: { connectClaudeDone: false, welcomeDone: false, tourDone: false },
    });
  });

  it('onboards only new profiles: Welcome and tour default to the gate state (PLAN.md#10.3)', () => {
    const existing = appSettingsSchema.parse({
      version: 1,
      onboarding: { connectClaudeDone: true },
    });
    expect(existing.onboarding).toEqual({
      connectClaudeDone: true,
      welcomeDone: true,
      tourDone: true,
    });
    const gatePassed = applyAppSettingsPatch(defaultAppSettings(), {
      onboarding: { connectClaudeDone: true },
    });
    expect(gatePassed.onboarding).toEqual({
      connectClaudeDone: true,
      welcomeDone: false,
      tourDone: false,
    });
    const toured = applyAppSettingsPatch(gatePassed, { onboarding: { tourDone: true } });
    expect(toured.onboarding.tourDone).toBe(true);
    expect(toured.onboarding.welcomeDone).toBe(false);
  });

  it('turns taste learning on for new installs only (PLAN.md#12.13)', () => {
    // An existing settings file without the field (an install from before 2.3): off.
    expect(appSettingsSchema.parse({ version: 1 }).taste).toEqual({ learning: 'off' });
    expect(migrateAppSettings({ language: 'pl' })).toMatchObject({
      ok: true,
      settings: { taste: { learning: 'off' } },
    });
    // No settings file yet: the defaults of a new install.
    expect(defaultAppSettings().taste.learning).toBe('auto');
    const off = applyAppSettingsPatch(defaultAppSettings(), { taste: { learning: 'off' } });
    expect(off.taste.learning).toBe('off');
    expect(appSettingsPatchSchema.safeParse({ taste: { learning: 'always' } }).success).toBe(false);
  });

  it('keeps the export dialog choices, backward-compatibly (PLAN.md#9.1)', () => {
    // A file written before the export section existed still parses, with the defaults.
    expect(appSettingsSchema.parse({ version: 1 }).export.preset).toBe('1080p30');
    const next = applyAppSettingsPatch(defaultAppSettings(), {
      export: { preset: '4k', includeChapters: false },
    });
    expect(next.export).toEqual({
      preset: '4k',
      quality: 'standard',
      includeChapters: false,
      includeThumbnail: true,
      outputDir: null,
    });
    // The output folder comes from main's picker only.
    expect(appSettingsPatchSchema.safeParse({ export: { outputDir: 'C:\\x' } }).success).toBe(
      false,
    );
    expect(appSettingsSchema.safeParse({ version: 1, export: { quality: 'ultra' } }).success).toBe(
      false,
    );
  });

  it('fills missing nested fields with defaults and drops unknown keys', () => {
    const parsed = appSettingsSchema.parse({
      version: 1,
      models: { critic: 'sonnet' },
      performance: { exportWorkers: 3 },
      somethingNew: true,
    });
    expect(parsed.models.critic).toBe('sonnet');
    expect(parsed.models['scene-build']).toBe('opus');
    expect(parsed.performance).toEqual({ exportWorkers: 3, encoder: 'auto', gpu: 'auto' });
    expect(parsed).not.toHaveProperty('somethingNew');
  });

  it('rejects invalid values', () => {
    for (const bad of [
      { version: 1, language: 'de' },
      { version: 1, theme: 'light' },
      { version: 1, models: { script: 'gpt' } },
      { version: 1, performance: { exportWorkers: 0 } },
      { version: 1, usage: { softBudgetUsd: -5 } },
      { version: 1, defaultStyle: 'Not A Style' },
    ]) {
      expect(appSettingsSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('migrates unversioned files and refuses newer versions', () => {
    const legacy = migrateAppSettings({ language: 'pl', economy: true });
    expect(legacy).toMatchObject({ ok: true, migratedFrom: 0 });
    if (legacy.ok) {
      expect(legacy.settings.version).toBe(APP_SETTINGS_VERSION);
      expect(legacy.settings.language).toBe('pl');
      expect(legacy.settings.economy).toBe(true);
    }
    expect(migrateAppSettings({ version: 1 })).toMatchObject({ ok: true, migratedFrom: null });
    expect(migrateAppSettings({ version: 2 })).toMatchObject({
      ok: false,
      reason: 'newer-version',
    });
    expect(migrateAppSettings([1, 2])).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(migrateAppSettings({ version: 'one' })).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(migrateAppSettings({ version: 1, economy: 'yes' })).toMatchObject({
      ok: false,
      reason: 'corrupt',
    });
  });

  it('applies patches one level deep', () => {
    const next = applyAppSettingsPatch(defaultAppSettings(), {
      language: 'pl',
      economy: true,
      models: { storyboard: 'opus' },
      performance: { encoder: 'nvenc' },
      assetLibrary: { saveOwn: true },
    });
    expect(next.assetLibrary).toEqual({ saveDownloaded: true, saveOwn: true });
    expect(next.language).toBe('pl');
    expect(next.economy).toBe(true);
    expect(next.models.storyboard).toBe('opus');
    expect(next.models.script).toBe('sonnet');
    expect(next.performance).toEqual({ exportWorkers: 'auto', encoder: 'nvenc', gpu: 'auto' });
  });

  it('keeps the characters and mascot of new projects (PLAN.md#12.20)', () => {
    // A file from before 2.3.5 reads the template's defaults.
    expect(appSettingsSchema.parse({ version: 1 }).newProjectDefaults).toEqual({
      characters: 'pack',
      mascot: 'none',
    });
    const fox = applyAppSettingsPatch(defaultAppSettings(), {
      newProjectDefaults: { mascot: 'fox' },
    });
    expect(fox.newProjectDefaults).toEqual({ characters: 'pack', mascot: 'fox' });
    const classic = applyAppSettingsPatch(fox, { newProjectDefaults: { characters: 'classic' } });
    expect(classic.newProjectDefaults).toEqual({ characters: 'classic', mascot: 'fox' });
    expect(
      appSettingsPatchSchema.safeParse({ newProjectDefaults: { mascot: 'cat' } }).success,
    ).toBe(false);
  });

  it('keeps tool paths and unknown keys out of renderer patches', () => {
    expect(
      appSettingsPatchSchema.safeParse({ tools: { ffmpegPath: 'C:\\evil.exe' } }).success,
    ).toBe(false);
    expect(appSettingsPatchSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(appSettingsPatchSchema.safeParse({ theme: 'dark' }).success).toBe(false);
    expect(appSettingsPatchSchema.safeParse({ tools: { whisperModel: 'small' } }).success).toBe(
      true,
    );
    // A parsed patch carries only what was sent (no defaults over other choices).
    expect(appSettingsPatchSchema.parse({ models: { critic: 'sonnet' }, performance: {} })).toEqual(
      {
        models: { critic: 'sonnet' },
        performance: {},
      },
    );
  });
});
