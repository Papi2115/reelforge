import { DEFAULT_REPETITION_THRESHOLDS, type WordsReport } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { assetsStateSchema, type AssetsState } from '../../shared/assets-contract.js';
import { dramaturgyStateSchema, type DramaturgyState } from '../../shared/dramaturgy-contract.js';
import { editingStateSchema, type EditingState } from '../../shared/editing-contract.js';
import { claimsStateSchema, type ClaimsState } from '../../shared/publish-contract.js';
import {
  PIPELINE_STAGE_KEYS,
  type PipelineStageKey,
  type StageInfo,
  type StagesState,
} from '../../shared/stages-contract.js';
import {
  attentionAnnouncement,
  attentionItems,
  attentionLabel,
  type AttentionInput,
  type AttentionItem,
} from './attention-view.js';
import type { PreflightItem } from './final-review-view.js';

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

function state(patches: Patches): StagesState {
  return {
    projectDir: 'C:\\p',
    stages: PIPELINE_STAGE_KEYS.filter(
      (stage) => stage !== 'assets' || patches.assets !== undefined,
    ).map((stage) => info(stage, patches[stage])),
    running: null,
    queue: [],
    pause: null,
  };
}

const DONE = { status: 'done', hasOutput: true } as const;
const APPROVED = { ...DONE, approvedAt: '2026-10-02T10:00:00.000Z' } as const;
/** Every step done, the video exported. */
const FINISHED: Patches = Object.fromEntries(
  PIPELINE_STAGE_KEYS.filter((stage) => stage !== 'assets').map((stage) => [
    stage,
    stage === 'script' ? APPROVED : DONE,
  ]),
);

function items(input: Partial<AttentionInput>): AttentionItem[] {
  return attentionItems({ state: state(FINISHED), ...input });
}

function ids(list: readonly AttentionItem[]): string[] {
  return list.map((item) => item.id);
}

function only(list: readonly AttentionItem[]): AttentionItem {
  expect(list).toHaveLength(1);
  const [item] = list;
  if (item === undefined) throw new Error('no item');
  return item;
}

function flagged(shotId: string, patch: Partial<PreflightItem> = {}): PreflightItem {
  return {
    shotId,
    status: 'warning',
    symbol: '⚠',
    locked: false,
    t: 4.5,
    text: 'phone: the caption is small',
    blocking: false,
    ...patch,
  };
}

function words(coverage: number): WordsReport {
  return {
    version: 1,
    audio: 'audio/voiceover.clean.wav',
    lang: 'en',
    attempts: [
      { model: 'base', beamSize: null, temperature: null, coverage, loop: false, error: null },
    ],
    chosen: 0,
    coverage,
    mismatches: [],
    warnings: [],
  };
}

function assets(packages: readonly (readonly [number, number])[]): AssetsState {
  return assetsStateSchema.parse({
    status: 'ok',
    mode: 'ask',
    sources: [],
    assets: [],
    pending: packages.map(([number, count]) => ({
      number,
      createdAt: '2026-10-06T10:00:00.000Z',
      items: Array.from({ length: count }, (_, index) => ({
        key: `wikimedia:${String(number)}-${String(index)}`,
        kind: 'image',
        title: 'Photo',
        author: 'Someone',
        source: 'wikimedia',
        sourceUrl: null,
        licence: { id: 'CC0-1.0', url: null, verified: true },
        width: 640,
        height: 360,
        thumbnail: null,
      })),
    })),
    credits: { markdown: '', scope: 'all', count: 0 },
    problem: null,
  });
}

function claims(statuses: readonly string[]): ClaimsState {
  return claimsStateSchema.parse({
    status: 'ok',
    file: {
      version: 1,
      sources: [{ id: 'r1', kind: 'research', name: 'nasa.gov', url: 'https://nasa.gov' }],
      claims: statuses.map((status, index) => ({
        id: `c${String(index + 1)}`,
        text: 'Light bends.',
        sentence: index,
        kind: 'number',
        sourceIds: status === 'sourced' ? ['r1'] : [],
        status,
      })),
    },
    hasScript: true,
    scriptChanged: false,
    checking: false,
    problem: null,
  });
}

function moment(id: string, status: string) {
  return {
    moment: {
      id,
      kind: 'slow-motion',
      shotId: 's04',
      at: 52,
      word: 'forever',
      tension: 0.92,
      from: 52,
      to: 53.5,
      rate: 0.4,
      status,
    },
    locked: false,
  };
}

