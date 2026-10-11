/** A film's captions switch in Project settings (PLAN.md#14.18): project.json `captions`. */
import { captionsOn, type ProjectFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  applyProjectSettingsPatch,
  describeSettingsChange,
  effectiveProjectSettings,
} from './project-settings-service.js';

const PROJECT: ProjectFile = {
  version: 1,
  title: 'x',
  language: 'en',
  style: 'c-cam',
  fps: 24,
  seed: 1,
};

describe('film captions setting', () => {
  it('is off by default and writes words / removes the field', () => {
    const settings = effectiveProjectSettings(PROJECT);
    expect(settings.captions).toBe('off');
    const on = applyProjectSettingsPatch({ version: 1 }, { captions: 'words' });
    expect(on).toEqual({ version: 1, captions: 'words' });
    expect(applyProjectSettingsPatch(on, { captions: 'off' })).toEqual({ version: 1 });
    expect(describeSettingsChange(settings, { ...settings, captions: 'words' })).toBe(
      'Project settings: captions on',
    );
  });

  it('turns the manifest captions on for a film, never touches a short', () => {
    expect(captionsOn(PROJECT)).toBe(false);
    expect(captionsOn({ ...PROJECT, captions: 'words' })).toBe(true);
    const short = {
      ...PROJECT,
      captions: 'words' as const,
      kind: 'short' as const,
      short: { lengthS: 30 as const, captions: false, endCardText: 'Full video on YT: x' },
    };
    expect(captionsOn(short)).toBe(false);
  });
});
