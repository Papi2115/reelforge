/**
 * Typed handle on the fake `claude` CLI (bin/fake-claude.mjs) for tests: where it lives, how to
 * launch it without a shell or `.cmd` shim, and the env knobs that select its behaviour.
 */
import path from 'node:path';

export const packageName = '@reelforge/fake-claude';

/** Absolute path of the fake CLI script (works from `src/` and from `dist/`). */
export const fakeClaudeBinPath = path.join(import.meta.dirname, '..', 'bin', 'fake-claude.mjs');

/** Recorded fixtures replayed by the fake (seeded from spikes/01-cli-bridge, CLI 2.1.287). */
export const fakeClaudeFixturesDir = path.join(import.meta.dirname, '..', 'fixtures');

export const FAKE_CLAUDE_SCENARIOS = [
  'ok',
  'tools-read-png',
  'tools-edit',
  'tools-escape',
  'tools-write',
  'resume',
  'slow',
  'hang',
  'crash',
  'garbage',
  'not-logged-in',
  'rate-limit',
  'limit-warning',
  'api-key',
  'resume-not-found',
] as const;
export type FakeClaudeScenario = (typeof FAKE_CLAUDE_SCENARIOS)[number];

/** ASSUMED usage-limit stream shapes (never observed live, see ADR-001 and README). */
export const FAKE_CLAUDE_LIMIT_SHAPES = ['full', 'event-only', 'error-only', 'text-only'] as const;
export type FakeClaudeLimitShape = (typeof FAKE_CLAUDE_LIMIT_SHAPES)[number];

/** Same `{command, args}` shape the bridge accepts as an executable override. */
export interface FakeClaudeLauncher {
  readonly command: string;
  readonly args: readonly string[];
}

/** `node <bin>`: spawns the fake via the current Node binary (no shell, Windows-safe). */
export function fakeClaudeLauncher(): FakeClaudeLauncher {
  return { command: process.execPath, args: [fakeClaudeBinPath] };
}

export interface FakeClaudeOptions {
  readonly scenario?: FakeClaudeScenario;
  /** Sidecar JSON choosing scenarios per prompt or per call (see README). */
  readonly script?: string;
  readonly reply?: string;
  readonly delayMs?: number;
  readonly slowTicks?: number;
  readonly limitShape?: FakeClaudeLimitShape;
  readonly resetsAt?: number;
  readonly exitCode?: number;
  readonly exitDelayMs?: number;
  readonly version?: string;
  readonly auth?: 'logged-in' | 'logged-out';
  readonly subscriptionType?: string;
  /** Emit a leading `fake_probe` event with argv, stdin, cwd and claude-related env key names. */
  readonly probe?: boolean;
  /** Track sessions here; `--resume` of an unknown id then fails. */
  readonly stateDir?: string;
  /** Spawn a long-lived grandchild and write its pid here (kill-tree tests). */
  readonly childPidFile?: string;
}

/** A file the `tools-write` scenario writes (path relative to the fake's cwd, must stay inside). */
export interface FakeClaudeFileWrite {
  readonly path: string;
  readonly content: string;
}

/** One sidecar step (see README "Sidecar script"); its fields override the env knobs. */
export interface FakeClaudeStep {
  readonly scenario: FakeClaudeScenario;
  readonly reply?: string;
  readonly delayMs?: number;
  readonly ticks?: number;
  readonly limitShape?: FakeClaudeLimitShape;
  readonly resetsAt?: number;
  readonly exitCode?: number;
  /** `tools-write` only: files to write, each announced as a Write tool_use + tool_result. */
  readonly writes?: readonly FakeClaudeFileWrite[];
}

/** Sidecar JSON for `FAKE_CLAUDE_SCRIPT`. */
export interface FakeClaudeScript {
  readonly version: 1;
  readonly sequence?: readonly (FakeClaudeScenario | FakeClaudeStep)[];
  readonly rules?: readonly (FakeClaudeStep & { readonly promptIncludes: string })[];
  readonly default?: FakeClaudeScenario | FakeClaudeStep;
}

/** Builds the `FAKE_CLAUDE_*` env vars for `options` (merge into the child env). */
export function fakeClaudeEnv(options: FakeClaudeOptions): Record<string, string> {
  const entries: [string, string | number | boolean | undefined][] = [
    ['FAKE_CLAUDE_SCENARIO', options.scenario],
    ['FAKE_CLAUDE_SCRIPT', options.script],
    ['FAKE_CLAUDE_REPLY', options.reply],
    ['FAKE_CLAUDE_DELAY_MS', options.delayMs],
    ['FAKE_CLAUDE_SLOW_TICKS', options.slowTicks],
    ['FAKE_CLAUDE_LIMIT_SHAPE', options.limitShape],
    ['FAKE_CLAUDE_RESETS_AT', options.resetsAt],
    ['FAKE_CLAUDE_EXIT_CODE', options.exitCode],
    ['FAKE_CLAUDE_EXIT_DELAY_MS', options.exitDelayMs],
    ['FAKE_CLAUDE_VERSION', options.version],
    ['FAKE_CLAUDE_AUTH', options.auth],
    ['FAKE_CLAUDE_SUBSCRIPTION', options.subscriptionType],
    ['FAKE_CLAUDE_PROBE', options.probe === true ? '1' : undefined],
    ['FAKE_CLAUDE_STATE_DIR', options.stateDir],
    ['FAKE_CLAUDE_CHILD_PID_FILE', options.childPidFile],
  ];
  const env: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (value !== undefined) env[key] = String(value);
  }
  return env;
}