function dramaturgy(
  reveal: 'off' | 'auto',
  statuses: readonly string[],
  loopWarnings: readonly string[] = [],
): DramaturgyState {
  return dramaturgyStateSchema.parse({
    status: 'ok',
    switches: { patternInterrupts: 'off', openLoops: 'auto', revealMoments: reveal },
    report: {
      version: 1,
      createdAt: '2026-10-06T10:00:00.000Z',
      source: 'final-review',
      loops: { count: 2, open: loopWarnings.length, warnings: loopWarnings },
    },
    moments: statuses.map((status, index) => moment(`m${String(index)}`, status)),
    momentsNote: null,
  });
}

function repetition(id: string, status: string, text: string) {
  return {
    id,
    kind: 'sfx',
    severity: 'warning',
    subject: 'whoosh',
    text,
    occurrences: [{ t: 12 }, { t: 20 }],
    action: 'sfx',
    changes: [],
    locked: false,
    status,
  };
}

function editing(
  control: 'off' | 'auto',
  entries: readonly ReturnType<typeof repetition>[],
): EditingState {
  return editingStateSchema.parse({
    status: 'ok',
    switches: { beatSync: 'off', repetitionControl: control },
    beatSync: null,
    repetitions: {
      version: 1,
      thresholds: DEFAULT_REPETITION_THRESHOLDS,
      items: entries,
      counts: { visual: 0, template: 0, transition: 0, sfx: entries.length, phrase: 0, open: 0 },
    },
  });
}

