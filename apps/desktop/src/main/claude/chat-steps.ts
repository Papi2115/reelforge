/**
 * Bridge turn view (the `steps` reducer of @reelforge/claude-bridge) -> the plain chat steps the
 * panel shows (PLAN.md#6.6). Tool outputs are truncated; frame thumbnails are the PNGs a step
 * rendered or read, as project-relative paths under `.reelforge/frames/` (served to the panel by
 * the project-media protocol, never as file:// URLs). Pure.
 */
import path from 'node:path';
import type { TurnView } from '@reelforge/claude-bridge';
import type { ChatStep } from '../../shared/chat-contract.js';

export const FRAMES_DIR = '.reelforge/frames';
export const MAX_STEP_TEXT = 20_000;
export const MAX_TOOL_OUTPUT = 2_000;
export const MAX_STEP_FRAMES = 12;

const IMAGE_FILE = /\.(?:png|jpe?g|webp)$/i;

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function stringField(input: unknown, key: string): string | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function sameCase(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

/**
 * `file` (absolute or relative to the project) as a project-relative posix path when it is an
 * image under `.reelforge/frames/`; undefined otherwise.
 */
export function frameRelative(file: string, projectDir: string): string | undefined {
  const absolute = path.resolve(projectDir, file.trim());
  const relative = path.relative(projectDir, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  const posix = relative.split(path.sep).join('/');
  if (!sameCase(posix).startsWith(`${FRAMES_DIR}/`) || !IMAGE_FILE.test(posix)) return undefined;
  return posix;
}

/**
 * Frame PNG paths printed by the `reelforge` CLI (one per line, after a label such as
 * `  t=2.5     C:\proj\.reelforge\frames\s02\s02_t2.500.png`). Paths may contain spaces, so a
 * path is taken from the project folder (or `.reelforge/frames`) up to the image extension.
 */
export function framePathsInText(text: string, projectDir: string): string[] {
  const starts = [
    projectDir,
    projectDir.split(path.sep).join('/'),
    FRAMES_DIR,
    FRAMES_DIR.replace('/', '\\'),
  ];
  const found: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const lower = sameCase(line);
    for (const start of starts) {
      const index = lower.indexOf(sameCase(start));
      if (index === -1) continue;
      const match = /^.*?\.(?:png|jpe?g|webp)/i.exec(line.slice(index));
      const relative = match === null ? undefined : frameRelative(match[0], projectDir);
      if (relative !== undefined) {
        found.push(relative);
        break;
      }
    }
  }
  return found;
}

type ViewStep = TurnView['steps'][number];

function framesOf(step: Extract<ViewStep, { type: 'tool' }>, projectDir: string): string[] {
  const files = step.images.flatMap((image) => (image.source === 'file' ? [image.path] : []));
  const fromFiles = files.flatMap((file) => frameRelative(file, projectDir) ?? []);
  const command = stringField(step.input, 'command') ?? '';
  const fromOutput =
    step.name === 'Bash' && /^\s*reelforge\b/.test(command) && step.output !== undefined
      ? framePathsInText(step.output, projectDir)
      : [];
  return [...new Set([...fromFiles, ...fromOutput])].slice(0, MAX_STEP_FRAMES);
}

function toChatStep(step: ViewStep, projectDir: string): ChatStep {
  switch (step.type) {
    case 'text':
      return { type: 'text', id: step.id, text: clip(step.text, MAX_STEP_TEXT) };
    case 'tool':
      return {
        type: 'tool',
        id: step.id,
        name: step.name,
        summary: clip(step.summary, 200),
        status: step.status,
        command: step.name === 'Bash' ? (stringField(step.input, 'command') ?? null) : null,
        output: step.output === undefined ? null : clip(step.output, MAX_TOOL_OUTPUT),
        frames: framesOf(step, projectDir),
      };
    case 'error':
      return { type: 'error', id: step.id, message: `${step.code}: ${step.message}` };
  }
}

export function toChatSteps(view: TurnView, projectDir: string): ChatStep[] {
  return view.steps.map((step) => toChatStep(step, projectDir));
}
