import { describe, expect, it } from 'vitest';
import type { ChatToolStep, ChatTurn } from '../../shared/chat-contract.js';
import {
  formatTokens,
  requestText,
  scopeText,
  stepRow,
  thumbnailUrl,
  toolLabel,
  toSelection,
  turnStatusText,
  usageLine,
} from './step-view.js';

function tool(patch: Partial<ChatToolStep>): ChatToolStep {
  return {
    type: 'tool',
    id: 't1',
    name: 'Bash',
    summary: '',
    status: 'running',
    command: null,
    output: null,
    frames: [],
    ...patch,
  };
}

function turn(patch: Partial<ChatTurn>): ChatTurn {
  return {
    id: 'turn',
    request: {
      text: 'make the calculator bigger',
      chip: null,
      scope: 'selection',
      shotIds: ['s02'],
      selectionLabel: 'calculator (s02)',
      model: 'sonnet',
    },
    status: 'done',
    queuedAt: 0,
    startedAt: 0,
    finishedAt: 1,
    steps: [],
    usage: null,
    error: null,
    commit: null,
    resumable: false,
    resumeOf: null,
    ...patch,
  };
}

describe('toolLabel', () => {
  it('names reelforge commands like the reference ("Rendering frames at 4.8s…")', () => {
    const frames = tool({ command: 'reelforge frames --shot s02 --at 4.8,5' });
    expect(toolLabel(frames)).toEqual({
      label: 'Rendering frames at 4.8s, 5s…',
      detail: 'shot s02',
    });
    expect(toolLabel({ ...frames, status: 'done' }).label).toBe('Rendered frames at 4.8s, 5s');
    expect(toolLabel(tool({ command: 'reelforge contact-sheet --all' })).label).toBe(
      'Rendering a contact sheet…',
    );
    expect(
      toolLabel(tool({ command: 'reelforge render-shot s03 --step 0.5', status: 'done' })).label,
    ).toBe('Rendered a motion preview of s03');
    expect(toolLabel(tool({ command: 'reelforge lint', status: 'done' })).label).toBe(
      'Linted scenes',
    );
    expect(toolLabel(tool({ command: 'reelforge anchors --shot s01' })).label).toBe(
      'Checking anchors of s01…',
    );
    expect(toolLabel(tool({ command: 'ls -la', summary: 'ls -la', status: 'done' }))).toEqual({
      label: 'Ran a command',
      detail: 'ls -la',
    });
  });

  it('names file tools', () => {
    expect(toolLabel(tool({ name: 'Read', summary: 'scenes/s02.js' }))).toEqual({
      label: 'Read',
      detail: 'scenes/s02.js',
    });
    expect(toolLabel(tool({ name: 'Read', summary: '.reelforge/frames/s02/a.png' })).label).toBe(
      'Looked at a frame',
    );
    expect(toolLabel(tool({ name: 'Edit', summary: 'scenes/s02.js', status: 'done' })).label).toBe(
      'Edited',
    );
    expect(toolLabel(tool({ name: 'Write', summary: 'x' })).label).toBe('Writing');
    expect(toolLabel(tool({ name: 'WebFetch', summary: 'https://x' }))).toEqual({
      label: 'WebFetch',
      detail: 'https://x',
    });
  });
});

describe('stepRow', () => {
  it('adds thumbnails (downscaled media URLs) and shows output only for failures', () => {
    const row = stepRow(
      tool({
        command: 'reelforge frames --shot s02 --at 2.5',
        status: 'done',
        output: 'frames: …',
        frames: ['.reelforge/frames/s02/s02 t2.500.png'],
      }),
    );
    expect(row).toEqual({
      kind: 'tool',
      id: 't1',
      icon: 'done',
      label: 'Rendered frames at 2.5s',
      detail: 'shot s02',
      thumbnails: [
        {
          url: 'reelforge-media://project/.reelforge/frames/s02/s02%20t2.500.png?w=240',
          path: '.reelforge/frames/s02/s02 t2.500.png',
          alt: 'Frame s02 t2.500.png',
        },
      ],
      output: null,
    });
    const denied = stepRow(
      tool({ name: 'Write', status: 'denied', output: 'outside the project' }),
    );
    expect(denied).toMatchObject({ label: 'Blocked: Write', output: 'outside the project' });
    expect(stepRow({ type: 'error', id: 'e', message: 'rate_limit: x' })).toEqual({
      kind: 'error',
      id: 'e',
      text: 'rate_limit: x',
    });
    expect(thumbnailUrl('.reelforge/frames/ż.png')).toContain('/%C5%BC.png?w=240');
  });
});

describe('turn texts', () => {
  it('formats usage, scope, request and status', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_345)).toBe('12k');
    expect(formatTokens(1_250)).toBe('1.3k');
    expect(
      usageLine({
        inputTokens: 1_000,
        outputTokens: 840,
        cacheReadTokens: 11_300,
        costUsd: 0.0412,
        durationMs: 18_200,
      }),
    ).toBe('12k in · 840 out · $0.04 · 18 s');
    expect(scopeText(turn({}))).toBe('Selection: calculator (s02)');
    const video = turn({
      request: { ...turn({}).request, scope: 'video', chip: 'review-video', text: '' },
    });
    expect(scopeText(video)).toBe('Whole video');
    expect(requestText(video)).toBe('Review the whole video and fix what looks wrong');
    expect(turnStatusText(turn({ status: 'stopped' }))).toMatch(/^Stopped/);
    expect(
      turnStatusText(turn({ status: 'failed', error: { kind: 'limit', message: 'usage limit' } })),
    ).toBe('Failed: usage limit');
    expect(
      turnStatusText(
        turn({
          status: 'failed',
          resumable: true,
          error: { kind: 'crashed', message: 'claude exited before finishing the turn' },
        }),
      ),
    ).toBe(
      'Interrupted (claude exited before finishing the turn). What Claude changed so far is kept; Resume continues the turn.',
    );
    expect(turnStatusText(turn({ status: 'running' }))).toBe('Claude is working…');
    expect(turnStatusText(turn({}))).toBeUndefined();
  });
});

describe('toSelection', () => {
  it('turns an engine pick into the request selection (nulls, clamped click point)', () => {
    const selection = toSelection(
      {
        kind: 'kit',
        shotId: 's02',
        t: 3.4,
        localTime: 1.2,
        name: 'calculator',
        id: 'props.calculator#0',
        call: 'kit.props.calculator()',
        occurrence: 0,
        position: [0, 0.2, 0],
        description: 'calculator (kit.props.calculator() #1)',
      },
      0.5,
      1.2,
    );
    expect(selection).toEqual({
      kind: 'kit',
      shotId: 's02',
      t: 3.4,
      localTime: 1.2,
      x: 0.5,
      y: 1,
      name: 'calculator',
      id: 'props.calculator#0',
      call: 'kit.props.calculator()',
      occurrence: 0,
      sceneName: null,
      parent: null,
      position: [0, 0.2, 0],
      size: null,
      description: 'calculator (kit.props.calculator() #1)',
    });
  });
});
