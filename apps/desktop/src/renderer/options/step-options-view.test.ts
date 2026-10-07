import { describe, expect, it } from 'vitest';
import {
  OPTION_ROW_IDS,
  PROJECT_SETTINGS_ROWS,
  soundPaletteText,
} from '../project/project-settings-view.js';
import { PIPELINE_ROWS } from '../stages/pipeline-view.js';
import {
  isStepId,
  optionsStatus,
  STEP_IDS,
  STEP_OPTION_ROWS,
  stepOptionRows,
} from './step-options-view.js';

describe('step options', () => {
  it('covers every pipeline step and nothing else', () => {
    expect(PIPELINE_ROWS.map((row) => row.id)).toEqual([...STEP_IDS]);
    expect(PIPELINE_ROWS.every((row) => isStepId(row.id))).toBe(true);
    expect(isStepId('library')).toBe(false);
    expect(stepOptionRows('library')).toEqual([]);
  });

  it('puts the sound switches in the Sound step', () => {
    expect(stepOptionRows('sound')).toEqual(['editing', 'tension-map', 'sound-palette']);
  });

  it('puts the planning switches in the Storyboard step', () => {
    expect(stepOptionRows('storyboard')).toEqual([
      'scene-count',
      'dramaturgy',
      'continuity-links',
      'tension-map',
    ]);
  });

  it('puts the look, people, continuity and repetition switches in the Scenes step', () => {
    expect(stepOptionRows('scenes')).toEqual([
      'look-mode',
      'ambient-variation',
      'continuity-links',
      'characters',
      'mascot',
      'editing',
      'scene-count',
    ]);
  });

  it('adds no section to steps whose panel already holds all their options', () => {
    for (const step of ['script', 'voiceover', 'clean', 'words', 'assets', 'export'] as const) {
      expect(STEP_OPTION_ROWS[step]).toEqual([]);
    }
  });

  it('lists each row once per step', () => {
    for (const step of STEP_IDS) {
      const rows = STEP_OPTION_ROWS[step];
      expect(new Set(rows).size).toBe(rows.length);
    }
  });

  it('reaches every option row from Project settings or a step', () => {
    const reachable = new Set([
      ...PROJECT_SETTINGS_ROWS.map((row) => row.id),
      ...STEP_IDS.flatMap((step) => STEP_OPTION_ROWS[step]),
    ]);
    expect([...reachable].sort()).toEqual([...OPTION_ROW_IDS].sort());
  });

  it('keeps every switch a step shows in Project settings too (only notes are step-only)', () => {
    const dialog = new Set(PROJECT_SETTINGS_ROWS.map((row) => row.id));
    const stepOnly = STEP_IDS.flatMap((step) => STEP_OPTION_ROWS[step]).filter(
      (id) => !dialog.has(id),
    );
    expect([...new Set(stepOnly)]).toEqual(['sound-palette']);
  });

  it('says when a change is being saved', () => {
    expect(optionsStatus(1)).toBe('Saving…');
    expect(optionsStatus(0)).toBe('Saved automatically to the project and its history.');
  });
});

describe('Project settings rows', () => {
  it('has the continuity links switch under Visuals', () => {
    expect(PROJECT_SETTINGS_ROWS.find((row) => row.id === 'continuity-links')).toEqual({
      id: 'continuity-links',
      section: 'visuals',
    });
  });
});

describe('soundPaletteText', () => {
  const looks = [
    { id: 'voxel', label: 'Voxel 3D', description: '' },
    { id: 'retro-ui', label: 'Retro UI / CRT', description: '' },
  ];

  it('names the voxel palette with voxel only', () => {
    expect(soundPaletteText('voxel-only', looks)).toBe(
      'Voxel only: every shot uses the voxel sound palette (the classic effects and ambience).',
    );
  });

  it('names the looks whose palettes a mixed film uses', () => {
    expect(soundPaletteText('mixed', looks)).toBe(
      'Mixed looks: every shot takes its effects and ambience from the palette of its look (Voxel 3D, Retro UI); a shared bit-crush and levels keep the film consistent.',
    );
    expect(soundPaletteText('mixed', [])).toBe(
      'Mixed looks: every shot takes its effects and ambience from the palette of its look; a shared bit-crush and levels keep the film consistent.',
    );
  });
});
