/**
 * "Open terminal and log in" (PLAN.md §2.1): a new console window running `claude auth login`.
 * The login happens entirely inside Claude Code; ReelForge never sees or stores credentials. The
 * command is fixed (the detected claude executable + `auth login`), never renderer input, and
 * the console gets the sanitized env so a stray API key cannot take over the login.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { err, ok, sanitizeEnv, type LoginAction, type Result } from '@reelforge/claude-bridge';

export interface TerminalCommand {
  readonly command: string;
  readonly args: readonly string[];
  /** Windows: arguments are passed as written (cmd.exe has its own quoting rules). */
  readonly verbatim: boolean;
}

/** Characters cmd.exe would interpret even inside our quoting (or that break it). */
const CMD_UNSAFE = /["%^&|<>!\r\n]/;
const WINDOW_TITLE = 'ReelForge - Claude login';

function cmdExe(env: NodeJS.ProcessEnv): string {
  const root = env['SystemRoot'] ?? env['SYSTEMROOT'] ?? 'C:\\Windows';
  return path.win32.join(root, 'System32', 'cmd.exe');
}

/**
 * Windows: `cmd /d /s /c "start "<title>" "<cmd.exe>" /d /s /k ""<claude.exe>" auth login""`.
 * `start` opens a new console; `/k` keeps it open after the login so the user can read the result.
 * Each `/s` strips exactly the outer quote pair, so paths with spaces and parentheses survive.
 */
export function loginTerminalCommand(
  action: LoginAction,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): Result<TerminalCommand, string> {
  if (platform !== 'win32') {
    return err(`open a terminal and run: ${action.display}`);
  }
  const parts = [action.command, ...action.args];
  const unsafe = parts.find((part) => part === '' || CMD_UNSAFE.test(part));
  if (unsafe !== undefined) {
    return err(
      `cannot open a terminal for ${JSON.stringify(unsafe)}; run ${action.display} yourself`,
    );
  }
  const quoted = parts.map((part) => (/\s|[()]/.test(part) ? `"${part}"` : part)).join(' ');
  const shell = cmdExe(env);
  const inner = `"${shell}" /d /s /k "${quoted}"`;
  return ok({
    command: shell,
    args: ['/d', '/s', '/c', `"start "${WINDOW_TITLE}" ${inner}"`],
    verbatim: true,
  });
}

export type SpawnDetached = (
  command: TerminalCommand,
  env: Record<string, string>,
) => Promise<Result<void, string>>;

/** Starts the short-lived `cmd /c start …` helper; the console window lives on by itself. */
export const spawnTerminal: SpawnDetached = (command, env) =>
  new Promise((resolve) => {
    try {
      const child = spawn(command.command, [...command.args], {
        env,
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
        windowsVerbatimArguments: command.verbatim,
      });
      child.once('error', (error) => {
        resolve(err(`could not open a terminal: ${error.message}`));
      });
      child.once('exit', (code) => {
        resolve(code === 0 ? ok(undefined) : err(`terminal helper exited with ${String(code)}`));
      });
    } catch (error) {
      resolve(err(`could not open a terminal: ${String(error)}`));
    }
  });

export async function openLoginTerminal(
  action: LoginAction,
  options: {
    readonly platform: NodeJS.Platform;
    readonly env: NodeJS.ProcessEnv;
    readonly spawn?: SpawnDetached;
  },
): Promise<Result<void, string>> {
  const command = loginTerminalCommand(action, options.platform, options.env);
  if (!command.ok) return command;
  return (options.spawn ?? spawnTerminal)(command.value, sanitizeEnv(options.env));
}
