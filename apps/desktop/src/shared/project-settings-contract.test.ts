import { describe, expect, it } from 'vitest';
import { IPC } from './ipc-contract.js';
import { projectSettingsPatchSchema } from './project-settings-contract.js';

describe('project settings contract', () => {
  it('accepts patches of known settings', () => {
    for (const patch of [
      { lookMode: 'mixed' },
      { lookMode: 'voxel-only' },
      { ambientVariation: false },
      { lookMode: 'mixed', ambientVariation: true },
    ]) {
      expect(projectSettingsPatchSchema.safeParse(patch).success, JSON.stringify(patch)).toBe(true);
    }
  });

  it('refuses empty patches, unknown keys and wrong values', () => {
    for (const patch of [
      {},
      { lookMode: undefined },
      { lookMode: 'retro-ui' },
      { ambientVariation: 'yes' },
      { title: 'renamed' },
      { lookMode: 'mixed', fps: 60 },
      null,
    ]) {
      expect(projectSettingsPatchSchema.safeParse(patch).success, JSON.stringify(patch)).toBe(
        false,
      );
    }
  });

  it('is part of the IPC registry', () => {
    expect(IPC.projectSettingsGet.name).toBe('project-settings:get');
    expect(IPC.projectSettingsUpdate.request).toBe(projectSettingsPatchSchema);
  });
});
