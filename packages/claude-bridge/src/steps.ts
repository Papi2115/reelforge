/**
 * Pure reducer: stream events -> the UI "steps" of one turn (text, tool steps with an argument
 * summary and status, frame thumbnails, final result with cost/usage). PLAN.md#5.3.
 */
import path from 'node:path';
import type { ModelUsage, RateLimitEvent, StreamEvent, TokenUsage } from './events.js';

export type ImageRef =
  | { readonly source: 'file'; readonly path: string }
  | { readonly source: 'inline'; readonly mediaType: string; readonly base64: string };

export interface TextStep {
  readonly type: 'text';
  readonly id: string;
  readonly messageId: string;
  readonly text: string;
}

export interface ToolStep {
  readonly type: 'tool';
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly input: unknown;
  readonly status: 'running' | 'done' | 'error' | 'denied';
  readonly output: string | undefined;
  /** Thumbnails: frame files the tool touched + inline images it returned. */
  readonly images: readonly ImageRef[];
}

export interface ErrorStep {
  readonly type: 'error';
  readonly id: string;
  readonly code: string;
  readonly message: string;
}

export type Step = TextStep | ToolStep | ErrorStep;

export interface FinalSummary {
  readonly isError: boolean;
  readonly text: string;
  readonly numTurns: number;
  readonly durationMs: number;
  readonly terminalReason: string | undefined;
  readonly costUsd: number;
  readonly usage: TokenUsage | undefined;
  readonly models: Readonly<Record<string, ModelUsage>>;
}

export interface TurnView {
  readonly sessionId: string | undefined;
  readonly model: string | undefined;
  readonly cwd: string | undefined;
  readonly steps: readonly Step[];
  /** All assistant text of the turn (`result.result` only holds the last message). */
  readonly text: string;
  readonly thinkingTokens: number;
  readonly rateLimit: RateLimitEvent | undefined;
  readonly parseErrors: number;
  readonly final: FinalSummary | undefined;
}

/** Hook deciding which file paths of a tool call are frames worth a thumbnail. */
export type FramePathsHook = (tool: {
  readonly name: string;
  readonly input: unknown;
  readonly output: string | undefined;
}) => readonly string[];

export interface ReduceOptions {
  readonly framePaths?: FramePathsHook;
}

const IMAGE_FILE = /\.(?:png|jpe?g|webp)$/i;

function stringField(input: unknown, key: string): string | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Default hook: image files read/written by Read/Write/Edit. */
export const defaultFramePaths: FramePathsHook = (tool) => {
  const filePath = stringField(tool.input, 'file_path');
  return filePath !== undefined && IMAGE_FILE.test(filePath) ? [filePath] : [];
};

function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length <= max ? single : `${single.slice(0, max - 1)}…`;
}

function displayPath(filePath: string, cwd: string | undefined): string {
  if (cwd === undefined) return filePath;
  const relative = path.relative(cwd, filePath);
  return relative === '' || relative.startsWith('..') || path.isAbsolute(relative)
    ? filePath
    : relative;
}

/** One-line argument summary for a tool step (e.g. `Read scenes/s01.js`). */
export function summarizeToolInput(name: string, input: unknown, cwd?: string): string {
  const filePath = stringField(input, 'file_path') ?? stringField(input, 'notebook_path');
  if (filePath !== undefined) return displayPath(filePath, cwd);
  const field =
    stringField(input, 'command') ??
    stringField(input, 'pattern') ??
    stringField(input, 'url') ??
    stringField(input, 'query') ??
    stringField(input, 'description');
  if (field !== undefined) return truncate(field, 80);
  return truncate(input === undefined ? name : JSON.stringify(input), 80);
}

export function initialTurnView(): TurnView {
  return {
    sessionId: undefined,
    model: undefined,
    cwd: undefined,
    steps: [],
    text: '',
    thinkingTokens: 0,
    rateLimit: undefined,
    parseErrors: 0,
    final: undefined,
  };
}

