/**
 * Per-project settings (the "Project settings" dialog): reads the open project's raw
 * `project.json`, applies a patch, validates the result with the shared `projectFileSchema`
 * (unknown keys survive), writes it atomically (tmp + rename) and commits the project
 * (`ReelForge-Kind: manual`, step `project-settings`). Changes run one at a time.
 * Research mode (PLAN.md#12.10) steers the next Assets step; nothing already fetched is removed.
 *
 * Invalidation: the settings only steer FUTURE builds (look mode: the next storyboard / scene
 * build / sound cues; ambient variation: the render manifest, so the preview and the next export;
 * tension map: the next storyboard and sound cues, and the manifest's per-shot tension).
 * No pipeline step is marked out of date.
 */
import path from 'node:path';
import { writeJsonAtomic } from '@reelforge/project';
import {
  projectAmbientVariation,
  projectBeatSync,
  projectRepetitionControl,
  projectFileSchema,
  projectLookMode,
  projectOpenLoops,
  projectPatternInterrupts,
  projectResearchMode,
  projectRevealMoments,
  projectTensionMap,
  type LookMode,
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
  /** Commits the open project; resolves true when a commit was made. */
  readonly commit: (message: string) => Promise<boolean>;
  /** Available looks of the kit registry. */
  readonly looks: () => readonly LookSummary[];
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
  return `Project settings: ${parts.length === 0 ? 'no change' : parts.join(', ')}`;
}

function sameSettings(left: ProjectSettings, right: ProjectSettings): boolean {
  return (
    left.lookMode === right.lookMode &&
    left.ambientVariation === right.ambientVariation &&
    left.researchMode === right.researchMode &&
    left.researchSources.join(',') === right.researchSources.join(',') &&
    left.tensionMap === right.tensionMap &&
    DRAMATURGY_KEYS.every((key) => left[key] === right[key]) &&
    EDITING_KEYS.every((key) => left[key] === right[key])
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
    return {
      status: 'ok',
      settings: effectiveProjectSettings(loaded.project),
      looks: [...this.options.looks()],
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
    const committed = await this.options.commit(message);
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
