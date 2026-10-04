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
    tensionMap: patch.tensionMap ?? settings.tensionMap,
    patternInterrupts: patch.patternInterrupts ?? settings.patternInterrupts,
    openLoops: patch.openLoops ?? settings.openLoops,
    revealMoments: patch.revealMoments ?? settings.revealMoments,
    beatSync: patch.beatSync ?? settings.beatSync,
    repetitionControl: patch.repetitionControl ?? settings.repetitionControl,
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

export const TENSION_MAP_NOTE =
  'Applies from the next Storyboard (Claude proposes a curve first) and the next sound design. Edit the curve in the Tension panel (Timeline → Tension). Off: the project behaves as before.';

export const DRAMATURGY_NOTE =
  'Applies from the next Script and Storyboard (interrupts, loops) and from the final review (moments to approve). Off: the project behaves as before.';

/** The dramaturgy switches (PLAN.md#12.25-12.27): one checkbox each. */
export const DRAMATURGY_CHOICES = [
  {
    key: 'patternInterrupts',
    title: 'Plan pattern interrupts',
    hint: 'One or two planned surprises a minute (more where the tension is high): a sudden change of look, scale or perspective, made with transitions and camera moves.',
  },
  {
    key: 'openLoops',
    title: 'Open and close loops',
    hint: 'The script opens questions (“I’ll show you in a moment”) and answers them later; a veiled object can be revealed on the answer. Loops that never close are flagged.',
  },
  {
    key: 'revealMoments',
    title: 'Propose reveal moments',
    hint: 'At the biggest tension peaks the app proposes a "wow" moment — silence before a hit, a palette flash or slow motion — for you to accept or reject.',
  },
] as const;

export const EDITING_NOTE =
  'Beat sync applies from the next Storyboard (cuts) and the next sound design (music, hits). Repetition control runs with the final review and the sound design; nothing changes until you press Apply. Off: the project behaves as before.';

/** The editing switches (PLAN.md#12.21, #12.23): one checkbox each. */
export const EDITING_CHOICES = [
  {
    key: 'beatSync',
    title: 'Cut on the beat',
    hint: 'The music follows the pace of the narration; cuts move up to 0.1 s (never into a word) and hits up to 0.12 s onto a beat or a stressed word. Locked shots never move.',
  },
  {
    key: 'repetitionControl',
    title: 'Watch for repetition',
    hint: 'Finds the same visual, chart, transition, sound or phrase used too often across the film and proposes a replacement in the final review.',
  },
] as const;

export const AMBIENT_NOTE =
  'Shows in the preview right away and in the next export. No scene is rebuilt.';