describe('attentionItems', () => {
  it('lists nothing for a finished film, and nothing while the project is read', () => {
    expect(items({})).toEqual([]);
    expect(attentionItems({ state: undefined })).toEqual([]);
    expect(attentionLabel(0)).toBe('Needs you: nothing');
  });

  it('a new project: the brief is the user’s turn', () => {
    const item = only(
      attentionItems({ state: state({ script: { reasons: ['brief.json is missing'] } }) }),
    );
    expect(item).toMatchObject({
      id: 'brief',
      group: 'decision',
      button: 'Open the brief',
      target: { kind: 'brief' },
    });
    expect(item.text).toBe(
      'Describe your video in a few sentences (the brief), then write the script.',
    );
  });

  it('a written script waits for the OK: Open the script', () => {
    const item = only(attentionItems({ state: state({ script: DONE }) }));
    expect(item).toMatchObject({
      id: 'script-review',
      subject: 'Script written',
      text: 'The script is written. Read it and approve it.',
      button: 'Open the script',
      target: { kind: 'open', target: { kind: 'script' } },
    });
  });

  it('an approved script: add the voiceover', () => {
    const item = only(attentionItems({ state: state({ script: APPROVED }) }));
    expect(item).toMatchObject({
      id: 'voiceover',
      button: 'Add your voiceover',
      target: { kind: 'open', target: { kind: 'voiceover' } },
    });
  });

  it('an asset package to review: one item from the packages, not the step as well', () => {
    const review = state({ ...FINISHED, assets: { ...DONE, awaitingReview: true } });
    const item = only(attentionItems({ state: review, assets: assets([[2, 3]]) }));
    expect(item).toMatchObject({
      id: 'photos',
      text: 'Asset package 2: 3 photos and clips to approve or reject.',
      button: 'Review photos',
      target: { kind: 'open', target: { kind: 'assets' } },
    });
    const two = only(
      items({
        assets: assets([
          [1, 1],
          [2, 2],
        ]),
      }),
    );
    expect(two.text).toBe('2 asset packages: 3 photos and clips to approve or reject.');
    // Before the packages are read the step itself says it.
    expect(only(attentionItems({ state: review })).text).toBe(
      'An asset package is ready. Approve or reject the photos and footage.',
    );
  });

  it('flagged shots: one item per shot that goes to it; the Scenes step is not listed twice', () => {
    const scenesFailed = state({
      ...FINISHED,
      scenes: {
        status: 'failed',
        hasOutput: true,
        error: { kind: 'claude', message: 'stopped', issues: [] },
      },
    });
    const list = attentionItems({
      state: scenesFailed,
      facts: { scenes: { planned: 7, built: 7, failed: [], missing: [] } },
      shots: [
        flagged('s02', { status: 'failed', symbol: '✗', text: 'scene: does not run (+1 more)' }),
        flagged('s05', { locked: true, t: 21 }),
        flagged('s06', { text: 'needs a look' }),
      ],
    });
    expect(ids(list)).toEqual(['shot:s02', 'shot:s05', 'shot:s06']);
    // The finding's kind in the sentence, the whole finding as the tooltip.
    expect(list[0]).toMatchObject({
      text: '✗ s02 failed: scene (+1 more).',
      detail: 'scene: does not run (+1 more)',
      button: 'Show s02',
      target: { kind: 'shot', shotId: 's02', t: 4.5 },
    });
    expect(list[1]?.text).toBe('⚠ s05 (locked) needs a look: phone.');
    expect(list[2]).toMatchObject({ text: '⚠ s06 needs a look.' });
    expect(list[2]?.detail).toBeUndefined();
  });

  it('a failed or stopped step: Show <step> selects it in the pipeline', () => {
    const failed = state({
      ...FINISHED,
      mix: { status: 'failed', error: { kind: 'tool', message: 'ffmpeg', issues: [] } },
    });
    const item = only(attentionItems({ state: failed }));
    expect(item).toMatchObject({
      id: 'step:sound',
      group: 'problem',
      button: 'Show Sound design mixed',
      target: { kind: 'step', rowId: 'sound' },
    });
    const stopped = state({ ...FINISHED, export: { interrupted: true } });
    expect(ids(attentionItems({ state: stopped }))).toEqual(['step:export']);
  });

  it('word timing without whisper.cpp: one setup item instead of the failure', () => {
    const missing = state({
      ...FINISHED,
      words: { status: 'failed', error: { kind: 'missing-tool', message: 'no', issues: [] } },
    });
    const item = only(attentionItems({ state: missing }));
    expect(item).toMatchObject({
      id: 'whisper',
      button: 'Set up word timing',
      target: { kind: 'step', rowId: 'words' },
    });
  });

  it('a poor words alignment asks for a check; a fair one does not', () => {
    const item = only(items({ words: words(0.7) }));
    expect(item).toMatchObject({
      id: 'alignment',
      group: 'check',
      text: 'Only 70 % of the script was heard in the recording: check the word timing.',
      target: { kind: 'open', target: { kind: 'words' } },
    });
    expect(items({ words: words(0.9) })).toEqual([]);
    expect(items({ words: null })).toEqual([]);
  });

  it('claims without a source open Script → Sources', () => {
    const item = only(items({ claims: claims(['unsourced', 'sourced', 'unsourced']) }));
    expect(item).toMatchObject({
      id: 'claims',
      text: '2 claims in the script have no source.',
      button: 'Open sources',
      target: { kind: 'sources' },
    });
    expect(items({ claims: claims(['sourced', 'user-confirmed']) })).toEqual([]);
  });

  it('wow moments to decide and unanswered questions open the Director on Story beats', () => {
    const list = items({
      dramaturgy: dramaturgy('auto', ['proposed', 'accepted', 'proposed'], ['loop never closed']),
    });
    expect(ids(list)).toEqual(['moments', 'loops']);
    expect(list[0]).toMatchObject({
      text: '2 wow moments to accept or reject.',
      button: 'Open in Director',
      target: { kind: 'director', section: 'beats' },
    });
    expect(list[1]?.text).toBe('1 question in the film is never answered.');
    // Reveal moments switched off: their old proposals do not count.
    expect(items({ dramaturgy: dramaturgy('off', ['proposed']) })).toEqual([]);
  });

  it('open repetitions open the Director on Editing; handled ones disappear', () => {
    const item = only(
      items({
        editing: editing('auto', [
          repetition('r1', 'open', 'whoosh 4× in 30 s (12.0–38.5 s)'),
          repetition('r2', 'applied', 'pop 3×'),
          repetition('r3', 'open', 'crt-zoom 3×'),
        ]),
      }),
    );
    expect(item).toMatchObject({
      text: 'Too much of the same: whoosh 4× in 30 s (12.0–38.5 s) (+1 more).',
      target: { kind: 'director', section: 'editing' },
    });
    expect(items({ editing: editing('auto', [repetition('r1', 'ignored', 'x')]) })).toEqual([]);
    expect(items({ editing: editing('off', [repetition('r1', 'open', 'x')]) })).toEqual([]);
  });

  it('orders decisions, problems, checks, then out-of-date steps; the count is the list', () => {
    const mixed = state({
      ...FINISHED,
      script: DONE,
      storyboard: { ...DONE, stale: true, staleReason: 'script changed' },
    });
    const list = attentionItems({
      state: mixed,
      shots: [flagged('s03')],
      claims: claims(['unsourced']),
    });
    expect(ids(list)).toEqual(['script-review', 'shot:s03', 'claims', 'stale:storyboard']);
    expect(list.at(-1)).toMatchObject({
      group: 'out-of-date',
      button: 'Show Storyboard',
      target: { kind: 'step', rowId: 'storyboard' },
    });
    expect(attentionLabel(list.length)).toBe('Needs you: 4 items');
  });

  it('announces the count politely in words', () => {
    expect(attentionAnnouncement(0)).toBe('Nothing needs you right now.');
    expect(attentionAnnouncement(1)).toBe('1 thing needs you.');
    expect(attentionAnnouncement(3)).toBe('3 things need you.');
  });
});
