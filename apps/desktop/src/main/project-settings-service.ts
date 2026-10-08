/**
 * Per-project settings (the "Project settings" dialog): reads the open project's raw
 * `project.json`, applies a patch, validates the result with the shared `projectFileSchema`
 * (unknown keys survive), writes it atomically (tmp + rename) and commits the project
 * (`ReelForge-Kind: manual`, step `project-settings`). Changes run one at a time.
 * Research mode (PLAN.md#12.10) steers the next Assets step; nothing already fetched is removed.
 *
 * Invalidation: the settings only steer FUTURE builds (look mode: the next storyboard / scene
 * build / sound cues; ambient variation: the render manifest, so the preview and the next export;
 * tension map: the next storyboard and sound cues, and the manifest's per-shot tension;
 * characters and mascot: the next storyboard and scene build; scenes per minute: the next
 * storyboard; faster checks: the next scene build and final review, ADR-027; continuity links: the
 * next storyboard, PLAN.md#13.2).
 * No pipeline step is marked out of date.
 */
import path from 'node:path';
import { writeJsonAtomic } from '@reelforge/project';
import {
  DEFAULT_MASCOT_CHOICE,
  formatShotRange,
  MASCOT_PROFILES,
  projectAmbientVariation,
  projectCharacters,
  projectBeatSync,
  projectContinuityLinks,
  projectFasterChecks,
  projectShotsPerMinute,
  projectRepetitionControl,
  projectFileSchema,
  projectLookMode,
  projectOpenLoops,
  projectPatternInterrupts,
  projectResearchMode,
  projectRevealMoments,
  projectTensionMap,
  type CharacterMode,
  type LookMode,
  type MascotChoice,
  type ResearchMode,
  type ProjectFile,
} from '@reelforge/shared';
import { z } from 'zod';
import { SNAPSHOT_FILES } from '../shared/snapshot-contract.js';
import type {
  LookSummary,
  ProjectSettings,
  ProjectSettingsPatch,
  ProjectSettingsState,
  ProjectSettingsUpdateResult,
  ProjectStyle,
} from '../shared/project-settings-contract.js';
import { describeError, type Logger } from './logger.js';
import { describeIssues, readProjectText } from './project-files.js';

const PROJECT_FILE = SNAPSHOT_FILES.project;
/** Commit trailer `ReelForge-Step` of settings changes. */
export const PROJECT_SETTINGS_STEP = 'project-settings';

const rawProjectSchema = z.looseObject({});
type RawProject = z.infer<typeof rawProjectSchema>;

export interface ProjectSettingsServiceOptions {
  /** Folder of the open project (undefined: none open). */
  readonly projectDir: () => string | undefined;
  /** Commits `paths` of the open project; resolves true when a commit was made. */
  readonly commit: (message: string, paths: readonly string[]) => Promise<boolean>;
  /** Looks a project of this style offers (kit registry, ADR-029). */
  readonly looks: (style: string) => readonly LookSummary[];
  /** How the dialog shows the project's style (read-only). */
  readonly style: (style: string) => ProjectStyle;
  readonly log: Logger;
}

type Loaded =
  | { readonly ok: true; readonly raw: RawProject; readonly project: ProjectFile }
  | { readonly ok: false; readonly message: string };

/** The values the pipeline uses (absent fields = their documented defaults). */
export function effectiveProjectSettings(project: ProjectFile): ProjectSettings {
  return {
    lookMode: projectLookMode(project),
    ambientVariation: projectAmbientVariation(project),
    researchMode: projectResearchMode(project),
    researchSources: [...(project.researchSources ?? [])],
    tensionMap: projectTensionMap(project),
    patternInterrupts: projectPatternInterrupts(project),
    openLoops: projectOpenLoops(project),
    revealMoments: projectRevealMoments(project),
    beatSync: projectBeatSync(project),
    repetitionControl: projectRepetitionControl(project),
    characters: projectCharacters(project),
    mascot: project.mascot ?? DEFAULT_MASCOT_CHOICE,
    shotsPerMinute: projectShotsPerMinute(project) ?? null,
    fasterChecks: projectFasterChecks(project),
    continuityLinks: projectContinuityLinks(project),
  };
}

