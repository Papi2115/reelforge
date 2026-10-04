import { describe, expect, it } from 'vitest';
import {
  groupBySection,
  lookModeChoices,
  shortLookLabel,
  withProjectSettingsPatch,
  type SectionRow,
} from './project-settings-view.js';

const LOOKS = [
  { id: 'voxel', label: 'Voxel 3D', description: 'Voxel.' },
  { id: 'retro-ui', label: 'Retro UI / CRT', description: 'CRT.' },
  { id: 'diorama', label: 'Isometric diorama', description: 'Dioramas.' },
  { id: 'blueprint', label: 'Blueprint / data', description: 'Charts.' },
];

describe('groupBySection', () => {
  it('keeps the section order and leaves out sections without rows', () => {
    const rows: SectionRow[] = [
      { id: 'taste-profile', section: 'taste' },
      { id: 'look-mode', section: 'visuals' },
      { id: 'ambient', section: 'visuals' },
    ];
    expect(
      groupBySection(rows).map((section) => [section.title, section.rows.map((row) => row.id)]),
    ).toEqual([
      ['Visuals', ['look-mode', 'ambient']],
      ['Taste', ['taste-profile']],
    ]);
    expect(groupBySection([])).toEqual([]);
  });
});

describe('lookModeChoices', () => {
  it('names the looks the mixed mode adds to voxel', () => {
    expect(lookModeChoices(LOOKS).map((choice) => [choice.value, choice.title])).toEqual([
      ['voxel-only', 'Voxel only — the classic look'],
      ['mixed', 'Mixed looks — voxel + Retro UI, Isometric diorama, Blueprint'],
    ]);
    expect(lookModeChoices(LOOKS.slice(0, 1))[1]?.title).toBe(
      'Mixed looks — voxel with A/B/C rolls',
    );
  });

  it('shortens look labels at the slash', () => {
    expect(shortLookLabel('Retro UI / CRT')).toBe('Retro UI');
    expect(shortLookLabel('Isometric diorama')).toBe('Isometric diorama');
  });
});

describe('withProjectSettingsPatch', () => {
  it('applies only the fields the patch sets', () => {
    const settings = { lookMode: 'voxel-only', ambientVariation: false } as const;
    expect(withProjectSettingsPatch(settings, { ambientVariation: true })).toEqual({
      lookMode: 'voxel-only',
      ambientVariation: true,
    });
    expect(withProjectSettingsPatch(settings, { lookMode: 'mixed' })).toEqual({
      lookMode: 'mixed',
      ambientVariation: false,
    });
  });
});
