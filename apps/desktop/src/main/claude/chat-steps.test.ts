import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { reduceEvents, type StreamEvent } from '@reelforge/claude-bridge';
import { afterAll, describe, expect, it } from 'vitest';
import {
  framePathsInText,
  frameRelative,
  MAX_STEP_FRAMES,
  MAX_TOOL_OUTPUT,
  toChatSteps,
} from './chat-steps.js';

const project = mkdtempSync(path.join(os.tmpdir(), 'rf chat ż '));
afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});
const frame = (...parts: string[]): string => path.join(project, '.reelforge', 'frames', ...parts);

function toolUse(id: string, name: string, input: unknown): StreamEvent {
  return {
    kind: 'tool-use',
    messageId: `m-${id}`,
    toolUseId: id,
    name,
    input,
    parentToolUseId: null,
  };
}

function toolResult(id: string, text: string, isError = false): StreamEvent {
  return { kind: 'tool-result', toolUseId: id, isError, text, images: [] };
}

describe('frameRelative', () => {
  it('keeps only images under .reelforge/frames of the project', () => {
    expect(frameRelative(frame('s02', 's02_t2.500.png'), project)).toBe(
      '.reelforge/frames/s02/s02_t2.500.png',
    );
    expect(frameRelative('.reelforge/frames/contact-sheet.png', project)).toBe(
      '.reelforge/frames/contact-sheet.png',
    );
    expect(frameRelative(path.join(project, 'scenes', 'a.png'), project)).toBeUndefined();
    expect(frameRelative(frame('s02', 'notes.txt'), project)).toBeUndefined();
    expect(frameRelative(path.join(project, '..', 'x.png'), project)).toBeUndefined();
    expect(frameRelative('.reelforge/frames/../../../etc/x.png', project)).toBeUndefined();
  });
});

describe('framePathsInText', () => {
  it('finds CLI frame paths with spaces and labels around them', () => {
    const output = [
      'frames (t = local shot time; Read these PNG files):',
      `  t=0.5     ${frame('s02', 's02_t0.500.png')}`,
      `  t=2.5     ${frame('s02', 's02_t2.500.png')}  ! blank frame`,
      'contact sheet: .reelforge/frames/contact-sheet.png',
      `elsewhere: ${path.join(project, 'out', 'thumb.png')}`,
    ].join('\n');
    expect(framePathsInText(output, project)).toEqual([
      '.reelforge/frames/s02/s02_t0.500.png',
      '.reelforge/frames/s02/s02_t2.500.png',
      '.reelforge/frames/contact-sheet.png',
    ]);
  });
});

describe('toChatSteps', () => {
  it('maps text, tool steps (frames from Read and reelforge output) and errors', () => {
    const long = 'x'.repeat(MAX_TOOL_OUTPUT + 50);
    const view = reduceEvents([
      { kind: 'text', messageId: 'm0', text: 'Making it bigger.', parentToolUseId: null },
      toolUse('t1', 'Read', { file_path: path.join(project, 'scenes', 's02.js') }),
      toolResult('t1', long),
      toolUse('t2', 'Bash', { command: 'reelforge frames --shot s02 --at 2.5' }),
      toolResult('t2', `frames:\n  t=2.5  ${frame('s02', 's02_t2.500.png')}`),
      toolUse('t3', 'Read', { file_path: frame('s02', 's02_t2.500.png') }),
      toolResult('t3', ''),
      toolUse('t4', 'Bash', { command: 'echo .reelforge/frames/x.png' }),
      toolResult('t4', '.reelforge/frames/x.png', true),
      toolUse('t5', 'Edit', { file_path: path.join(project, 'scenes', 's02.js') }),
      { kind: 'api-error', messageId: 'm9', error: 'rate_limit', text: 'Rate limit reached' },
    ]);
    const steps = toChatSteps(view, project);
    expect(steps.map((step) => step.type)).toEqual([
      'text',
      'tool',
      'tool',
      'tool',
      'tool',
      'tool',
      'error',
    ]);
    const [text, read, bash, readFrame, echo, edit, error] = steps;
    expect(text).toEqual({ type: 'text', id: 'text-0', text: 'Making it bigger.' });
    expect(read).toMatchObject({ name: 'Read', status: 'done', command: null, frames: [] });
    expect(read?.type === 'tool' && read.output?.length).toBe(MAX_TOOL_OUTPUT);
    expect(bash).toMatchObject({
      name: 'Bash',
      command: 'reelforge frames --shot s02 --at 2.5',
      frames: ['.reelforge/frames/s02/s02_t2.500.png'],
    });
    expect(readFrame).toMatchObject({ frames: ['.reelforge/frames/s02/s02_t2.500.png'] });
    // Only the reelforge CLI's output is trusted to list frames.
    expect(echo).toMatchObject({ status: 'error', frames: [] });
    expect(edit).toMatchObject({ name: 'Edit', status: 'running', output: null });
    expect(error).toEqual({
      type: 'error',
      id: 'error-6',
      message: 'rate_limit: Rate limit reached',
    });
  });

  it('caps the thumbnails of one step', () => {
    const lines = Array.from({ length: 30 }, (_, index) => frame('s01', `f${String(index)}.png`));
    const view = reduceEvents([
      toolUse('t1', 'Bash', { command: 'reelforge render-shot s01 --step 0.1' }),
      toolResult('t1', lines.join('\n')),
    ]);
    const [step] = toChatSteps(view, project);
    expect(step?.type === 'tool' && step.frames.length).toBe(MAX_STEP_FRAMES);
  });
});
