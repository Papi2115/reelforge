/**
 * The app's one SessionManager (PLAN.md#5.2, #6.6) from the resolved Claude setup: the shared
 * LimitGuard and usage ledger, the concurrency the pipeline may use (scene building: 2), the
 * render-service env for the project's children and the bash guard permissions.
 */
import {
  err,
  ok,
  SessionManager,
  type ExtraEnv,
  type LimitGuard,
  type Result,
  type UsageLedger,
} from '@reelforge/claude-bridge';
import type { ChatError } from '../../shared/chat-contract.js';
import type { ClaudeSetup } from './claude-service.js';
import { chatExtraEnv } from './turn-outcome.js';

export interface SessionDeps {
  readonly guard: LimitGuard;
  readonly usage: UsageLedger;
  readonly concurrency: number;
  readonly renderEnv: (projectDir: string) => ExtraEnv | undefined;
  readonly exitGraceMs?: number | undefined;
}

export function createSessionManager(
  setup: ClaudeSetup,
  deps: SessionDeps,
): Result<SessionManager, ChatError> {
  try {
    return ok(
      new SessionManager({
        launcher: setup.launcher,
        env: setup.env,
        extraEnv: (dir) => chatExtraEnv(deps.renderEnv(dir)),
        guard: deps.guard,
        concurrency: deps.concurrency,
        usage: deps.usage,
        permissions: setup.permissions,
        ...(deps.exitGraceMs === undefined ? {} : { exitGraceMs: deps.exitGraceMs }),
      }),
    );
  } catch (error) {
    return err({ kind: 'setup', message: error instanceof Error ? error.message : String(error) });
  }
}
