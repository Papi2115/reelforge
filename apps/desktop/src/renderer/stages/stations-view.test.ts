import { describe, expect, it } from 'vitest';
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
  type StageInfo,
  type StageRunView,
  type StagesState,
} from '../../shared/stages-contract.js';
import { PIPELINE_ROWS } from './pipeline-view.js';
import {
  emptyStageHint,
  STATION_GLYPHS,
  stationsOf,
  type StationFacts,
  type StationStatus,
  type StationView,
} from './stations-view.js';

function info(stage: PipelineStageKey, patch: Partial<StageInfo> = {}): StageInfo {
  return {
    stage,
    status: null,
    message: null,
    updatedAt: null,
    stale: false,
    staleReason: null,
    interrupted: false,
    approvedAt: null,
    hasOutput: false,
    registered: true,
    runnable: stage !== 'voiceover',
    ready: false,
    reasons: [],
    invalidates: [],
    error: null,
    warnings: [],
    ...patch,
  };
}

type Patches = Partial<Record<PipelineStageKey, Partial<StageInfo>>>;

function state(patches: Patches, extra: Partial<StagesState> = {}): StagesState {
  return {
    projectDir: 'C:\\p',
    // Main reports Assets only when research is on and needed (PLAN.md#12.10).
    stages: PIPELINE_STAGE_KEYS.filter(
      (stage) => stage !== 'assets' || patches.assets !== undefined,
    ).map((stage) => info(stage, patches[stage])),
    running: null,
    queue: [],
    pause: null,
    ...extra,
  };
}

const DONE = { status: 'done', hasOutput: true } as const;
const APPROVED = { ...DONE, approvedAt: '2026-10-02T10:00:00.000Z' } as const;
/** Script approved, voiceover, clean-up, words and storyboard done. */
const PLANNED: Patches = {
  script: APPROVED,
  voiceover: DONE,
  clean: DONE,
  words: DONE,
  storyboard: DONE,
};

const RUNNING: StageRunView = {
  stage: 'words',
  label: 'Transcribing',
  percent: 42.4,
  startedAt: 0,
  paused: null,
  steps: [],
  shots: {},
  action: null,
  targets: null,
};

function scenesFacts(patch: Partial<NonNullable<StationFacts['scenes']>>): StationFacts {
  return { scenes: { planned: 7, built: 7, failed: [], missing: [], ...patch } };
}

function station(views: readonly StationView[], rowId: string): StationView {
  const found = views.find((view) => view.rowId === rowId);
  if (found === undefined) throw new Error(`no station ${rowId}`);
  return found;
}

interface Case {
  readonly name: string;
  readonly patches: Patches;
  readonly extra?: Partial<StagesState>;
  readonly facts?: StationFacts;
  readonly row: string;
  readonly status: StationStatus;
  readonly word: string;
  readonly sentence: string | RegExp;
}

