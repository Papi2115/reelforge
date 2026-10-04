/**
 * View model of the "Project settings" dialog: its sections (only those with rows are shown, so
 * later options — research mode, tension curve, taste — just add rows with their section) and the
 * copy of the look-mode choices, built from the kit's available looks.
 */
import type { LookMode } from '@reelforge/shared';
import type {
  LookSummary,
  ProjectSettings,
  ProjectSettingsPatch,
} from '../../shared/project-settings-contract.js';

/** Sections in display order; a section without rows is not rendered. */
export const PROJECT_SETTINGS_SECTIONS = ['visuals', 'research', 'direction', 'taste'] as const;
export type ProjectSettingsSectionId = (typeof PROJECT_SETTINGS_SECTIONS)[number];

export const SECTION_TITLES: Readonly<Record<ProjectSettingsSectionId, string>> = {
  visuals: 'Visuals',
  research: 'Research',
  direction: 'Direction',
  taste: 'Taste',
};

export interface SectionRow {
  readonly id: string;
  readonly section: ProjectSettingsSectionId;
}

export interface SettingsSectionView<Row extends SectionRow> {
  readonly id: ProjectSettingsSectionId;
  readonly title: string;
  readonly rows: readonly Row[];
}

/** Rows grouped by section in display order; empty sections are left out. */
export function groupBySection<Row extends SectionRow>(
  rows: readonly Row[],
): SettingsSectionView<Row>[] {
  return PROJECT_SETTINGS_SECTIONS.map((id) => ({
    id,
    title: SECTION_TITLES[id],
    rows: rows.filter((row) => row.section === id),
  })).filter((section) => section.rows.length > 0);
}

/** The settings with a patch's defined fields applied (the optimistic state of the dialog). */
export function withProjectSettingsPatch(
  settings: ProjectSettings,
  patch: ProjectSettingsPatch,
): ProjectSettings {
  return {
    lookMode: patch.lookMode ?? settings.lookMode,
    ambientVariation: patch.ambientVariation ?? settings.ambientVariation,
    researchMode: patch.researchMode ?? settings.researchMode,
    researchSources: patch.researchSources ?? settings.researchSources,
  };
}

export const VOXEL_LOOK = 'voxel';

/** `Retro UI / CRT` -> `Retro UI`: the short name of a look for one-line copy. */
export function shortLookLabel(label: string): string {
  return label.split(' / ')[0]?.trim() ?? label;
}

export interface LookModeChoice {
  readonly value: LookMode;
  readonly title: string;
  readonly hint: string;
}

/** The two look modes, the mixed one naming the looks it adds to voxel. */
export function lookModeChoices(looks: readonly LookSummary[]): LookModeChoice[] {
  const others = looks.filter((look) => look.id !== VOXEL_LOOK).map((look) => look.label);
  return [
    {
      value: 'voxel-only',
      title: 'Voxel only — the classic look',
      hint: 'Every shot is built in voxel 3D, as in projects made before ReelForge 2.0.',
    },
    {
      value: 'mixed',
      title:
        others.length === 0
          ? 'Mixed looks — voxel with A/B/C rolls'
          : `Mixed looks — voxel + ${others.map(shortLookLabel).join(', ')}`,
      hint: 'The storyboard picks a look for every shot and keeps voxel as the main thread.',
    },
  ];
}

export const LOOK_MODE_NOTE =
  'Applies to the next Storyboard and Scenes build. Shots already built keep their look; no step is marked out of date.';

export const AMBIENT_NOTE =
  'Shows in the preview right away and in the next export. No scene is rebuilt.';
