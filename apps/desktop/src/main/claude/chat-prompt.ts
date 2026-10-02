/**
 * Chat message -> the prompt of one chat turn (PLAN.md#6.6): the user's words wrapped with their
 * scope through the `scene-fix` template of @reelforge/prompts (scope, shot ids, the object picked
 * in the preview, the request). Whole-video chips map to prepared instructions (PLAN.md#7.6; the
 * full review automation comes later, for now the review is one prompt). For a picked object the
 * scene file is looked up in storyboard.json and the call that created it is located in the
 * source as a line hint. Reads only inside the project.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPrompt } from '@reelforge/prompts';
import { storyboardFileSchema } from '@reelforge/shared';
import {
  CHIP_LABELS,
  SCOPE_LABELS,
  type ChatChip,
  type ChatSelection,
  type ChatSendRequest,
} from '../../shared/chat-contract.js';
import { isInsideFolder } from '../project-files.js';

export const CHIP_INSTRUCTIONS: Readonly<Record<ChatChip, string>> = {
  'review-video':
    'Review the whole video and fix what looks wrong. Run `reelforge contact-sheet --all` and Read the sheet; look for blank or broken frames, unreadable or clipped text, objects cut by the frame edge, colours outside the style and shots that do not show what their storyboard intent says. Run `reelforge lint` and `reelforge validate` too. Fix the worst problems scene by scene (smallest edits), re-render each shot you changed with `reelforge frames --shot <id>` and Read the frames to confirm. Finish with a short list: what you found, what you fixed, what is left.',
  'readable-text':
    'Make all on-screen text easier to read on a phone. For every shot with text cards: keep each card short, use a larger text scale where it fits the safe area, give text enough contrast against the background (a plate or a darker backdrop) and keep it on screen long enough to read (about 0.3 s per word, at least 1.2 s). Check every changed shot with `reelforge frames --shot <id>` and Read the frames; no card may overlap another or leave the safe area.',
  'visuals-on-words':
    'Check that every visual lands on its spoken word. For every shot run `reelforge anchors --shot <id>` and compare each animation beat with the word it illustrates in timing/words.json. Where a visual misses its word by more than 150 ms, drive it from `ctx.anchor("<phrase>")` instead of a hard-coded time. Re-run `reelforge anchors` for the shots you changed and list what moved.',
};

/** `calculator (s02)` / `text "MEMORY" (s02)`. */
export function selectionLabel(selection: ChatSelection): string {
  const name = selection.kind === 'text' ? `text "${selection.name}"` : selection.name;
  return `${name} (${selection.shotId})`;
}

/** Line (1-based) of the `occurrence`-th match of `needle` in `source`, else of the first one. */
export function lineOfOccurrence(
  source: string,
  needle: string,
  occurrence: number,
): number | undefined {
  const offsets: number[] = [];
  for (
    let index = source.indexOf(needle);
    index !== -1;
    index = source.indexOf(needle, index + 1)
  ) {
    offsets.push(index);
  }
  const offset = offsets[occurrence] ?? offsets[0];
  return offset === undefined ? undefined : source.slice(0, offset).split('\n').length;
}

/** What to search the scene source for: the kit call, the card id or the object's name. */
function sourceNeedle(
  selection: ChatSelection,
): { needle: string; occurrence: number } | undefined {
  if (selection.call !== null) {
    // `kit.props.calculator()` -> `props.calculator(` (scenes often destructure `kit`).
    const call = selection.call.replace(/^kit\./, '').replace(/\(\)$/, '(');
    return { needle: call, occurrence: selection.occurrence ?? 0 };
  }
  if (selection.kind === 'text') {
    const id = selection.id.replace(/^text:/, '');
    return id === '' ? undefined : { needle: `'${id}'`, occurrence: 0 };
  }
  const name = selection.sceneName ?? selection.name;
  return name === '' ? undefined : { needle: `'${name}'`, occurrence: 0 };
}

