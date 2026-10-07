import { describe, expect, it } from 'vitest';
import type {
  ChannelQueueView,
  LineView,
  QueueAttentionView,
  QueueItemView,
} from '../../shared/queue-contract.js';
import type { AttentionItem } from '../stages/attention-view.js';
import { lineAttentionItems, mergeAttention, SHOW_IN_LINE } from './line-attention.js';
import {
  APPROVE_FIRST_HINT,
  channelSummary,
  itemActions,
  itemSentence,
  lineActive,
  lineStrip,
  parseTopics,
  STATUS_WORDS,
} from './queue-view.js';

function item(patch: Partial<QueueItemView> = {}): QueueItemView {
  return {
    id: 'a1',
    topic: 'Why is the sky blue',
    status: 'queued',
    step: 'project',
    stepState: null,
    message: null,
    targetMinutes: 8,
    stepsDone: 0,
    stepsTotal: 15,
    projectPath: null,
    warnings: [],
    reviewed: false,
    live: null,
    ...patch,
  };
}

function channel(items: QueueItemView[], patch: Partial<ChannelQueueView> = {}): ChannelQueueView {
  return {
    channelId: 'voxplain',
    autoApproveScript: false,
    paused: false,
    defaultTargetMinutes: 8,
    voiceReady: false,
    items,
    error: null,
    ...patch,
  };
}

const STOPPED: LineView = {
  activity: 'stopped',
  until: null,
  message: null,
  current: null,
  wanted: false,
  runUntil: { kind: 'idle' },
  lastEnd: null,
  problem: null,
};

const approval: QueueAttentionView = {
  kind: 'approve-script',
  channelId: 'voxplain',
  itemId: 'a1',
  topic: 'Why is the sky blue',
  step: 'approval',
  message: 'Approve the script.',
  since: '2026-10-07T10:00:00.000Z',
  projectPath: 'C:\\Films\\sky-a1',
};

const nameOf = (id: string): string => (id === 'voxplain' ? 'Voxplain' : 'Crime Desk');
const clock = (epoch: number): string => (epoch === 1_000 ? '14:05' : '07:00');

describe('status chips and sentences', () => {
  it('uses the status words of the app', () => {
    expect(Object.values(STATUS_WORDS)).toEqual([
      'Queued',
      'Brief',
      'Script',
      'Needs you',
      'Voice needed',
      'Building',
      'Exporting',
      'Done',
      'Failed',
      'On hold',
    ]);
  });

  it('says what a film does or what it waits for in one sentence', () => {
    expect(itemSentence(item(), false)).toBe('Waits for its turn.');
    expect(itemSentence(item({ status: 'needs-approval', step: 'approval' }), false)).toBe(
      'The script is written. Read it and approve it.',
    );
    expect(itemSentence(item({ status: 'needs-voice', step: 'voiceover' }), false)).toBe(
      'Record your voiceover (read the approved script) or import a file.',
    );
    expect(itemSentence(item({ status: 'needs-voice', step: 'voiceover' }), true)).toBe(
      'The channel has a voice now: Generate voice makes it.',
    );
    expect(itemSentence(item({ status: 'building', step: 'scenes', stepsDone: 9 }), false)).toBe(
      'Next: the scenes (step 10 of 15).',
    );
    expect(
      itemSentence(
        item({
          status: 'building',
          step: 'scenes',
          live: { label: 'Building 3 of 7', percent: 42.4 },
        }),
        false,
      ),
    ).toBe('Building 3 of 7 · 42 %');
    expect(
      itemSentence(item({ status: 'failed', step: 'brief', message: 'Claude stopped' }), false),
    ).toBe('The brief stopped with a problem: Claude stopped');
    expect(itemSentence(item({ status: 'done', step: null, warnings: ['a', 'b'] }), false)).toBe(
      'Done with 2 warnings ⚠. The video and the publish kit are ready.',
    );
  });
});

describe('the status strip', () => {
  it('names the film being built and its step', () => {
    const items = [item({ id: 'a1' }), item({ id: 'a2' }), item({ id: 'a3' })];
    const running: LineView = {
      ...STOPPED,
      activity: 'running',
      current: { channelId: 'voxplain', itemId: 'a2', step: 'scenes' },
    };
    const strip = lineStrip({ line: running, channels: [channel(items)], attention: [], nameOf });
    expect(strip).toEqual({ text: 'Running · Building film 2 of 3: scenes', tone: 'running' });
    const two = lineStrip({
      line: { ...running, runUntil: { kind: 'time', at: 5, text: '07:00' } },
      channels: [channel(items), channel([], { channelId: 'crime' })],
      attention: [],
      nameOf,
    });
    expect(two.text).toBe('Running · Voxplain: Building film 2 of 3: scenes · until 07:00');
  });

  it('shows the usage-limit pause, quiet hours, the wait for you and a stop', () => {
    const base = { channels: [], attention: [], nameOf, clock };
    expect(lineStrip({ ...base, line: { ...STOPPED, activity: 'limit', until: 1_000 } }).text).toBe(
      'Paused by Claude usage limit — resumes 14:05',
    );
    expect(lineStrip({ ...base, line: { ...STOPPED, activity: 'quiet', until: 2_000 } }).text).toBe(
      'Quiet hours — starts again at 07:00',
    );
    const waiting = { ...STOPPED, wanted: true, lastEnd: 'idle' } as const;
    expect(lineStrip({ ...base, line: waiting, attention: [approval] })).toEqual({
      text: 'Waiting for your approval (1 script)',
      tone: 'you',
    });
    expect(lineStrip({ ...base, line: waiting }).text).toBe('Stopped · every film is done');
    expect(lineStrip({ ...base, line: STOPPED }).text).toBe('Stopped');
    expect(
      lineStrip({ ...base, line: { ...STOPPED, problem: 'Claude is not connected.' } }).text,
    ).toBe('Stopped: Claude is not connected.');
    expect(lineActive(STOPPED)).toBe(false);
    expect(lineActive({ ...STOPPED, activity: 'limit' })).toBe(true);
    expect(lineActive(waiting)).toBe(true);
  });
});

