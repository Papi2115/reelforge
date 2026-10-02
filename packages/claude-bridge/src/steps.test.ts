import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StreamEvent } from './events.js';
import {
  initialTurnView,
  reduceEvents,
  reduceTurn,
  summarizeToolInput,
  type ToolStep,
} from './steps.js';
import { fixtureEvents } from './testing/fake-claude.js';

const toolSteps = (steps: readonly { type: string }[]): ToolStep[] =>
  steps.filter((step): step is ToolStep => step.type === 'tool');

describe('reduceTurn', () => {
  it('tools-read-png -> text, Read (done, thumbnails), Write (denied), text, final', () => {
    const view = reduceEvents(fixtureEvents('tools-read-png'));
    expect(view.steps.map((step) => step.type)).toEqual(['text', 'tool', 'tool', 'text']);
    const [read, write] = toolSteps(view.steps);
    // Recorded paths are Windows paths: relative on win32, kept whole elsewhere.
    expect(read).toMatchObject({ name: 'Read', status: 'done' });
    expect(read?.summary.endsWith('swatch.png')).toBe(true);
    expect(read?.images.map((image) => image.source)).toEqual(['file', 'inline']);
    expect(write).toMatchObject({ name: 'Write', status: 'denied' });
    expect(write?.summary.endsWith('notes.txt')).toBe(true);
    expect(view.text).toMatch(/MARMALADE-7[\s\S]*yellow/i);
    expect(view.thinkingTokens).toBeGreaterThan(0);
    expect(view.final).toMatchObject({ isError: false, numTurns: expect.any(Number) as number });
    expect(view.final?.costUsd).toBeGreaterThan(0);
    expect(view.final?.usage?.outputTokens).toBe(1059);
    expect(view.rateLimit?.status).toBe('allowed');
  });

  it('merges text blocks of the same message and records the session/model', () => {
    const view = reduceEvents(fixtureEvents('resume-2-recall'));
    expect(view.sessionId).toBe('b70a331f-64a6-442a-83db-2903d0281723');
    expect(view.model).toBe('claude-haiku-4-5-20251001');
    expect(view.steps).toEqual([
      { type: 'text', id: 'text-0', messageId: expect.any(String) as string, text: 'PELICAN-42' },
    ]);
  });

  it('turns api errors into error steps and marks the final result as an error', () => {
    const view = reduceEvents(fixtureEvents('not-logged-in'));
    expect(view.steps).toEqual([
      {
        type: 'error',
        id: 'error-0',
        code: 'authentication_failed',
        message: 'Not logged in · Please run /login',
      },
    ]);
    expect(view.final?.isError).toBe(true);
  });

  it('uses the frame-path hook for thumbnails (e.g. reelforge frames output)', () => {
    const events: StreamEvent[] = [
      {
        kind: 'tool-use',
        messageId: 'm',
        toolUseId: 't1',
        name: 'Bash',
        input: { command: 'reelforge frames --at 4.8' },
        parentToolUseId: null,
      },
      { kind: 'tool-result', toolUseId: 't1', isError: false, text: 'out/f-4.8.png', images: [] },
    ];
    const view = reduceEvents(events, {
      framePaths: (tool) => (tool.name === 'Bash' ? (tool.output?.split('\n') ?? []) : []),
    });
    expect(toolSteps(view.steps)[0]).toMatchObject({
      status: 'done',
      summary: 'reelforge frames --at 4.8',
      images: [{ source: 'file', path: 'out/f-4.8.png' }],
    });
  });

  it('counts parse errors and never mutates the previous view', () => {
    const before = initialTurnView();
    const after = reduceTurn(before, { kind: 'parse-error', line: 'x', message: 'bad' });
    expect(after.parseErrors).toBe(1);
    expect(before.parseErrors).toBe(0);
  });
});

describe('summarizeToolInput', () => {
  it('shows paths relative to the project and truncates long commands', () => {
    const cwd = path.join(path.sep, 'proj with space');
    expect(summarizeToolInput('Edit', { file_path: path.join(cwd, 'scenes', 's01.js') }, cwd)).toBe(
      path.join('scenes', 's01.js'),
    );
    expect(
      summarizeToolInput('Read', { file_path: path.join(path.sep, 'other', 'a.png') }, cwd),
    ).toBe(path.join(path.sep, 'other', 'a.png'));
    const long = summarizeToolInput('Bash', { command: `echo ${'x'.repeat(200)}` });
    expect(long).toHaveLength(80);
    expect(long.endsWith('…')).toBe(true);
    expect(summarizeToolInput('Glob', { pattern: 'scenes/*.js' })).toBe('scenes/*.js');
    expect(summarizeToolInput('Custom', { a: 1 })).toBe('{"a":1}');
  });
});
