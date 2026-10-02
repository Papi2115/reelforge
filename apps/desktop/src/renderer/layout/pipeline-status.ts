/**
 * Pipeline stage status from the files present in the project (PLAN.md#6.3). A stub until the
 * pipeline runner (6.8) reports real state: a stage is done when its output file exists, ready
 * when every earlier stage is done, otherwise waiting for the first unfinished earlier stage.
 */

export const PIPELINE_STAGES = [
  { id: 'script', label: 'Script written', output: /^script\.txt$/i },
  { id: 'voiceover', label: 'Voiceover added', output: /^audio\/vo\.original\.[^/]+$/i },
  { id: 'audio-clean', label: 'Audio cleaned', output: /^audio\/vo\.clean\.wav$/i },
  { id: 'words', label: 'Words timed', output: /^timing\/words\.json$/i },
  { id: 'storyboard', label: 'Storyboard', output: /^storyboard\.json$/i },
  { id: 'scenes', label: 'Scenes built', output: /^scenes\/[^/]+\.js$/i },
  { id: 'sound', label: 'Sound design mixed', output: /^audio\/mix\.wav$/i },
  { id: 'export', label: 'Video exported', output: /^out\/[^/]+\.mp4$/i },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]['id'];
export type StageStatus = 'done' | 'ready' | 'waiting';

export interface StageView {
  readonly id: StageId;
  readonly label: string;
  readonly status: StageStatus;
  /** Label of the first unfinished earlier stage (status `waiting` only). */
  readonly waitingFor: string | undefined;
}

/** `projectFiles`: project-relative paths with forward slashes. */
export function computePipelineStatus(projectFiles: readonly string[]): StageView[] {
  let firstUnfinished: string | undefined;
  return PIPELINE_STAGES.map((stage) => {
    const done = projectFiles.some((file) => stage.output.test(file));
    const view: StageView = {
      id: stage.id,
      label: stage.label,
      status: done ? 'done' : firstUnfinished === undefined ? 'ready' : 'waiting',
      waitingFor: done ? undefined : firstUnfinished,
    };
    if (!done) firstUnfinished ??= stage.label;
    return view;
  });
}
