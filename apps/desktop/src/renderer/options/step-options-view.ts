/**
 * The inspector idea of 3.0 (docs/ux/redesign-2.4.md, "Answers" 1): opening a pipeline step shows
 * everything it offers and everything that can be changed for it. Each step's panel keeps its own
 * controls, and its "All options" section hosts the project.json option rows that steer the step
 * (the same row components as Project settings, option-registry.ts). Pure.
 *
 * What each step shows (panel controls · All options rows):
 * - Script: brief, script editor, sources, Hook lab, approve · none here
 * - Voiceover: import, record, replace, fit to the script, generated sentences (redo; after a redo
 *   "Voice changed — timing out of date" + Re-time) · none
 * - Audio cleaned: the cleaned file · none
 * - Words timed: the timed words · none
 * - Storyboard: Hook lab, the Shots panel · scenes per minute + faster checks, dramaturgy
 *   (interrupts, open loops, reveal moments), continuity links, tension map
 * - Assets: asset package review, your files, downloaded assets, library · none here (research
 *   mode stays in Project settings → Research)
 * - Scenes built: build progress, look assets (world styles only: status, findings, designed
 *   names, Design / Redo look assets), final review, a pointer to the Director (story beats and
 *   editing moved there), sync report ·
 *   look mode, ambient variation, continuity links, people and mascot, editing (beat sync,
 *   repetition control), scenes per minute + faster checks
 * - Sound design mixed: actions, monitor (full mix / voice only), mix report, cue summary, levels,
 *   sound library, music ducking · editing (beat sync, repetition control), tension map, the sound
 *   palette per look (read-only)
 * - Video exported: the export dialog (quality, encoder, queue, publish kit, YouTube) · none
 */
import type { OptionRowId } from '../project/project-settings-view.js';

export const STEP_IDS = [
  'script',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'assets',
  'scenes',
  'sound',
  'export',
] as const;
export type StepId = (typeof STEP_IDS)[number];

/** The option rows of each step's "All options" section, in display order (none: no section). */
export const STEP_OPTION_ROWS: Readonly<Record<StepId, readonly OptionRowId[]>> = {
  script: [],
  voiceover: [],
  clean: [],
  words: [],
  storyboard: ['scene-count', 'dramaturgy', 'continuity-links', 'tension-map'],
  assets: [],
  scenes: [
    'look-mode',
    'ambient-variation',
    'continuity-links',
    'characters',
    'mascot',
    'editing',
    'scene-count',
  ],
  sound: ['editing', 'tension-map', 'sound-palette'],
  export: [],
};

export function isStepId(id: string): id is StepId {
  return (STEP_IDS as readonly string[]).includes(id);
}

/** The rows of a pipeline row's step (`PipelineRowSpec.id`); unknown ids have none. */
export function stepOptionRows(stepId: string): readonly OptionRowId[] {
  return isStepId(stepId) ? STEP_OPTION_ROWS[stepId] : [];
}

export const OPTIONS_TITLE = 'All options';

/** The section's one-line summary: where the changes go. */
export const OPTIONS_SUMMARY = 'same as Project settings';

/** Footer line of the section: saving now, or where the last change went. */
export function optionsStatus(pending: number): string {
  return pending > 0 ? 'Saving…' : 'Saved automatically to the project and its history.';
}