function updateTool(
  steps: readonly Step[],
  toolUseId: string,
  update: (step: ToolStep) => ToolStep,
): readonly Step[] {
  return steps.map((step) => (step.type === 'tool' && step.id === toolUseId ? update(step) : step));
}

function appendText(view: TurnView, messageId: string, text: string): TurnView {
  const last = view.steps.at(-1);
  const steps =
    last?.type === 'text' && last.messageId === messageId
      ? [...view.steps.slice(0, -1), { ...last, text: `${last.text}\n\n${text}` }]
      : [
          ...view.steps,
          { type: 'text' as const, id: `text-${String(view.steps.length)}`, messageId, text },
        ];
  return { ...view, steps, text: view.text === '' ? text : `${view.text}\n\n${text}` };
}

function errorStep(view: TurnView, code: string, message: string): TurnView {
  const step: ErrorStep = {
    type: 'error',
    id: `error-${String(view.steps.length)}`,
    code,
    message,
  };
  return { ...view, steps: [...view.steps, step] };
}

/** Applies one event; returns a new view (inputs are never mutated). */
export function reduceTurn(
  view: TurnView,
  event: StreamEvent,
  options: ReduceOptions = {},
): TurnView {
  const framePaths = options.framePaths ?? defaultFramePaths;
  switch (event.kind) {
    case 'init':
      return { ...view, sessionId: event.sessionId, model: event.model, cwd: event.cwd };
    case 'thinking-progress':
      return { ...view, thinkingTokens: Math.max(view.thinkingTokens, event.estimatedTokens) };
    case 'text':
      return appendText(view, event.messageId, event.text);
    case 'tool-use': {
      const step: ToolStep = {
        type: 'tool',
        id: event.toolUseId,
        name: event.name,
        summary: summarizeToolInput(event.name, event.input, view.cwd),
        input: event.input,
        status: 'running',
        output: undefined,
        images: [],
      };
      return { ...view, steps: [...view.steps, step] };
    }
    case 'tool-result':
      return {
        ...view,
        steps: updateTool(view.steps, event.toolUseId, (step) => {
          const files = framePaths({ name: step.name, input: step.input, output: event.text });
          const images: ImageRef[] = [
            ...files.map((file): ImageRef => ({ source: 'file', path: file })),
            ...event.images.map((image): ImageRef => ({
              source: 'inline',
              mediaType: image.mediaType,
              base64: image.base64,
            })),
          ];
          const failed = step.status === 'denied' || event.isError;
          return {
            ...step,
            status: step.status === 'denied' ? 'denied' : failed ? 'error' : 'done',
            output: event.text,
            images,
          };
        }),
      };
    case 'permission-denied':
      return {
        ...view,
        steps: updateTool(view.steps, event.toolUseId, (step) => ({ ...step, status: 'denied' })),
      };
    case 'api-error':
      return errorStep(view, event.error, event.text);
    case 'rate-limit':
      return { ...view, rateLimit: event };
    case 'result':
      return {
        ...view,
        sessionId: event.sessionId ?? view.sessionId,
        final: {
          isError: event.isError,
          text: event.text,
          numTurns: event.numTurns,
          durationMs: event.durationMs,
          terminalReason: event.terminalReason,
          costUsd: event.costUsd,
          usage: view.final?.usage,
          models: view.final?.models ?? {},
        },
      };
    case 'usage':
      return view.final === undefined
        ? view
        : {
            ...view,
            final: {
              ...view.final,
              costUsd: event.costUsd,
              usage: event.usage,
              models: event.models,
            },
          };
    case 'parse-error':
      return { ...view, parseErrors: view.parseErrors + 1 };
    case 'thinking':
    case 'system':
    case 'unknown':
      return view;
  }
}

/** Folds a whole event list (e.g. a recorded stream). */
export function reduceEvents(
  events: readonly StreamEvent[],
  options: ReduceOptions = {},
): TurnView {
  return events.reduce((view, event) => reduceTurn(view, event, options), initialTurnView());
}
