/**
 * How the desktop app runs `claude` for the ClaudeService (PLAN.md#6.6, ADR-001): the launcher
 * comes from the "Connect Claude" check (the real CLI on the user's subscription; a test hook can
 * point unpackaged runs at fake-claude), the PreToolUse bash guard runs on the app's own binary as
 * Node (`ELECTRON_RUN_AS_NODE=1`) from the copy shipped in hooks/ (AppLayout), and the `reelforge` CLI
 * launchers are written into `<userData>/bin`, which goes first on the children's PATH. Only the
 * parent env is given here; the bridge sanitizes it on every spawn.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  err,
  ok,
  type ClaudeLauncher,
  type ConnectionState,
  type Result,
} from '@reelforge/claude-bridge';
import type { CliShimOptions } from '@reelforge/cli/shims';
import { z } from 'zod';
import type { ChatError } from '../../shared/chat-contract.js';
import { TEST_CLAUDE_LAUNCHER_ENV, type AppLayout } from '../app-paths.js';
import type { Logger } from '../logger.js';
import type { ClaudeSetup } from './claude-service.js';

const launcherSchema = z.strictObject({
  command: z.string().min(1),
  args: z.array(z.string()).max(16),
});

/** The test-hook launcher (unpackaged runs only); undefined when unset or malformed. */
export function testLauncher(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): ClaudeLauncher | undefined {
  const raw = env[TEST_CLAUDE_LAUNCHER_ENV];
  if (isPackaged || raw === undefined || raw === '') return undefined;
  try {
    const parsed = launcherSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined; // malformed JSON: the hook is ignored and the real check runs
  }
}

/** Launcher of a connected CLI, else what to tell the user. */
export function launcherOf(state: ConnectionState): Result<ClaudeLauncher, ChatError> {
  switch (state.state) {
    case 'ok':
      return ok(state.launcher);
    case 'not-installed':
      return err({
        kind: 'not-connected',
        message: `Claude Code is not installed. Install it (${state.installHint}), then connect it in Settings.`,
      });
    case 'not-logged-in':
      return err({
        kind: 'not-connected',
        message: `Claude Code is not logged in. Run "${state.loginAction.display}" (Settings → Claude).`,
      });
    case 'error':
      return err({
        kind: 'not-connected',
        message: `Claude Code cannot be used: ${state.message}`,
      });
  }
}

/**
 * Parent env of the claude children: the shim folder first on PATH (whatever the case of the
 * PATH variable on Windows) and ELECTRON_RUN_AS_NODE=1 for the bash guard hook, which runs on the
 * app binary.
 */
export function claudeChildEnv(
  env: NodeJS.ProcessEnv,
  shimDir: string | undefined,
  platform: NodeJS.Platform,
): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { ...env, ELECTRON_RUN_AS_NODE: '1' };
  if (shimDir === undefined) return result;
  const key = Object.keys(result).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  const delimiter = platform === 'win32' ? ';' : ':';
  const current = result[key];
  result[key] =
    current === undefined || current === '' ? shimDir : `${shimDir}${delimiter}${current}`;
  return result;
}

export interface ClaudeRuntimeOptions {
  readonly layout: AppLayout;
  readonly shimDir: string;
  readonly env: NodeJS.ProcessEnv;
  /** The app binary (Electron), run as Node for the hook and the CLI launchers. */
  readonly execPath: string;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform;
  /** Fresh "Connect Claude" check (cached briefly by the connection service). */
  readonly connection: () => Promise<ConnectionState>;
  readonly writeShims: (options: CliShimOptions) => Promise<string[]>;
  /** Settings → "Experimental worlds (preview)" (PLAN.md#13.6); off when omitted. */
  readonly experimentalWorlds?: () => boolean;
  readonly log: Logger;
}

/** = `EXPERIMENTAL_WORLDS_ENV` of @reelforge/cli (its root module is not bundled into main). */
export const EXPERIMENTAL_WORLDS_VAR = 'REELFORGE_EXPERIMENTAL_WORLDS';

/**
 * Env the `reelforge` launchers set for the CLI: the app binary runs as Node, and with
 * experimental worlds on the CLI offers their looks (kit-docs, looks) like the stages do. Only
 * this one app var is added; Claude's own env is sanitized by the bridge as always.
 */
export function cliShimEnv(experimentalWorlds: boolean): Record<string, string> {
  return {
    ELECTRON_RUN_AS_NODE: '1',
    ...(experimentalWorlds ? { [EXPERIMENTAL_WORLDS_VAR]: '1' } : {}),
  };
}

/**
 * Writes the `reelforge` launchers into the shim folder; undefined when they cannot be written.
 * Called on every Claude setup and again when the experimental switch changes.
 */
export async function prepareShims(options: ClaudeRuntimeOptions): Promise<string | undefined> {
  if (!existsSync(options.layout.cliBundle)) {
    options.log.warn(
      `reelforge CLI bundle missing (${options.layout.cliBundle}); Claude cannot run it`,
    );
    return undefined;
  }
  try {
    await options.writeShims({
      dir: options.shimDir,
      runtime: options.execPath,
      script: options.layout.cliBundle,
      env: cliShimEnv(options.experimentalWorlds?.() === true),
      platform: options.platform,
    });
    return options.shimDir;
  } catch (error) {
    options.log.warn(
      `reelforge launchers not written: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

/** `ClaudeServiceOptions.setup` for the desktop app. */
export function claudeSetup(
  options: ClaudeRuntimeOptions,
): () => Promise<Result<ClaudeSetup, ChatError>> {
  return async () => {
    const hooked = testLauncher(options.env, options.isPackaged);
    if (hooked !== undefined) options.log.warn('test hook: chat turns use a stand-in claude');
    const launcher = hooked === undefined ? launcherOf(await options.connection()) : ok(hooked);
    if (!launcher.ok) return launcher;
    if (!existsSync(options.layout.bashGuardHook)) {
      return err({
        kind: 'setup',
        message: `bash guard hook missing (${options.layout.bashGuardHook}); reinstall ReelForge`,
      });
    }
    const shimDir = await prepareShims(options);
    return ok({
      launcher: launcher.value,
      env: claudeChildEnv(
        options.env,
        shimDir === undefined ? undefined : path.resolve(shimDir),
        options.platform,
      ),
      permissions: { hookRuntime: options.execPath, hookScriptPath: options.layout.bashGuardHook },
    });
  };
}
