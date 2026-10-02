/**
 * "Connect Claude" backend for Settings and the status bar (PLAN.md §2.1, #6.7). Wraps the
 * bridge's `checkConnection` (`claude --version` + `claude auth status`, no model call) and maps
 * it to the IPC status, which carries only version / auth method / subscription type. Results are
 * cached briefly so window focus re-checks stay cheap; concurrent checks share one run.
 */
import path from 'node:path';
import {
  INSTALL_HINT,
  type ConnectionState,
  type LoginAction,
  type Result,
} from '@reelforge/claude-bridge';
import type { ClaudeLoginResult, ClaudeStatus } from '../shared/settings-contract.js';
import type { Logger } from './logger.js';

/** A focus re-check within this window reuses the last result. */
export const CLAUDE_STATUS_TTL_MS = 20_000;

export function toClaudeStatus(state: ConnectionState): ClaudeStatus {
  switch (state.state) {
    case 'not-installed':
      return {
        state: 'not-installed',
        installCommand: state.installHint,
        searchedDirs: state.searched.length,
      };
    case 'not-logged-in':
      return {
        state: 'not-logged-in',
        version: state.version,
        loginCommand: state.loginAction.display,
      };
    case 'ok':
      return {
        state: 'connected',
        version: state.version,
        aboveTested: state.aboveTested,
        authMethod: state.authMethod ?? null,
        subscriptionType: state.subscriptionType ?? null,
      };
    case 'error':
      return { state: 'error', reason: state.reason, message: state.message };
  }
}

export interface ClaudeConnectionOptions {
  readonly check: () => Promise<ConnectionState>;
  readonly openTerminal: (action: LoginAction) => Promise<Result<void, string>>;
  readonly log: Logger;
  /** Monotonic ms clock (cache age). */
  readonly now: () => number;
}

export class ClaudeConnectionService {
  private last: { readonly at: number; readonly state: ConnectionState } | undefined;
  private running: Promise<ConnectionState> | undefined;

  constructor(private readonly options: ClaudeConnectionOptions) {}

  async status(refresh: boolean): Promise<ClaudeStatus> {
    return toClaudeStatus(await this.state(refresh));
  }

  /** The raw connection state (with the launcher when connected), cached like `status`. */
  async state(refresh: boolean): Promise<ConnectionState> {
    const cached = this.last;
    if (!refresh && cached !== undefined && this.options.now() - cached.at < CLAUDE_STATUS_TTL_MS) {
      return cached.state;
    }
    return this.check();
  }

  private check(): Promise<ConnectionState> {
    this.running ??= this.options
      .check()
      .catch((error: unknown): ConnectionState => ({
        state: 'error',
        reason: 'spawn',
        message: error instanceof Error ? error.message : String(error),
      }))
      .then((state) => {
        const previous = this.last?.state.state;
        if (previous !== state.state) this.options.log.info(`claude connection: ${state.state}`);
        this.last = { at: this.options.now(), state };
        this.running = undefined;
        return state;
      });
    return this.running;
  }

  /** Only offered while the CLI is installed but not logged in (fresh check first). */
  async openLogin(): Promise<ClaudeLoginResult> {
    const state = await this.check();
    if (state.state !== 'not-logged-in') {
      const message =
        state.state === 'ok'
          ? 'Claude Code is already logged in'
          : state.state === 'not-installed'
            ? `install Claude Code first: ${INSTALL_HINT}`
            : state.message;
      return { status: 'error', message };
    }
    const opened = await this.options.openTerminal(state.loginAction);
    if (!opened.ok) {
      this.options.log.warn(`login terminal: ${opened.error}`);
      return { status: 'error', message: opened.error };
    }
    this.options.log.info('opened a terminal for claude auth login');
    return { status: 'opened', command: state.loginAction.display };
  }
}

/**
 * Env for detection. Test hook (unpackaged only, `CLAUDE_SEARCH_DIR_ENV`): PATH and the home /
 * app-data dirs all point at one folder, so only a `claude` placed there can be found.
 */
export function detectionEnv(
  env: NodeJS.ProcessEnv,
  searchDir: string | undefined,
): NodeJS.ProcessEnv {
  if (searchDir === undefined || searchDir === '') return env;
  const dir = path.resolve(searchDir);
  const result: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (!['PATH', 'APPDATA', 'USERPROFILE', 'HOME'].includes(name.toUpperCase())) {
      result[name] = value;
    }
  }
  return { ...result, PATH: dir, APPDATA: dir, USERPROFILE: dir, HOME: dir };
}