/** Raw project.json with the patch's defined fields set (key order and unknown keys kept). */
export function applyProjectSettingsPatch(
  raw: RawProject,
  patch: ProjectSettingsPatch,
): RawProject {
  const next: RawProject = { ...raw };
  if (patch.lookMode !== undefined) next['lookMode'] = patch.lookMode;
  if (patch.ambientVariation !== undefined) next['ambientVariation'] = patch.ambientVariation;
  if (patch.researchMode !== undefined) next['researchMode'] = patch.researchMode;
  if (patch.researchSources !== undefined) next['researchSources'] = [...patch.researchSources];
  if (patch.tensionMap !== undefined) next['tensionMap'] = patch.tensionMap;
  for (const key of [...DRAMATURGY_KEYS, ...EDITING_KEYS]) {
    const value = patch[key];
    if (value !== undefined) next[key] = value;
  }
  if (patch.characters !== undefined) next['characters'] = patch.characters;
  if (patch.mascot !== undefined) next['mascot'] = patch.mascot;
  // Off = the field is removed: a project without it builds exactly as before 2.3.6 (ADR-027).
  if (patch.shotsPerMinute === null) delete next['shotsPerMinute'];
  else if (patch.shotsPerMinute !== undefined) next['shotsPerMinute'] = { ...patch.shotsPerMinute };
  if (patch.fasterChecks === false) delete next['fasterChecks'];
  else if (patch.fasterChecks === true) next['fasterChecks'] = true;
  // Off = the field is removed: the storyboard prompt is exactly as before (PLAN.md#13.2).
  if (patch.continuityLinks === false) delete next['continuityLinks'];
  else if (patch.continuityLinks === true) next['continuityLinks'] = true;
  return next;
}

const RESEARCH_MODE_WORDS: Readonly<Record<ResearchMode, string>> = {
  ask: 'ask for each package',
  allowlist: 'auto from selected sources',
  'full-auto': 'full auto (unverified licences)',
  off: 'off',
};

/** The dramaturgy switches (PLAN.md#12.25-12.27), in dialog order. */
const DRAMATURGY_KEYS = ['patternInterrupts', 'openLoops', 'revealMoments'] as const;

const DRAMATURGY_WORDS: Readonly<Record<(typeof DRAMATURGY_KEYS)[number], string>> = {
  patternInterrupts: 'pattern interrupts',
  openLoops: 'open loops',
  revealMoments: 'reveal moments',
};

/** The editing switches (PLAN.md#12.21, #12.23), in dialog order. */
const EDITING_KEYS = ['beatSync', 'repetitionControl'] as const;

const EDITING_WORDS: Readonly<Record<(typeof EDITING_KEYS)[number], string>> = {
  beatSync: 'beat sync',
  repetitionControl: 'repetition control',
};

const CHARACTER_WORDS: Readonly<Record<CharacterMode, string>> = {
  pack: 'pack style',
  classic: 'classic',
};

function mascotWords(mascot: MascotChoice): string {
  return mascot === 'none' ? 'none' : MASCOT_PROFILES[mascot].label;
}

const LOOK_MODE_WORDS: Readonly<Record<LookMode, string>> = {
  'voxel-only': 'voxel only',
  mixed: 'mixed looks',
};

/** Commit subject, e.g. `Project settings: look mode mixed looks, ambient variation on`. */
export function describeSettingsChange(before: ProjectSettings, after: ProjectSettings): string {
  const parts: string[] = [];
  if (before.lookMode !== after.lookMode) {
    parts.push(`look mode ${LOOK_MODE_WORDS[after.lookMode]}`);
  }
  if (before.ambientVariation !== after.ambientVariation) {
    parts.push(`ambient variation ${after.ambientVariation ? 'on' : 'off'}`);
  }
  if (before.researchMode !== after.researchMode) {
    parts.push(`research assets ${RESEARCH_MODE_WORDS[after.researchMode]}`);
  }
  if (before.researchSources.join(',') !== after.researchSources.join(',')) {
    parts.push(`research sources ${after.researchSources.join(', ') || 'none'}`);
  }
  if (before.tensionMap !== after.tensionMap) {
    parts.push(`tension map ${after.tensionMap === 'auto' ? 'on' : 'off'}`);
  }
  for (const key of DRAMATURGY_KEYS) {
    if (before[key] !== after[key]) {
      parts.push(`${DRAMATURGY_WORDS[key]} ${after[key] === 'auto' ? 'on' : 'off'}`);
    }
  }
  for (const key of EDITING_KEYS) {
    if (before[key] !== after[key]) {
      parts.push(`${EDITING_WORDS[key]} ${after[key] === 'auto' ? 'on' : 'off'}`);
    }
  }
  if (before.characters !== after.characters) {
    parts.push(`characters ${CHARACTER_WORDS[after.characters]}`);
  }
  if (before.mascot !== after.mascot) parts.push(`mascot ${mascotWords(after.mascot)}`);
  if (!sameRange(before.shotsPerMinute, after.shotsPerMinute)) {
    const range = after.shotsPerMinute;
    parts.push(`scenes per minute ${range === null ? 'no limit' : formatShotRange(range)}`);
  }
  if (before.fasterChecks !== after.fasterChecks) {
    parts.push(`faster checks ${after.fasterChecks ? 'on' : 'off'}`);
  }
  if (before.continuityLinks !== after.continuityLinks) {
    parts.push(`continuity links ${after.continuityLinks ? 'on' : 'off'}`);
  }
  return `Project settings: ${parts.length === 0 ? 'no change' : parts.join(', ')}`;
}

