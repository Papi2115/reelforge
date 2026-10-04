import { describe, expect, it } from 'vitest';
import type { ProjectSettings } from '../../shared/project-settings-contract.js';
import {
  DRAMATURGY_CHOICES,
  DRAMATURGY_NOTE,
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
    const settings: ProjectSettings = {
      lookMode: 'voxel-only',
      ambientVariation: false,
      researchMode: 'ask',
      researchSources: [],
      tensionMap: 'off',
      patternInterrupts: 'off',
      openLoops: 'off',
      revealMoments: 'off',
      beatSync: 'off',
      repetitionControl: 'off',
    };
    expect(withProjectSettingsPatch(settings, { ambientVariation: true })).toEqual({
      ...settings,
      ambientVariation: true,
    });
    expect(withProjectSettingsPatch(settings, { lookMode: 'mixed' })).toEqual({
      ...settings,
      lookMode: 'mixed',
    });
    expect(
      withProjectSettingsPatch(settings, { researchMode: 'allowlist', researchSources: ['nasa'] }),
    ).toEqual({ ...settings, researchMode: 'allowlist', researchSources: ['nasa'] });
    expect(withProjectSettingsPatch(settings, { revealMoments: 'auto' })).toEqual({
      ...settings,
      revealMoments: 'auto',
    });
  });
});

describe('dramaturgy row (PLAN.md#12.25-12.27)', () => {
  it('offers one checkbox per switch, in plan order', () => {
    expect(DRAMATURGY_CHOICES.map((choice) => choice.key)).toEqual([
      'patternInterrupts',
      'openLoops',
      'revealMoments',
    ]);
    expect(DRAMATURGY_NOTE).toContain('Off: the project behaves as before.');
  });
});