const CASES: readonly Case[] = [
  {
    name: 'a new project: the brief is the user’s turn',
    patches: { script: { reasons: ['brief.json is missing: fill in the brief.'] } },
    row: 'script',
    status: 'needs-you',
    word: 'Needs you',
    sentence: 'Describe your video in a few sentences (the brief), then write the script.',
  },
  {
    name: 'a new project: the voiceover needs an approved script (no waiting text)',
    patches: { script: { reasons: ['brief.json is missing: fill in the brief.'] } },
    row: 'voiceover',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: an approved script.',
  },
  {
    name: 'a new project: the export needs the sound mix',
    patches: {},
    row: 'export',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: the sound mix.',
  },
  {
    name: 'script approved: recording is the user’s turn',
    patches: { script: APPROVED },
    row: 'voiceover',
    status: 'needs-you',
    word: 'Needs you',
    sentence: 'Record your voiceover (read the approved script) or import a file.',
  },
  {
    name: 'a runnable step is Ready with its outcome',
    patches: { script: APPROVED, voiceover: DONE, clean: { ready: true } },
    row: 'clean',
    status: 'ready',
    word: 'Ready',
    sentence: 'Clean up the voiceover audio.',
  },
  {
    name: 'a missing file becomes the thing it needs, without the file name',
    patches: { storyboard: { reasons: ['timing/words.json is missing: run Words timed first.'] } },
    row: 'storyboard',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: timed words.',
  },
  {
    name: 'no voiceover yet: Needs your voiceover',
    patches: { clean: { reasons: ['No voice-over imported yet: run Voiceover first.'] } },
    row: 'clean',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: your voiceover.',
  },
  {
    name: 'the asset package review comes before Scenes',
    patches: {
      ...PLANNED,
      assets: { ...DONE, awaitingReview: true },
      scenes: {
        reasons: [
          'An asset package is waiting for your review: open Assets and approve or reject it.',
        ],
      },
    },
    row: 'scenes',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: your review of the asset package.',
  },
  {
    name: 'the asset package itself is the user’s turn',
    patches: { ...PLANNED, assets: { ...DONE, awaitingReview: true } },
    row: 'assets',
    status: 'needs-you',
    word: 'Needs you',
    sentence: 'An asset package is ready. Approve or reject the photos and footage.',
  },
  {
    name: 'an out-of-date input names what has to be made again',
    patches: {
      'sound-cues': {
        reasons: ['Storyboard is out of date (script changed): run it again first.'],
      },
    },
    row: 'sound',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: the storyboard made again (script changed).',
  },
  {
    name: 'a running input is named as being made',
    patches: { script: APPROVED, export: { reasons: ['Scenes built is still running.'] } },
    row: 'export',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: the scenes (being made now).',
  },
  {
    name: 'the script approval is a requirement, not a step to wait for',
    patches: {
      words: { reasons: ['Approve the script first (Script written → Open → Approve script).'] },
    },
    row: 'words',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: your approval of the script.',
  },
  {
    name: 'an unknown reason falls back to the nearest unfinished step',
    patches: { script: APPROVED, export: { reasons: ['Something else.'] } },
    row: 'export',
    status: 'not-started',
    word: 'Not started',
    sentence: 'Needs: the sound mix.',
  },
  {
    name: 'a written script waits for the approval',
    patches: { script: DONE },
    row: 'script',
    status: 'needs-you',
    word: 'Needs you',
    sentence: 'The script is written. Read it and approve it.',
  },
  {
    name: 'running: Working with the percent and the current step',
    patches: { script: APPROVED },
    extra: { running: RUNNING },
    row: 'words',
    status: 'working',
    word: 'Working · 42 %',
    sentence: 'Transcribing.',
  },
  {
    name: 'paused by the usage limit is a Working variant with the resume time',
    patches: { script: APPROVED },
    extra: { running: { ...RUNNING, paused: { until: Date.UTC(2026, 9, 3, 12, 5), message: '' } } },
    row: 'words',
    status: 'working',
    word: 'Paused',
    sentence: /^Paused by your Claude usage limit — resumes at \S/,
  },
  {
    name: 'paused without a known end says where to resume',
    patches: { script: APPROVED },
    extra: { running: { ...RUNNING, paused: { until: null, message: '' } } },
    row: 'words',
    status: 'working',
    word: 'Paused',
    sentence: 'Paused by your Claude usage limit. Resume it from the chat.',
  },
  {
    name: 'queued is a Working variant with its place in line',
    patches: { script: APPROVED },
    extra: { queue: ['storyboard'] },
    row: 'storyboard',
    status: 'working',
    word: 'Queued',
    sentence: 'Starts when the running step finishes (#1 in line).',
  },
  {
    name: 'stopped when the app closed is a Working variant that keeps the old result',
    patches: { script: APPROVED, storyboard: { interrupted: true, hasOutput: true } },
    row: 'storyboard',
    status: 'working',
    word: 'Stopped',
    sentence: 'The result from before is kept. Stopped when the app closed. Resume continues it.',
  },
  {
    name: 'failed with nothing usable: Failed, with the translated cause and the retry',
    patches: {
      script: APPROVED,
      voiceover: DONE,
      clean: { status: 'failed', error: { kind: 'tool', message: 'ffmpeg exit 1', issues: [] } },
    },
    row: 'clean',
    status: 'failed',
    word: 'Failed',
    sentence: 'Nothing usable came out. The audio or video tool stopped with an error. Retry.',
  },
  {
    name: 'failed next to usable output: Built with problems, never Failed',
    patches: {
      ...PLANNED,
      words: {
        status: 'failed',
        hasOutput: true,
        error: { kind: 'limit', message: 'rate_limit_error 429', issues: [] },
      },
    },
    row: 'words',
    status: 'problems',
    word: 'Built with problems',
    sentence:
      'The result from before is kept. The last run failed: your Claude usage limit was reached. Retry.',
  },
  {
    name: 'Papi’s case: the scenes run failed with a full shot list',
    patches: { ...PLANNED, scenes: { status: 'failed', hasOutput: true } },
    facts: scenesFacts({
      built: 6,
      failed: [{ id: 's02', cause: 'blank frames' }],
      missing: ['s02'],
    }),
    row: 'scenes',
    status: 'problems',
    word: 'Built with problems',
    sentence: '6 of 7 scenes built. s02 failed: blank frames. Retry s02.',
  },
  {
    name: 'a finished build with a failed shot points at the single rebuild',
    patches: { ...PLANNED, scenes: DONE },
    facts: scenesFacts({ failed: [{ id: 's03', cause: 'the scene does not run' }] }),
    row: 'scenes',
    status: 'problems',
    word: 'Built with problems',
    sentence:
      '7 of 7 scenes built. s03 failed: the scene does not run. Rebuild s03 from the Shots list.',
  },
  {
    name: 'a finished build with a missing scene says which one',
    patches: { ...PLANNED, scenes: DONE },
    facts: scenesFacts({ built: 6, missing: ['s07'] }),
    row: 'scenes',
    status: 'problems',
    word: 'Built with problems',
    sentence: '6 of 7 scenes built. s07 not built. Build s07 from the Shots list.',
  },
  {
    name: 'a planned build counts the scenes',
    patches: { ...PLANNED, scenes: { ready: true } },
    facts: scenesFacts({ built: 0, missing: ['s01'] }),
    row: 'scenes',
    status: 'ready',
    word: 'Ready',
    sentence: 'Build 7 scenes.',
  },
  {
    name: 'out of date says what changed and the one action',
    patches: {
      script: APPROVED,
      voiceover: DONE,
      clean: DONE,
      words: DONE,
      storyboard: { ...DONE, stale: true, staleReason: 'script changed' },
    },
    row: 'storyboard',
    status: 'out-of-date',
    word: 'Out of date',
    sentence: 'Made before a change (script changed). Run it again.',
  },
  {
    name: 'Words done under Voice waiting: Kept from before',
    patches: { script: APPROVED, clean: DONE, words: DONE },
    row: 'words',
    status: 'done',
    word: 'Kept from before',
    sentence: 'Kept from before: it updates after the voiceover. Every word timed.',
  },
  {
    name: 'a storyboard under an unapproved script is kept from before',
    patches: { script: DONE, words: DONE, storyboard: DONE },
    row: 'storyboard',
    status: 'done',
    word: 'Kept from before',
    sentence: 'Kept from before: it updates after the script. Shots planned.',
  },
  {
    name: 'done shows what the run reported',
    patches: { ...PLANNED, scenes: { ...DONE, message: 'Review done: 7 ✓' } },
    row: 'scenes',
    status: 'done',
    word: 'Done',
    sentence: 'Review done: 7 ✓.',
  },
  {
    name: 'done without a report says what exists',
    patches: { script: APPROVED },
    row: 'script',
    status: 'done',
    word: 'Done',
    sentence: 'Script approved.',
  },
];

