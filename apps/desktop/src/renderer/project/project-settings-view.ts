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
export const PROJECT_SETTINGS_SECTIONS = [
  'visuals',
  'characters',
  'mascot',
  'research',
  'direction',
  'build',
  'taste',
] as const;
export type ProjectSettingsSectionId = (typeof PROJECT_SETTINGS_SECTIONS)[number];

export const SECTION_TITLES: Readonly<Record<ProjectSettingsSectionId, string>> = {
  visuals: 'Visuals',
  characters: 'Characters',
  mascot: 'Mascot',
  research: 'Research',
  direction: 'Direction',
  build: 'Scenes and checks',
  taste: 'Taste',
};

/**
 * Every option row: rendered by the Project settings dialog and by the "All options" section of
 * a step's panel (step-options-view.ts), always through the same component (option-registry.ts).
 */
export const OPTION_ROW_IDS = [
  'style',
  'look-mode',
  'ambient-variation',
  'continuity-links',
  'characters',
  'mascot',
  'research-assets',
  'tension-map',
  'dramaturgy',
  'editing',
  'scene-count',
  'sound-palette',
] as const;
export type OptionRowId = (typeof OPTION_ROW_IDS)[number];

export interface SectionRow {
  readonly id: string;
  readonly section: ProjectSettingsSectionId;
}

/** A row of the Project settings dialog: one of the option rows. */
export interface OptionSectionRow extends SectionRow {
  readonly id: OptionRowId;
}

/** Every row of the Project settings dialog, by section (the sound palette is a step note only). */
export const PROJECT_SETTINGS_ROWS: readonly OptionSectionRow[] = [
  { id: 'style', section: 'visuals' },
  { id: 'look-mode', section: 'visuals' },
  { id: 'ambient-variation', section: 'visuals' },
  { id: 'continuity-links', section: 'visuals' },
  { id: 'characters', section: 'characters' },
  { id: 'mascot', section: 'mascot' },
  { id: 'research-assets', section: 'research' },
  { id: 'tension-map', section: 'direction' },
  { id: 'dramaturgy', section: 'direction' },
  { id: 'editing', section: 'direction' },
  { id: 'scene-count', section: 'build' },
];

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
    characters: patch.characters ?? settings.characters,
    mascot: patch.mascot ?? settings.mascot,
    shotsPerMinute:
      patch.shotsPerMinute === undefined ? settings.shotsPerMinute : patch.shotsPerMinute,
    fasterChecks: patch.fasterChecks ?? settings.fasterChecks,
    continuityLinks: patch.continuityLinks ?? settings.continuityLinks,
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
  'Applies from the next Script and Storyboard (surprise moments, questions and answers) and from the final review (wow moments to approve). Off: the project behaves as before.';

/**
 * The dramaturgy switches (PLAN.md#12.25-12.27), one checkbox each, named like the Director's
 * Story beats: surprise moments (pattern interrupts), questions and answers (open loops), wow
 * moments (reveal moments).
 */
export const DRAMATURGY_CHOICES = [
  {
    key: 'patternInterrupts',
    title: 'Plan surprise moments',
    hint: 'One or two planned surprises a minute (more where the tension is high): a sudden change of look, scale or perspective, made with transitions and camera moves.',
  },
  {
    key: 'openLoops',
    title: 'Plan questions and answers',
    hint: 'The script asks questions (“I’ll show you in a moment”) and answers them later; a veiled object can be revealed on the answer. A question that is never answered is flagged.',
  },
  {
    key: 'revealMoments',
    title: 'Propose wow moments',
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

export const CONTINUITY_NOTE =
  'Applies from the next Storyboard. Shots already planned keep their transitions; no step is marked out of date. Off: the project behaves as before.';

export const CONTINUITY_HINT =
  'Now and then the storyboard carries one object across a cut instead of a wipe: the camera dives into it, it stays in place while the world changes, or the place stays while the object changes. Rare (about one link per 45 s), never on the first shot.';

export const SOUND_PALETTE_NOTE =
  'Follows the look mode (Visuals); applies from the next sound design. Nothing to switch here.';

/** Read-only line: which sound palettes the film uses under its look mode. */
export function soundPaletteText(lookMode: LookMode, looks: readonly LookSummary[]): string {
  if (lookMode === 'voxel-only') {
    return 'Voxel only: every shot uses the voxel sound palette (the classic effects and ambience).';
  }
  const labels = looks.map((look) => shortLookLabel(look.label));
  const list = labels.length === 0 ? '' : ` (${labels.join(', ')})`;
  return `Mixed looks: every shot takes its effects and ambience from the palette of its look${list}; a shared bit-crush and levels keep the film consistent.`;
}