describe('the buttons of a film', () => {
  const ids = (actions: ReturnType<typeof itemActions>): string[] =>
    actions.map((action) => action.id);

  it('approves a script only after it was opened', () => {
    const waiting = item({
      status: 'needs-approval',
      step: 'approval',
      projectPath: 'C:/Films/a1',
    });
    const before = itemActions(waiting, false, false);
    expect(ids(before)).toEqual(['open-script', 'approve', 'hold', 'open-project']);
    expect(before[1]).toMatchObject({ disabled: true, title: APPROVE_FIRST_HINT });
    expect(itemActions(waiting, false, true)[1]).toMatchObject({ disabled: false, primary: true });
  });

  it('offers the voice, a retry, the results and a resume', () => {
    expect(
      ids(itemActions(item({ status: 'needs-voice', step: 'voiceover' }), true, false)),
    ).toEqual(['generate-voice', 'add-voice', 'hold']);
    expect(ids(itemActions(item({ status: 'failed' }), false, false))).toEqual(['retry']);
    expect(
      ids(itemActions(item({ status: 'done', step: null, warnings: ['x'] }), false, false)),
    ).toEqual(['open-video', 'open-publish', 'mark-checked']);
    expect(ids(itemActions(item({ status: 'paused' }), false, false))).toEqual(['resume']);
  });
});

describe('Add topics', () => {
  it('reads one topic per line with an optional length', () => {
    expect(
      parseTopics('Why is the sky blue\n\n  How magnets work | 6 \nRust | 0,5\nTabs |'),
    ).toEqual({
      topics: [
        { topic: 'Why is the sky blue' },
        { topic: 'How magnets work', targetMinutes: 6 },
        { topic: 'Rust', targetMinutes: 0.5 },
        { topic: 'Tabs' },
      ],
      errors: [],
    });
  });

  it('names the line of every problem', () => {
    expect(parseTopics('| 5\nA | ten\nB | 90\nC | 0').errors).toEqual([
      'Line 1: the topic is empty.',
      'Line 2: “ten” is not a length in minutes (more than 0, at most 60).',
      'Line 3: “90” is not a length in minutes (more than 0, at most 60).',
      'Line 4: “0” is not a length in minutes (more than 0, at most 60).',
    ]);
    const many = Array.from({ length: 101 }, (_, index) => `Topic ${String(index)}`).join('\n');
    expect(parseTopics(many).errors).toEqual(['At most 100 topics at once.']);
  });

  it('sums a channel up for its tab', () => {
    expect(channelSummary(channel([]))).toBe('No films yet');
    expect(
      channelSummary(
        channel([item(), item({ status: 'needs-approval' }), item({ status: 'done' })]),
      ),
    ).toBe('3 films · 1 needs you · 1 done');
  });
});

describe('the line in the Needs you inbox', () => {
  it('turns waiting films into items that open the Production line', () => {
    const failed: QueueAttentionView = {
      ...approval,
      kind: 'failed',
      itemId: 'a2',
      topic: 'Magnets',
      message: 'script: Claude stopped',
    };
    const items = lineAttentionItems([approval, failed], nameOf);
    expect(items).toEqual([
      {
        id: 'line:voxplain:a1',
        group: 'decision',
        subject: 'Production line · Voxplain',
        text: '“Why is the sky blue”: the script is written. Read it and approve it.',
        button: SHOW_IN_LINE,
        target: { kind: 'line', channelId: 'voxplain', itemId: 'a1' },
      },
      {
        id: 'line:voxplain:a2',
        group: 'problem',
        subject: 'Production line · Voxplain',
        text: '“Magnets” stopped with a problem: script: Claude stopped',
        button: SHOW_IN_LINE,
        target: { kind: 'line', channelId: 'voxplain', itemId: 'a2' },
      },
    ]);
    // The open project's own script is already in the inbox: the line does not list it twice.
    expect(
      lineAttentionItems([approval, failed], nameOf, 'c:/films/sky-a1/').map((entry) => entry.id),
    ).toEqual(['line:voxplain:a2']);
    const project: AttentionItem = {
      id: 'script-review',
      group: 'decision',
      subject: 'Script written',
      text: 'The script is written.',
      button: 'Open the script',
      target: { kind: 'brief' },
    };
    const stale: AttentionItem = { ...project, id: 'stale:words', group: 'out-of-date' };
    expect(mergeAttention([project, stale], items).map((entry) => entry.id)).toEqual([
      'script-review',
      'line:voxplain:a1',
      'line:voxplain:a2',
      'stale:words',
    ]);
  });
});
