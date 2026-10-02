/**
 * Project-relative files the stages read and write (PLAN.md §3.1). Relative paths use `/`; they
 * are joined with `path.join` before touching the disk (Windows-safe).
 */
import path from 'node:path';
import type { VoiceoverExtension } from '@reelforge/shared';
import type { PipelineStage } from './ids.js';

export const FILES = {
  project: 'project.json',
  brief: 'brief.json',
  research: 'research.md',
  beats: 'beats.md',
  script: 'script.txt',
  voClean: 'audio/vo.clean.wav',
  mix: 'audio/mix.wav',
  musicDir: 'audio/music',
  wordsRaw: 'timing/words.raw.json',
  words: 'timing/words.json',
  storyboard: 'storyboard.json',
  cues: 'cues.json',
  scenesDir: 'scenes',
  /** App state (git-ignored). */
  voiceoverRecord: '.reelforge/voiceover.json',
  asrWorkDir: '.reelforge/cache/asr',
  mixWorkDir: '.reelforge/cache/mix',
  /** Stems of the last mix render with stems (git-ignored like every export). */
  stemsDir: 'out/stems',
  /** Per-shot build/QA result (✓ ⚠ ✗) and the sync report (PLAN.md#7.4, #7.7). */
  scenesReport: '.reelforge/scenes-report.json',
  syncReport: '.reelforge/sync-report.json',
  /** Contact sheets the critic and the review read (next to the CLI's frames, readable). */
  qaFramesDir: '.reelforge/frames/qa',
} as const;

export const REPORTS = {
  script: '.reelforge/reports/script.json',
  voiceover: '.reelforge/reports/voiceover.json',
  clean: '.reelforge/reports/clean.json',
  words: '.reelforge/reports/words.json',
  storyboard: '.reelforge/reports/storyboard.json',
  mix: '.reelforge/reports/mix.json',
} as const;

export function voiceoverOriginal(extension: VoiceoverExtension): string {
  return `audio/vo.original.${extension}`;
}

export function voiceoverPrevious(extension: VoiceoverExtension): string {
  return `audio/vo.original.prev.${extension}`;
}

/** Absolute path of a project-relative file. */
export function inProject(projectDir: string, relative: string): string {
  return path.join(projectDir, ...relative.split('/'));
}

/** Files a stage writes (what "has outputs" means for invalidation; `scenes` = any scene file). */
export const STAGE_OUTPUT_FILES: Readonly<Record<PipelineStage, readonly string[]>> = {
  script: [FILES.research, FILES.beats, FILES.script],
  voiceover: [],
  clean: [FILES.voClean],
  words: [FILES.wordsRaw, FILES.words],
  storyboard: [FILES.storyboard],
  scenes: [],
  'sound-cues': [FILES.cues],
  mix: [FILES.mix],
  export: [],
};
