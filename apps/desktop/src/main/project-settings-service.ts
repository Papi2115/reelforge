/**
 * Per-project settings (the "Project settings" dialog): reads the open project's raw
 * `project.json`, applies a patch, validates the result with the shared `projectFileSchema`
 * (unknown keys survive), writes it atomically (tmp + rename) and commits the project
 * (`ReelForge-Kind: manual`, step `project-settings`). Changes run one at a time.
 *
 * Invalidation: the settings only steer FUTURE builds (look mode: the next storyboard / scene
 * build / sound cues; ambient variation: the render manifest, so the preview and the next export).
 * No pipeline step is marked out of date.
 */
import path from 'node:path';
import { writeJsonAtomic } from '@reelforge/project';
import {
  projectAmbientVariation,
  projectFileSchema,
  projectLookMode,
  type LookMode,
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
  return next;
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
  return `Project settings: ${parts.length === 0 ? 'no change' : parts.join(', ')}`;
}

function sameSettings(left: ProjectSettings, right: ProjectSettings): boolean {
  return left.lookMode === right.lookMode && left.ambientVariation === right.ambientVariation;
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