export interface SourceHint {
  readonly file: string;
  readonly line: number | undefined;
}

/** Scene file of the picked object's shot (from storyboard.json) and the line that created it. */
export async function findSourceHint(
  projectDir: string,
  selection: ChatSelection,
): Promise<SourceHint | undefined> {
  let storyboard: unknown;
  try {
    storyboard = JSON.parse(await readFile(path.join(projectDir, 'storyboard.json'), 'utf8'));
  } catch {
    return undefined; // no or unreadable storyboard: the prompt simply carries no hint
  }
  const parsed = storyboardFileSchema.safeParse(storyboard);
  const file = parsed.success
    ? parsed.data.shots.find((shot) => shot.id === selection.shotId)?.scene
    : undefined;
  if (file === undefined) return undefined;
  const absolute = path.resolve(projectDir, file);
  if (!isInsideFolder(path.resolve(projectDir), absolute)) return undefined;
  let source: string;
  try {
    source = await readFile(absolute, 'utf8');
  } catch {
    return { file, line: undefined };
  }
  const needle = sourceNeedle(selection);
  const line =
    needle === undefined ? undefined : lineOfOccurrence(source, needle.needle, needle.occurrence);
  return { file, line };
}

function formatSeconds(value: number): string {
  return `${value.toFixed(2)} s`;
}

/** One paragraph about the picked object for the `{{selection}}` slot of the template. */
export function describeSelection(selection: ChatSelection, hint: SourceHint | undefined): string {
  const where = hint === undefined ? '' : ` Scene file: ${hint.file}`;
  const line =
    hint?.line === undefined
      ? ''
      : `, probably created at line ${String(hint.line)}${selection.call === null ? '' : ` (${selection.call} call #${String((selection.occurrence ?? 0) + 1)})`}`;
  return [
    `${selection.description}.`,
    ` Shot ${selection.shotId}, picked at local t = ${formatSeconds(selection.localTime)} (global ${formatSeconds(selection.t)}),`,
    ` at ${String(Math.round(selection.x * 100))}% x ${String(Math.round(selection.y * 100))}% of the frame (from the top-left).`,
    where === '' ? '' : `${where}${line}.`,
  ].join('');
}

export interface ChatPromptInput {
  readonly request: ChatSendRequest;
  readonly hint: SourceHint | undefined;
}

export type ChatPromptResult =
  { readonly ok: true; readonly prompt: string } | { readonly ok: false; readonly message: string };

/** The user's request text: the chip's instruction (plus any words they typed) or their words. */
export function requestText(request: Pick<ChatSendRequest, 'chip' | 'text'>): string {
  const text = request.text.trim();
  if (request.chip === null) return text;
  const instruction = CHIP_INSTRUCTIONS[request.chip];
  return text === '' ? instruction : `${instruction}\n\nAlso: ${text}`;
}

/** First line of what the user asked (commit subjects, transcript titles). */
export function requestTitle(request: Pick<ChatSendRequest, 'chip' | 'text'>): string {
  if (request.chip !== null && request.text.trim() === '') return CHIP_LABELS[request.chip];
  const line = request.text.split(/\r?\n/).find((candidate) => candidate.trim() !== '') ?? '';
  return line.trim();
}

export function buildChatPrompt(input: ChatPromptInput): ChatPromptResult {
  const { request } = input;
  const scope = request.chip === null ? request.scope : 'video';
  const selection =
    scope === 'selection' && request.selection !== null
      ? describeSelection(request.selection, input.hint)
      : undefined;
  const shotIds =
    scope === 'video' || request.shotIds.length === 0 ? 'all' : request.shotIds.join(', ');
  const rendered = renderPrompt('scene-fix', {
    scope: SCOPE_LABELS[scope],
    shotIds,
    selection,
    request: requestText(request),
  });
  return rendered.ok
    ? { ok: true, prompt: rendered.value }
    : { ok: false, message: `scene-fix prompt: ${rendered.error.kind}` };
}