describe('stations (status model v2)', () => {
  it.each(CASES)('$name', (testCase) => {
    const views = stationsOf(state(testCase.patches, testCase.extra), testCase.facts);
    const view = station(views, testCase.row);
    expect(view.status).toBe(testCase.status);
    expect(view.word).toBe(testCase.word);
    if (typeof testCase.sentence === 'string') expect(view.sentence).toBe(testCase.sentence);
    else expect(view.sentence).toMatch(testCase.sentence);
    expect(view.glyph).toBe(STATION_GLYPHS[testCase.status]);
    expect(view.kept).toBe(testCase.word === 'Kept from before');
  });

  it('never says Failed beside usable output, never "Waiting for", always a sentence', () => {
    for (const testCase of CASES) {
      const current = state(testCase.patches, testCase.extra);
      for (const view of stationsOf(current, testCase.facts)) {
        expect(view.sentence, `${testCase.name} / ${view.rowId}`).not.toMatch(/Waiting for/);
        expect(view.word).not.toMatch(/Waiting/);
        expect(view.sentence).not.toMatch(/\.json|\.wav/);
        if (view.status === 'failed') {
          const stages = PIPELINE_ROWS.find((spec) => spec.id === view.rowId)?.stages ?? [];
          const usable = current.stages.some(
            (stage) => stage.hasOutput && stages.includes(stage.stage),
          );
          expect(usable, `${testCase.name} / ${view.rowId}`).toBe(false);
        }
      }
    }
  });

  it('reads the project while there is no state yet', () => {
    const views = stationsOf(undefined);
    expect(views.map((view) => view.word)).toEqual(Array<string>(views.length).fill('…'));
    expect(views.every((view) => view.status === null && view.css === 'loading')).toBe(true);
  });

  it('keeps the square-dot colour classes of the rows', () => {
    const views = stationsOf(state({ script: DONE, words: DONE, storyboard: DONE }));
    expect(station(views, 'script').css).toBe('review');
    expect(station(views, 'voiceover').css).toBe('waiting');
    expect(station(views, 'storyboard').css).toBe('kept');
  });
});

describe('the empty stage hint', () => {
  it('suggests the next step for the empty preview', () => {
    expect(emptyStageHint(state({}))).toBe(
      'Describe the video in the brief, then write the script.',
    );
    expect(emptyStageHint(undefined)).toBeUndefined();
  });
});
