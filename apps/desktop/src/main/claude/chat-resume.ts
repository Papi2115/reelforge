/**
 * Resuming a chat turn whose claude process died (PLAN.md#10.2): crashed, killed from outside
 * (`taskkill /T /F`) or timed out. The bridge keeps such a turn as `pendingTurn` (interrupted) in
 * sessions.json; Resume re-runs it in the stored session (`--resume`) with the bridge's
 * continuation prompt ("check the current state of the files, then finish the original task").
 *
 * Partial edits rule: what the killed turn already wrote is KEPT and committed like every turn
 * (`Claude turn (failed): …`), so it is one click to revert in History; the resumed turn starts
 * from that state (the continuation prompt tells Claude to check the files first).
 */
import {
  ECONOMY_HINT,
  type ModelAlias,
  type SessionManager,
  type TurnHandle,
} from '@reelforge/claude-bridge';
import type { ChatError } from '../../shared/chat-contract.js';

export interface ChatTurnSpec {
  readonly projectDir: string;
  readonly prompt: string;
  readonly model: ModelAlias;
  /** Set: continue the interrupted turn of the main session instead of sending `prompt`. */
  readonly resumeOf?: string;
}

type Started = { readonly handle: TurnHandle } | { readonly error: ChatError };

/** The bridge turn of a chat message: a fresh one, or the continuation of an interrupted one. */
export function startChatTurn(
  manager: SessionManager,
  spec: ChatTurnSpec,
  economy: boolean,
): Promise<Started> {
  if (spec.resumeOf !== undefined) return startResumedTurn(manager, spec.projectDir);
  const handle = manager.enqueue({
    projectDir: spec.projectDir,
    stage: 'chat',
    purpose: 'main',
    prompt: spec.prompt,
    model: spec.model,
    ...(economy ? { appendSystemPrompt: ECONOMY_HINT } : {}),
  });
  return Promise.resolve({ handle });
}

/** Starts the resumed run of `projectDir`'s interrupted main-session turn. */
async function startResumedTurn(manager: SessionManager, projectDir: string): Promise<Started> {
  const resumed = await manager.resumeInterrupted(projectDir, 'main');
  if (resumed.ok) return { handle: resumed.value };
  switch (resumed.error.kind) {
    case 'nothing-to-resume':
      return {
        error: {
          kind: 'invalid-request',
          message: 'Nothing to resume: the interrupted turn already finished or was replaced.',
        },
      };
    case 'still-running':
      return { error: { kind: 'invalid-request', message: 'That turn is still running.' } };
    case 'store':
      return {
        error: {
          kind: 'failed',
          message: `.reelforge/sessions.json cannot be read (${resumed.error.error.message}); reset it from the damaged-files banner`,
        },
      };
  }
}
