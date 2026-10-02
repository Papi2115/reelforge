/**
 * Connection wizard backend (PLAN.md#5.1, §2.1): is the CLI installed, recent enough, logged in?
 * Uses only `claude --version` and `claude auth status` (no model call, no credential access).
 * Never surfaces e-mail/org from `auth status`: only loggedIn/authMethod/subscriptionType/apiProvider.
 */
import { z } from 'zod';
import { resolveClaudeExecutable } from './executable.js';
import { runCapture, type ClaudeLauncher } from './process.js';

/** Oldest CLI the bridge is verified against (docs/spikes/01-claude-cli.md). */
export const MIN_CLAUDE_VERSION = '2.1.287';
/** Newest CLI verified; newer versions work but are flagged `aboveTested`. */
export const MAX_TESTED_CLAUDE_VERSION = '2.1.287';
/** One-line install command shown when the CLI is missing (npm global install, verified). */
export const INSTALL_HINT = 'npm install -g @anthropic-ai/claude-code';

const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

/** Data for the UI: open a terminal running this; the login itself happens inside Claude Code. */
export interface LoginAction {
  readonly kind: 'open-terminal';
  readonly command: string;
  readonly args: readonly string[];
  readonly display: string;
}

export interface DetectOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  /** Skip PATH resolution (tests: fake-claude; settings: user-chosen exe). */
  readonly launcher?: ClaudeLauncher;
  readonly minVersion?: string;
  readonly maxTestedVersion?: string;
  readonly timeoutMs?: number;
  readonly cwd?: string;
}

export type Detection =
  | {
      readonly status: 'not-installed';
      readonly searched: readonly string[];
      readonly installHint: string;
    }
  | {
      readonly status: 'found';
      readonly launcher: ClaudeLauncher;
      readonly version: string;
      readonly aboveTested: boolean;
    }
  | {
      readonly status: 'outdated';
      readonly launcher: ClaudeLauncher;
      readonly version: string;
      readonly minVersion: string;
      readonly installHint: string;
    }
  | { readonly status: 'error'; readonly message: string };

export type AuthCheck =
  | {
      readonly status: 'logged-in';
      readonly authMethod: string | undefined;
      readonly subscriptionType: string | undefined;
      readonly apiProvider: string | undefined;
    }
  | { readonly status: 'not-logged-in'; readonly loginAction: LoginAction }
  | {
      readonly status: 'error';
      readonly reason: 'api-key-source' | 'unparseable' | 'spawn' | 'timeout';
      readonly message: string;
    };

export type ConnectionState =
  | {
      readonly state: 'not-installed';
      readonly installHint: string;
      readonly searched: readonly string[];
    }
  | { readonly state: 'not-logged-in'; readonly version: string; readonly loginAction: LoginAction }
  | {
      readonly state: 'ok';
      readonly version: string;
      readonly aboveTested: boolean;
      readonly launcher: ClaudeLauncher;
      readonly authMethod: string | undefined;
      readonly subscriptionType: string | undefined;
    }
  | {
      readonly state: 'error';
      readonly reason:
        | 'outdated'
        | 'version-unreadable'
        | 'api-key-source'
        | 'auth-unparseable'
        | 'spawn'
        | 'timeout';
      readonly message: string;
    };

/** `2.1.287 (Claude Code)` -> `2.1.287`. */
export function parseVersion(output: string): string | undefined {
  return /^\s*(\d+\.\d+\.\d+)/.exec(output)?.[1];
}

