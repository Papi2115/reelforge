/**
 * View model of the chat's step log (PLAN.md#6.6): turns the plain steps main pushes into what one
 * row shows - a human label ("Rendering frames at 4.8s…"), a detail, a status and the frame
 * thumbnails (project-media URLs, downscaled by main). Also the usage line, status texts and the
 * conversion of an engine pick into the selection sent with a Selection request. Pure.
 */
import type { PickInfo } from '@reelforge/engine';
import {
  CHIP_LABELS,
  SCOPE_LABELS,
  type ChatSelection,
  type ChatStep,
  type ChatToolStep,
  type ChatTurn,
  type ChatUsage,
} from '../../shared/chat-contract.js';
import { MEDIA_HOST, MEDIA_SCHEME } from '../../shared/player-contract.js';

/** Width main scales thumbnails to (CSS shows them smaller; 2x for HiDPI). */
export const THUMBNAIL_WIDTH = 240;

export type StepIcon = 'running' | 'done' | 'error' | 'denied';

export interface Thumbnail {
  readonly url: string;
  readonly alt: string;
  readonly path: string;
}

export type StepRow =
  | { readonly kind: 'text'; readonly id: string; readonly text: string }
  | { readonly kind: 'error'; readonly id: string; readonly text: string }
  | {
      readonly kind: 'tool';
      readonly id: string;
      readonly icon: StepIcon;
      readonly label: string;
      readonly detail: string;
      readonly thumbnails: readonly Thumbnail[];
      /** Shown for failed/blocked steps (why it went wrong). */
      readonly output: string | null;
    };

