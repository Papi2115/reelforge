/**
 * Pipeline stages (PLAN.md §3) and how they depend on each other. `export` is run by the
 * pipeline package, but it takes part in gating and invalidation here.
 */

export const PIPELINE_STAGES = [
  'script',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'scenes',
  'sound-cues',
  'mix',
  'export',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Stages this package runs. */
export const STAGE_IDS = [
  'script',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'scenes',
  'sound-cues',
  'mix',
] as const;
export type StageId = (typeof STAGE_IDS)[number];

export function isStageId(value: string): value is StageId {
  return (STAGE_IDS as readonly string[]).includes(value);
}

/** UI names (PLAN.md §3 / the reference app's pipeline list). */
export const STAGE_TITLES: Readonly<Record<PipelineStage, string>> = {
  script: 'Script',
  voiceover: 'Voiceover',
  clean: 'Audio cleaned',
  words: 'Words timed',
  storyboard: 'Storyboard',
  scenes: 'Scenes built',
  'sound-cues': 'Sound cues',
  mix: 'Sound design mixed',
  export: 'Video exported',
};

/** Stages whose output a stage reads (gating: they must not be stale or running). */
export const STAGE_UPSTREAM: Readonly<Record<PipelineStage, readonly PipelineStage[]>> = {
  script: [],
  voiceover: [],
  clean: ['voiceover'],
  words: ['voiceover', 'script'],
  storyboard: ['script', 'words'],
  scenes: ['storyboard'],
  'sound-cues': ['storyboard', 'words'],
  mix: ['clean', 'sound-cues'],
  export: ['scenes', 'mix'],
};

/** Every stage that (transitively) reads `stage`'s output, in pipeline order. */
export function downstreamOf(stage: PipelineStage): PipelineStage[] {
  const found = new Set<PipelineStage>();
  const visit = (current: PipelineStage): void => {
    for (const candidate of PIPELINE_STAGES) {
      if (!STAGE_UPSTREAM[candidate].includes(current) || found.has(candidate)) continue;
      found.add(candidate);
      visit(candidate);
    }
  };
  visit(stage);
  return PIPELINE_STAGES.filter((candidate) => found.has(candidate));
}
