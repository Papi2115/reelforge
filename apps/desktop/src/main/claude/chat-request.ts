/**
 * A chat message turned into a queued turn record (claude-service.ts queues it): the message's
 * scope and selection, the locked-shot refusal and note, the source hint and the prompt.
 */
import { randomUUID } from 'node:crypto';
import type { ModelAlias } from '@reelforge/claude-bridge';
import type { AppSettings } from '@reelforge/shared';
import type {
  ChatScope,
  ChatSendRequest,
  ChatSendResult,
  ChatTurn,
} from '../../shared/chat-contract.js';
import { chatTurnModel } from '../settings-consumers.js';
import { chatLocks, lockedShotsNote } from './chat-locks.js';
import { buildChatPrompt, findSourceHint, requestTitle, selectionLabel } from './chat-prompt.js';
import { queuedTurn } from './turn-outcome.js';

export interface TurnRecord {
  turn: ChatTurn;
  readonly projectDir: string;
  readonly prompt: string;
  readonly model: ModelAlias;
  readonly title: string;
  /** Id of the interrupted turn this record resumes (runs via `resumeInterrupted`). */
  readonly resumeOf?: string;
}

/** A queued record and its scope, or the refusal to send back (`status: 'error'`). */
export type PreparedChatTurn =
  | { readonly status: 'ready'; readonly record: TurnRecord; readonly scope: ChatScope }
  | Extract<ChatSendResult, { status: 'error' }>;

/** The record of a (non-chip) chat message for the project `dir`; `now` stamps the queued turn. */
export async function prepareChatTurn(
  dir: string,
  request: ChatSendRequest,
  settings: () => AppSettings,
  now: () => number,
): Promise<PreparedChatTurn> {
  const scope = request.chip === null ? request.scope : 'video';
  const selection = scope === 'selection' ? request.selection : null;
  if (scope === 'selection' && selection === null) {
    const message = 'nothing is selected: click an object in the preview first';
    return { status: 'error', error: { kind: 'invalid-request', message } };
  }
  const locks = await chatLocks(dir, scope, request.shotIds, selection);
  if (locks.refusal !== null) {
    return { status: 'error', error: { kind: 'invalid-request', message: locks.refusal } };
  }
  const hint = selection === null ? undefined : await findSourceHint(dir, selection);
  const built = buildChatPrompt({
    request: { ...request, scope, selection },
    hint,
    lockedNote: lockedShotsNote(locks.locked),
  });
  if (!built.ok) {
    return { status: 'error', error: { kind: 'invalid-request', message: built.message } };
  }
  const model = chatTurnModel(settings(), request.boost);
  const record: TurnRecord = {
    projectDir: dir,
    prompt: built.prompt,
    model,
    title: requestTitle(request),
    turn: queuedTurn(randomUUID(), now(), {
      text: request.text,
      chip: request.chip,
      scope,
      shotIds: scope === 'video' ? [] : [...request.shotIds],
      selectionLabel: selection === null ? null : selectionLabel(selection),
      model,
    }),
  };
  return { status: 'ready', record, scope };
}
