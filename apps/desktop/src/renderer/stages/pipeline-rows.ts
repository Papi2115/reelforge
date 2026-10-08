/**
 * The rows of the pipeline sidebar (pipeline-view.ts builds their views): the eight rows of the
 * reference app plus the optional Assets row, the runner stages behind each, what Open opens, and
 * the stage names used in sentences.
 */
import type {
  PipelineStageKey,
  ReplaceableStage,
  StageArtifact,
} from '../../shared/stages-contract.js';

export type OpenTarget =
  | { readonly kind: 'script' }
  | { readonly kind: 'voiceover' }
  | { readonly kind: 'words' }
  | { readonly kind: 'shots' }
  | { readonly kind: 'assets' }
  | { readonly kind: 'scenes' }
  | { readonly kind: 'sound' }
  | { readonly kind: 'export' }
  | { readonly kind: 'artifact'; readonly artifact: StageArtifact };

export interface PipelineRowSpec {
  readonly id: string;
  readonly label: string;
  /** Runner stages behind the row, in the order Run executes them. */
  readonly stages: readonly PipelineStageKey[];
  readonly open: OpenTarget;
  readonly replace: ReplaceableStage | null;
  /** Shown while the app cannot run the row's stage yet. */
  readonly coming: string;
  /** Listed only when main reports its stage (Assets: research on and needed, PLAN.md#12.10). */
  readonly optional?: boolean;
}

export const PIPELINE_ROWS: readonly PipelineRowSpec[] = [
  {
    id: 'script',
    label: 'Script written',
    stages: ['script'],
    open: { kind: 'script' },
    replace: 'script',
    coming: '',
  },
  {
    id: 'voiceover',
    label: 'Voiceover added',
    stages: ['voiceover'],
    open: { kind: 'voiceover' },
    replace: 'voiceover',
    coming: '',
  },
  {
    id: 'clean',
    label: 'Audio cleaned',
    stages: ['clean'],
    open: { kind: 'artifact', artifact: 'clean' },
    replace: null,
    coming: '',
  },
  {
    id: 'words',
    label: 'Words timed',
    stages: ['words'],
    open: { kind: 'words' },
    replace: null,
    coming: '',
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    stages: ['storyboard'],
    open: { kind: 'shots' },
    replace: null,
    coming: '',
  },
  {
    id: 'assets',
    label: 'Assets',
    stages: ['assets'],
    open: { kind: 'assets' },
    replace: null,
    coming: '',
    optional: true,
  },
  {
    id: 'scenes',
    label: 'Scenes built',
    stages: ['scenes'],
    open: { kind: 'scenes' },
    replace: null,
    coming: '',
  },
  {
    id: 'sound',
    label: 'Sound design mixed',
    stages: ['sound-cues', 'mix'],
    open: { kind: 'sound' },
    replace: null,
    coming: '',
  },
  {
    id: 'export',
    label: 'Video exported',
    stages: ['export'],
    open: { kind: 'export' },
    replace: null,
    coming: '',
  },
];

/** Stage names in sentences (same as the runner's titles). */
export const STAGE_LABELS: Readonly<Record<PipelineStageKey, string>> = {
  script: 'Script',
  voiceover: 'Voiceover',
  clean: 'Audio cleaned',
  words: 'Words timed',
  storyboard: 'Storyboard',
  assets: 'Assets',
  scenes: 'Scenes built',
  'sound-cues': 'Sound cues',
  mix: 'Sound design mixed',
  export: 'Video exported',
};