/** Numeric semver-core comparison: negative, 0 or positive. */
export function compareVersions(left: string, right: string): number {
  const parts = (version: string): number[] => version.split('.').map((part) => Number(part));
  const [a, b] = [parts(left), parts(right)];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function loginActionFor(launcher: ClaudeLauncher): LoginAction {
  return {
    kind: 'open-terminal',
    command: launcher.command,
    args: [...launcher.args, 'auth', 'login'],
    display: 'claude auth login',
  };
}

function probeOptions(options: DetectOptions): {
  env: NodeJS.ProcessEnv;
  cwd: string;
  timeoutMs: number;
} {
  return {
    env: options.env ?? process.env,
    cwd: options.cwd ?? process.cwd(),
    timeoutMs: options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
  };
}

/** Finds the CLI and checks its version against the supported range. */
export async function detectClaude(options: DetectOptions = {}): Promise<Detection> {
  const env = options.env ?? process.env;
  let launcher = options.launcher;
  if (launcher === undefined) {
    const resolution = resolveClaudeExecutable({
      env,
      platform: options.platform ?? process.platform,
    });
    if (resolution.executable === undefined) {
      return { status: 'not-installed', searched: resolution.searched, installHint: INSTALL_HINT };
    }
    launcher = { command: resolution.executable, args: [] };
  }
  const run = await runCapture(launcher, ['--version'], probeOptions(options));
  if (!run.ok) return { status: 'error', message: run.error.message };
  const version = parseVersion(run.value.stdout);
  if (run.value.code !== 0 || version === undefined) {
    return {
      status: 'error',
      message: `cannot read the claude version (exit ${String(run.value.code)})`,
    };
  }
  const minVersion = options.minVersion ?? MIN_CLAUDE_VERSION;
  if (compareVersions(version, minVersion) < 0) {
    return { status: 'outdated', launcher, version, minVersion, installHint: INSTALL_HINT };
  }
  const maxTested = options.maxTestedVersion ?? MAX_TESTED_CLAUDE_VERSION;
  return {
    status: 'found',
    launcher,
    version,
    aboveTested: compareVersions(version, maxTested) > 0,
  };
}

const authStatusSchema = z.looseObject({
  loggedIn: z.boolean(),
  authMethod: z.string().optional(),
  apiProvider: z.string().optional(),
  subscriptionType: z.string().nullable().optional(),
  apiKeySource: z.string().optional(),
});

/** `claude auth status` (JSON, exit 0 logged in / 1 not). Only non-identifying fields are kept. */
export async function checkAuth(
  launcher: ClaudeLauncher,
  options: Omit<DetectOptions, 'launcher'> = {},
): Promise<AuthCheck> {
  const run = await runCapture(launcher, ['auth', 'status', '--json'], probeOptions(options));
  if (!run.ok) return { status: 'error', reason: run.error.kind, message: run.error.message };
  let json: unknown;
  try {
    json = JSON.parse(run.value.stdout);
  } catch {
    // The raw output may contain account details: never echo it.
    return { status: 'error', reason: 'unparseable', message: 'auth status did not return JSON' };
  }
  const parsed = authStatusSchema.safeParse(json);
  if (!parsed.success) {
    return { status: 'error', reason: 'unparseable', message: 'unexpected auth status shape' };
  }
  const status = parsed.data;
  if (status.apiKeySource !== undefined && status.apiKeySource !== 'none') {
    return {
      status: 'error',
      reason: 'api-key-source',
      message: `the CLI would bill an API key (${status.apiKeySource}); ReelForge only uses the subscription`,
    };
  }
  if (!status.loggedIn) return { status: 'not-logged-in', loginAction: loginActionFor(launcher) };
  return {
    status: 'logged-in',
    authMethod: status.authMethod,
    subscriptionType: status.subscriptionType ?? undefined,
    apiProvider: status.apiProvider,
  };
}

/** Full wizard check: not-installed | not-logged-in | ok(+version) | error. */
export async function checkConnection(options: DetectOptions = {}): Promise<ConnectionState> {
  const detection = await detectClaude(options);
  switch (detection.status) {
    case 'not-installed':
      return {
        state: 'not-installed',
        installHint: detection.installHint,
        searched: detection.searched,
      };
    case 'error':
      return { state: 'error', reason: 'version-unreadable', message: detection.message };
    case 'outdated':
      return {
        state: 'error',
        reason: 'outdated',
        message: `claude ${detection.version} is older than ${detection.minVersion}; update with: ${detection.installHint}`,
      };
    case 'found':
      break;
  }
  const auth = await checkAuth(detection.launcher, options);
  switch (auth.status) {
    case 'not-logged-in':
      return { state: 'not-logged-in', version: detection.version, loginAction: auth.loginAction };
    case 'error':
      return {
        state: 'error',
        reason: auth.reason === 'unparseable' ? 'auth-unparseable' : auth.reason,
        message: auth.message,
      };
    case 'logged-in':
      return {
        state: 'ok',
        version: detection.version,
        aboveTested: detection.aboveTested,
        launcher: detection.launcher,
        authMethod: auth.authMethod,
        subscriptionType: auth.subscriptionType,
      };
  }
}
