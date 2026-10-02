/**
 * What the gating rules look at: which stage files exist, the parsed project.json / brief.json,
 * the imported voice-over, the persisted stage states (pipeline.json) and the clean report's
 * silence shortening (which decides what audio the words stage transcribes).
 */
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { CleanReportSchema } from '@reelforge/pipeline';
import {
  VOICEOVER_EXTENSIONS,
  briefFileSchema,
  projectFileSchema,
  type BriefFile,
  type PipelinePause,
  type ProjectFile,
  type StageState,
  type VoiceoverExtension,
} from '@reelforge/shared';
import type { z } from 'zod';
import { FILES, REPORTS, STAGE_OUTPUT_FILES, inProject, voiceoverOriginal } from './paths.js';

export type Loaded<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly message: string };

export interface ProjectSnapshot {
  readonly projectDir: string;
  readonly project: Loaded<ProjectFile>;
  readonly brief: Loaded<BriefFile>;
  /** Project-relative stage files that exist (see `TRACKED_FILES`). */
  readonly files: ReadonlySet<string>;
  /** `audio/vo.original.<ext>` when a voice-over was imported. */
  readonly voiceover: { readonly file: string; readonly extension: VoiceoverExtension } | undefined;
  /** Seconds of pauses the clean stage cut (0 when none / not cleaned). */
  readonly silenceRemovedS: number;
  readonly hasSceneFiles: boolean;
  readonly stages: Readonly<Record<string, StageState>>;
  readonly pause: PipelinePause | undefined;
}

export const TRACKED_FILES: readonly string[] = [
  ...new Set([...Object.values(STAGE_OUTPUT_FILES).flat(), FILES.brief, REPORTS.clean]),
];

export async function loadJson<T>(file: string, schema: z.ZodType<T>): Promise<Loaded<T>> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { status: 'missing' };
    }
    return { status: 'invalid', message: error instanceof Error ? error.message : String(error) };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { status: 'invalid', message: error instanceof Error ? error.message : String(error) };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { status: 'ok', value: parsed.data };
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`,
  );
  return { status: 'invalid', message: issues.slice(0, 3).join('; ') };
}

function findVoiceover(projectDir: string): ProjectSnapshot['voiceover'] {
  for (const extension of VOICEOVER_EXTENSIONS) {
    const file = voiceoverOriginal(extension);
    if (existsSync(inProject(projectDir, file))) return { file, extension };
  }
  return undefined;
}

async function hasSceneFiles(projectDir: string): Promise<boolean> {
  try {
    const entries = await readdir(inProject(projectDir, FILES.scenesDir));
    return entries.some((name) => name.endsWith('.js'));
  } catch {
    return false; // no scenes/ folder yet
  }
}

export async function readProjectSnapshot(
  projectDir: string,
  store: PipelineStateStore = new PipelineStateStore(),
): Promise<ProjectSnapshot> {
  const [project, brief, cleanReport, state, scenes] = await Promise.all([
    loadJson(inProject(projectDir, FILES.project), projectFileSchema),
    loadJson(inProject(projectDir, FILES.brief), briefFileSchema),
    loadJson(inProject(projectDir, REPORTS.clean), CleanReportSchema),
    store.read(projectDir),
    hasSceneFiles(projectDir),
  ]);
  const files = new Set(TRACKED_FILES.filter((file) => existsSync(inProject(projectDir, file))));
  return {
    projectDir,
    project,
    brief,
    files,
    voiceover: findVoiceover(projectDir),
    silenceRemovedS:
      cleanReport.status === 'ok' ? Math.max(0, cleanReport.value.silence?.removedS ?? 0) : 0,
    hasSceneFiles: scenes,
    stages: state.ok ? state.value.stages : {},
    pause: state.ok ? state.value.pause : undefined,
  };
}