function sameRange(
  left: ProjectSettings['shotsPerMinute'],
  right: ProjectSettings['shotsPerMinute'],
): boolean {
  return left?.min === right?.min && left?.max === right?.max;
}

function sameSettings(left: ProjectSettings, right: ProjectSettings): boolean {
  return (
    left.lookMode === right.lookMode &&
    left.ambientVariation === right.ambientVariation &&
    left.researchMode === right.researchMode &&
    left.researchSources.join(',') === right.researchSources.join(',') &&
    left.tensionMap === right.tensionMap &&
    DRAMATURGY_KEYS.every((key) => left[key] === right[key]) &&
    EDITING_KEYS.every((key) => left[key] === right[key]) &&
    left.characters === right.characters &&
    left.mascot === right.mascot &&
    sameRange(left.shotsPerMinute, right.shotsPerMinute) &&
    left.fasterChecks === right.fasterChecks &&
    left.continuityLinks === right.continuityLinks
  );
}

export class ProjectSettingsService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: ProjectSettingsServiceOptions) {}

  async get(): Promise<ProjectSettingsState> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    if (!loaded.ok) return { status: 'error', message: loaded.message };
    const { style, genrePreset } = loaded.project;
    return {
      status: 'ok',
      settings: effectiveProjectSettings(loaded.project),
      looks: [...this.options.looks(style)],
      style: this.options.style(style),
      ...(genrePreset === undefined ? {} : { genrePreset }),
    };
  }

  /** Applies one patch; queued behind the previous ones. */
  update(patch: ProjectSettingsPatch): Promise<ProjectSettingsUpdateResult> {
    const run = this.queue.then(() => this.run(patch));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(patch: ProjectSettingsPatch): Promise<ProjectSettingsUpdateResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    if (!loaded.ok) return { status: 'error', message: loaded.message };
    const before = effectiveProjectSettings(loaded.project);
    const next = applyProjectSettingsPatch(loaded.raw, patch);
    const valid = projectFileSchema.safeParse(next);
    if (!valid.success) {
      return { status: 'error', message: `${PROJECT_FILE}: ${describeIssues(valid.error)}` };
    }
    const after = effectiveProjectSettings(valid.data);
    if (sameSettings(before, after)) return { status: 'ok', settings: after, committed: false };
    try {
      await writeJsonAtomic(path.join(dir, PROJECT_FILE), next);
    } catch (error) {
      this.options.log.error(`cannot write ${PROJECT_FILE}: ${describeError(error)}`);
      return { status: 'error', message: `cannot write ${PROJECT_FILE}: ${describeError(error)}` };
    }
    const message = describeSettingsChange(before, after);
    const committed = await this.options.commit(message, [PROJECT_FILE]);
    this.options.log.info(`${message}${committed ? '' : ' (not committed)'}`);
    return { status: 'ok', settings: after, committed };
  }

  private async load(dir: string): Promise<Loaded> {
    const text = await readProjectText(dir, PROJECT_FILE);
    if (text.status === 'missing') return { ok: false, message: `${PROJECT_FILE} is missing` };
    if (text.status === 'error') return { ok: false, message: text.error.message };
    let json: unknown;
    try {
      json = JSON.parse(text.data);
    } catch (error) {
      return { ok: false, message: `${PROJECT_FILE} is not valid JSON: ${describeError(error)}` };
    }
    const raw = rawProjectSchema.safeParse(json);
    if (!raw.success) return { ok: false, message: `${PROJECT_FILE} is not a JSON object` };
    const project = projectFileSchema.safeParse(raw.data);
    if (!project.success) {
      return { ok: false, message: `${PROJECT_FILE}: ${describeIssues(project.error)}` };
    }
    return { ok: true, raw: raw.data, project: project.data };
  }
}