export function thumbnailUrl(relative: string): string {
  const encoded = relative.split('/').map(encodeURIComponent).join('/');
  return `${MEDIA_SCHEME}://${MEDIA_HOST}/${encoded}?w=${String(THUMBNAIL_WIDTH)}`;
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function times(at: string | undefined): string {
  if (at === undefined || at === '') return '';
  return ` at ${at
    .split(',')
    .map((t) => `${t.trim()}s`)
    .join(', ')}`;
}

/** Label of a `reelforge …` command: running (`…`) and finished wording. */
function reelforgeLabel(args: readonly string[], running: boolean): string | undefined {
  const [command = '', ...rest] = args;
  const shot = flagValue(rest, '--shot');
  const verb = (doing: string, done: string): string => (running ? `${doing}…` : done);
  switch (command) {
    case 'frames':
      return verb(
        `Rendering frames${times(flagValue(rest, '--at'))}`,
        `Rendered frames${times(flagValue(rest, '--at'))}`,
      );
    case 'contact-sheet':
      return verb('Rendering a contact sheet', 'Rendered a contact sheet');
    case 'render-shot':
      return verb(
        `Rendering a motion preview of ${rest[0] ?? 'the shot'}`,
        `Rendered a motion preview of ${rest[0] ?? 'the shot'}`,
      );
    case 'lint':
      return verb('Linting scenes', 'Linted scenes');
    case 'validate':
      return verb('Validating project files', 'Validated project files');
    case 'anchors':
      return verb(
        `Checking anchors${shot === undefined ? '' : ` of ${shot}`}`,
        `Checked anchors${shot === undefined ? '' : ` of ${shot}`}`,
      );
    case 'status':
      return verb('Checking the project status', 'Checked the project status');
    case 'kit-docs':
      return verb('Reading the kit docs', 'Read the kit docs');
    default:
      return undefined;
  }
}

const IMAGE = /\.(?:png|jpe?g|webp)$/i;

/** Label + detail of a tool step. */
export function toolLabel(step: ChatToolStep): { label: string; detail: string } {
  const running = step.status === 'running';
  if (step.name === 'Bash') {
    const args = (step.command ?? '').trim().split(/\s+/);
    const label = args[0] === 'reelforge' ? reelforgeLabel(args.slice(1), running) : undefined;
    const shot = flagValue(args, '--shot');
    if (label !== undefined) return { label, detail: shot === undefined ? '' : `shot ${shot}` };
    return { label: running ? 'Running a command…' : 'Ran a command', detail: step.summary };
  }
  switch (step.name) {
    case 'Read':
      return IMAGE.test(step.summary)
        ? { label: 'Looked at a frame', detail: step.summary }
        : { label: 'Read', detail: step.summary };
    case 'Edit':
    case 'MultiEdit':
      return { label: running ? 'Editing' : 'Edited', detail: step.summary };
    case 'Write':
      return { label: running ? 'Writing' : 'Wrote', detail: step.summary };
    case 'Glob':
    case 'Grep':
      return { label: 'Searched', detail: step.summary };
    default:
      return { label: step.name, detail: step.summary };
  }
}

export function stepRow(step: ChatStep): StepRow {
  if (step.type === 'text') return { kind: 'text', id: step.id, text: step.text };
  if (step.type === 'error') return { kind: 'error', id: step.id, text: step.message };
  const { label, detail } = toolLabel(step);
  return {
    kind: 'tool',
    id: step.id,
    icon: step.status,
    label: step.status === 'denied' ? `Blocked: ${step.name}` : label,
    detail,
    thumbnails: step.frames.map((relative) => ({
      url: thumbnailUrl(relative),
      path: relative,
      alt: `Frame ${relative.split('/').at(-1) ?? relative}`,
    })),
    output: step.status === 'error' || step.status === 'denied' ? step.output : null,
  };
}

export function formatTokens(count: number): string {
  if (count < 1000) return String(Math.round(count));
  return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
}

/** `12.3k in · 840 out · $0.04 · 18 s`. */
export function usageLine(usage: ChatUsage): string {
  const parts = [
    `${formatTokens(usage.inputTokens + usage.cacheReadTokens)} in`,
    `${formatTokens(usage.outputTokens)} out`,
  ];
  if (usage.costUsd > 0) parts.push(`$${usage.costUsd.toFixed(2)}`);
  if (usage.durationMs > 0)
    parts.push(`${String(Math.max(1, Math.round(usage.durationMs / 1000)))} s`);
  return parts.join(' · ');
}

/** What the user asked, as shown in their message bubble. */
export function requestText(turn: ChatTurn): string {
  const { chip, text } = turn.request;
  if (chip === null) return text;
  return text.trim() === '' ? CHIP_LABELS[chip] : `${CHIP_LABELS[chip]}\n${text}`;
}

/** `Selection: calculator (s02)` · `Shot s02` · `Whole video`. */
export function scopeText(turn: ChatTurn): string {
  const { scope, shotIds, selectionLabel } = turn.request;
  if (scope === 'selection') return `${SCOPE_LABELS.selection}: ${selectionLabel ?? '?'}`;
  if (scope === 'shot') return shotIds.length === 0 ? 'Shot' : `Shot ${shotIds.join(', ')}`;
  return SCOPE_LABELS.video;
}

export function turnStatusText(turn: ChatTurn): string | undefined {
  switch (turn.status) {
    case 'queued':
      return 'Waiting in the queue';
    case 'running':
      return 'Claude is working…';
    case 'stopped':
      return 'Stopped. What Claude changed so far is kept.';
    case 'failed':
      if (turn.resumable) {
        const reason = turn.error === null ? '' : ` (${turn.error.message})`;
        return `Interrupted${reason}. What Claude changed so far is kept; Resume continues the turn.`;
      }
      return turn.error === null ? 'Failed' : `Failed: ${turn.error.message}`;
    case 'done':
      return undefined;
  }
}

/** The engine's pick at a clicked point -> the selection of a chat request. */
export function toSelection(pick: PickInfo, x: number, y: number): ChatSelection {
  const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);
  return {
    kind: pick.kind,
    shotId: pick.shotId,
    t: Math.max(pick.t, 0),
    localTime: pick.localTime,
    x: clamp(x),
    y: clamp(y),
    name: pick.name.slice(0, 200),
    id: pick.id.slice(0, 200),
    call: pick.call ?? null,
    occurrence: pick.occurrence ?? null,
    sceneName: pick.sceneName ?? null,
    parent: pick.parent ?? null,
    position: pick.position ?? null,
    size: pick.size ?? null,
    description: pick.description.slice(0, 600),
  };
}

export function selectionText(selection: ChatSelection): string {
  const name = selection.kind === 'text' ? `"${selection.name}"` : selection.name;
  return `${name} (${selection.shotId})`;
}
