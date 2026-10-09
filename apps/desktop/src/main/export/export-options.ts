/**
 * What the export dialog offers and accepts (PLAN.md#9.1): every preset with its integer scale
 * factor from the style's render size (a preset that is not a whole multiple is blocked with the
 * pipeline's explanation), the last choices, the output folder and file name, chapters and the
 * default thumbnail frame, blockers (nothing to render yet) and warnings (silent video, stale
 * mix). `validateJob` re-checks a request in main before it is queued.
 */
import path from 'node:path';
import { findStylePreset } from '@reelforge/engine';
import {
  EXPORT_PRESET_IDS,
  orientedPreset,
  resolveOutputScale,
  safeOutputName,
} from '@reelforge/pipeline';
import {
  orientFrameSize,
  projectFileSchema,
  storyboardFileSchema,
  videoFormatOf,
  type AppSettings,
  type StoryboardShot,
} from '@reelforge/shared';
import { FILES } from '@reelforge/stages';
import type {
  ExportJobRequest,
  ExportOptions,
  PresetOption,
} from '../../shared/export-contract.js';
import { readProjectJson, readProjectText } from '../project-files.js';
import { projectChapters } from './export-chapters.js';

/** Presets with their factor for a `width`×`height` render (null factor = blocked). */
export function presetOptions(width: number, height: number): PresetOption[] {
  return EXPORT_PRESET_IDS.map((id) => {
    const preset = orientedPreset(id, width, height);
    const scale = resolveOutputScale(id, width, height);
    return {
      id,
      label: preset.label,
      width: preset.width,
      height: preset.height,
      factor: scale.ok ? scale.value.factor : null,
      problem: scale.ok ? null : scale.error.message,
    };
  });
}

/** `<safe name>.mp4` from what the user typed (a trailing .mp4 is kept once). */
export function outputFileName(typed: string): string {
  const stem = typed.trim().replace(/\.mp4$/i, '');
  return `${safeOutputName(stem)}.mp4`;
}

export function outputFolder(dir: string, settings: AppSettings): string {
  return settings.export.outputDir ?? path.join(dir, 'out');
}

/** Why a request cannot be queued (null = fine). */
export function validateJob(request: ExportJobRequest, options: ExportOptions): string | null {
  if (options.blockers.length > 0) return options.blockers.join(' ');
  const preset = options.presets.find((candidate) => candidate.id === request.preset);
  if (preset === undefined) return `Unknown preset ${request.preset}.`;
  if (preset.factor === null) return preset.problem ?? `${preset.label} does not fit this style.`;
  if (request.workers > options.cores) {
    return `${String(request.workers)} workers is more than this machine's ${String(options.cores)} cores.`;
  }
  return null;
}

async function exists(dir: string, relative: string): Promise<boolean> {
  return (await readProjectText(dir, relative)).status === 'ok';
}

async function sceneProblems(dir: string, shots: readonly StoryboardShot[]): Promise<string[]> {
  const missing: string[] = [];
  for (const shot of shots) {
    if (!(await exists(dir, shot.scene))) missing.push(shot.id);
  }
  return missing.length === 0
    ? []
    : [`Scenes missing for ${missing.join(', ')}: run Scenes built first.`];
}

export interface ExportOptionsInput {
  readonly dir: string;
  readonly settings: AppSettings;
  readonly cores: number;
  /** cues.json changed after the last mix render, or the stage is marked stale. */
  readonly mixStale: boolean;
  readonly hasMix: boolean;
}

/** The dialog's options for the open project. */
export async function exportOptions(input: ExportOptionsInput): Promise<ExportOptions> {
  const { dir, settings } = input;
  const [project, storyboard] = await Promise.all([
    readProjectJson(dir, FILES.project, projectFileSchema),
    readProjectJson(dir, FILES.storyboard, storyboardFileSchema),
  ]);
  const title = project.status === 'ok' ? project.data.title : path.basename(dir);
  const style = project.status === 'ok' ? findStylePreset(project.data.style) : undefined;
  // A portrait project (PLAN.md#13.18) renders the style upright and exports 9:16.
  const render =
    project.status === 'ok' && style !== undefined
      ? {
          ...orientFrameSize(style.resolution, videoFormatOf(project.data)),
          style: style.id,
        }
      : null;
  const shots = storyboard.status === 'ok' ? storyboard.data.shots : [];
  const durationS = shots.at(-1)?.t1 ?? 0;
  const blockers: string[] = [];
  if (render === null) blockers.push('project.json is missing or names an unknown style.');
  if (storyboard.status !== 'ok') blockers.push('No storyboard yet: run Storyboard first.');
  else blockers.push(...(await sceneProblems(dir, shots)));
  const warnings: string[] = [];
  if (!input.hasMix) warnings.push(`No ${FILES.mix}: the video will be silent (Render mix first).`);
  else if (input.mixStale) warnings.push('The cues changed after the last mix render.');
  const chapters =
    shots.length === 0
      ? { problem: 'No storyboard yet.' }
      : await projectChapters(dir, shots, durationS);
  const first = shots[0];
  return {
    projectDir: dir,
    title,
    defaultFileName: outputFileName(title),
    outputDir: outputFolder(dir, settings),
    customOutputDir: settings.export.outputDir !== null,
    render,
    presets: render === null ? [] : presetOptions(render.width, render.height),
    cores: input.cores,
    defaults: {
      preset: settings.export.preset,
      encoder: settings.performance.encoder,
      quality: settings.export.quality,
      workers: settings.performance.exportWorkers,
      includeChapters: settings.export.includeChapters,
      includeThumbnail: settings.export.includeThumbnail,
    },
    chapters:
      'text' in chapters
        ? { text: chapters.text, problem: null }
        : { text: null, problem: chapters.problem },
    thumbnailDefaultS: first === undefined ? null : (first.t0 + first.t1) / 2,
    blockers,
    warnings,
  };
}

/** The MP4 a typed file name becomes in `folder`; null when it would leave the folder. */
export function outputPath(folder: string, fileName: string): string | null {
  const file = path.resolve(folder, outputFileName(fileName));
  return path.dirname(file) === path.resolve(folder) ? file : null;
}
