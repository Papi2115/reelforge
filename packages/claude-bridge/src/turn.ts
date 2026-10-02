/**
 * One headless `claude -p` turn: spawn, stream-parse, watchdogs, billing guard, cancellation.
 * The turn is complete on the `result` line (the process exits ~0.7 s later and is reaped
 * asynchronously). No `--max-turns` exists, so the overall timeout + idle watchdog are ours.
 */
import type { ExtraEnv } from './env.js';
import { LineBuffer, parseStreamLine, type ResultEvent, type StreamEvent } from './events.js';
import {
  classifyFailure,
  limitSignalOf,
  mergeLimitSignals,
  type FailureKind,
  type LimitSignal,
} from './limits.js';
import { killTree, spawnClaude, type ClaudeLauncher } from './process.js';
import { initialTurnView, reduceTurn, type ReduceOptions, type TurnView } from './steps.js';

export type TurnStatus =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'idle-timeout'
  | 'crashed'
  | 'billing-guard'
  | 'spawn-failed';

export interface TurnOutcome {
  readonly status: TurnStatus;
  readonly sessionId: string | undefined;
  readonly result: ResultEvent | undefined;
  readonly view: TurnView;
  /** Set for `failed` (an `is_error` result). */
  readonly failure: FailureKind | undefined;
  readonly limit: LimitSignal | undefined;
  readonly exitCode: number | null;
  /** Last few KB of stderr (diagnostics; only in `.reelforge/debug` dumps of failed turns). */
  readonly stderrTail: string;
  readonly message: string;
  /** Raw stdout lines (capped) of `failed`/`crashed` turns, for debug dumps; else empty. */
  readonly rawStream: readonly string[];
}

export interface TurnSpec {
  readonly launcher: ClaudeLauncher;
  readonly args: readonly string[];
  readonly prompt: string;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  /** Allowlisted app vars for the child (render service URL/token), see `buildChildEnv`. */
  readonly extraEnv?: ExtraEnv | undefined;
  /** Whole-turn limit; undefined = none. */
  readonly timeoutMs?: number | undefined;
  /** Max silence on stdout; undefined = none. */
  readonly idleTimeoutMs?: number | undefined;
  /** How long to wait for the process to exit after `result` before killing it. Default 5 s. */
  readonly exitGraceMs?: number | undefined;
  readonly reduce?: ReduceOptions | undefined;
  readonly onEvent?: ((event: StreamEvent) => void) | undefined;
}

export interface RunningTurn {
  readonly pid: number | undefined;
  /** Resolves once (on `result`, on stop, or on exit), never rejects. */
  readonly outcome: Promise<TurnOutcome>;
  /** Resolves when the process (tree) is gone. */
  readonly exited: Promise<void>;
  cancel(): Promise<void>;
}

const STDERR_TAIL_BYTES = 4096;
/** Raw stream kept for debug dumps (limit/error streams are short; images make others big). */
const RAW_STREAM_MAX_CHARS = 4 * 1024 * 1024;
const RAW_STREAM_STATUSES = new Set<TurnStatus>(['failed', 'crashed']);
const DEFAULT_EXIT_GRACE_MS = 5_000;

type StopReason = 'cancelled' | 'timeout' | 'idle-timeout' | 'billing-guard';

const STOP_MESSAGES: Record<StopReason, string> = {
  cancelled: 'turn cancelled',
  timeout: 'turn exceeded its time limit',
  'idle-timeout': 'no output from claude for too long',
  'billing-guard': 'claude reported an API key source instead of the subscription; turn aborted',
};

function failedSpawn(message: string): RunningTurn {
  const outcome: TurnOutcome = {
    status: 'spawn-failed',
    sessionId: undefined,
    result: undefined,
    view: initialTurnView(),
    failure: undefined,
    limit: undefined,
    exitCode: null,
    stderrTail: '',
    message,
    rawStream: [],
  };
  return {
    pid: undefined,
    outcome: Promise.resolve(outcome),
    exited: Promise.resolve(),
    cancel: () => Promise.resolve(),
  };
}

export function startTurn(spec: TurnSpec): RunningTurn {
  const spawned = spawnClaude(spec.launcher, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    extraEnv: spec.extraEnv,
  });
  if (!spawned.ok) return failedSpawn(spawned.error);
  const child = spawned.value;
  const pid = child.pid;

  const events: StreamEvent[] = [];
  const lines = new LineBuffer();
  let view = initialTurnView();
  let limit: LimitSignal | undefined;
  let stderr = '';
  const rawLines: string[] = [];
  let rawChars = 0;
  let settled = false;
  let processGone = false;
  let resolveOutcome: (outcome: TurnOutcome) => void = () => undefined;
  const outcome = new Promise<TurnOutcome>((resolve) => (resolveOutcome = resolve));
  let resolveExited: () => void = () => undefined;
  const exited = new Promise<void>((resolve) => (resolveExited = resolve));
  const timers: NodeJS.Timeout[] = [];
  let idleTimer: NodeJS.Timeout | undefined;

  const clearTimers = (): void => {
    for (const timer of timers.splice(0)) clearTimeout(timer);
    if (idleTimer !== undefined) clearTimeout(idleTimer);
  };

  const settle = (status: TurnStatus, message: string, exitCode: number | null = null): void => {
    if (settled) return;
    settled = true;
    clearTimers();
    const result =
      view.final === undefined ? undefined : events.findLast((e) => e.kind === 'result');
    resolveOutcome({
      status,
      sessionId: view.sessionId,
      result: result?.kind === 'result' ? result : undefined,
      view,
      failure: status === 'failed' ? classifyFailure(events, limit) : undefined,
      limit,
      exitCode,
      stderrTail: stderr.slice(-STDERR_TAIL_BYTES),
      message,
      rawStream: RAW_STREAM_STATUSES.has(status) ? [...rawLines] : [],
    });
  };

  const kill = async (): Promise<void> => {
    if (processGone || pid === undefined) return;
    await killTree(pid);
  };

  const stop = async (reason: StopReason): Promise<void> => {
    settle(reason, STOP_MESSAGES[reason]);
    await kill();
  };

  const armIdle = (): void => {
    if (spec.idleTimeoutMs === undefined || settled) return;
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void stop('idle-timeout'), spec.idleTimeoutMs);
  };

  const handleEvent = (event: StreamEvent): void => {
    if (settled) return;
    events.push(event);
    view = reduceTurn(view, event, spec.reduce);
    limit = mergeLimitSignals(limit, limitSignalOf(event));
    if (event.kind === 'init' && event.apiKeySource !== 'none') {
      void stop('billing-guard');
      return;
    }
    spec.onEvent?.(event);
    if (event.kind === 'usage') {
      const failed = view.final?.isError === true;
      settle(failed ? 'failed' : 'completed', failed ? (view.final?.text ?? 'turn failed') : 'ok');
      const grace = setTimeout(() => void kill(), spec.exitGraceMs ?? DEFAULT_EXIT_GRACE_MS);
      void exited.then(() => {
        clearTimeout(grace);
      });
    }
  };

  const handleLines = (batch: readonly string[]): void => {
    for (const line of batch) {
      if (!settled && rawChars + line.length <= RAW_STREAM_MAX_CHARS) {
        rawLines.push(line);
        rawChars += line.length;
      }
      for (const event of parseStreamLine(line)) handleEvent(event);
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    armIdle();
    handleLines(lines.push(chunk));
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_TAIL_BYTES * 2);
  });
  // EPIPE when the child dies before reading stdin: the exit path reports the real cause.
  child.stdin.on('error', (error) => {
    stderr += `\n[bridge] stdin: ${error.message}`;
  });
  child.once('error', (error) => {
    processGone = true;
    settle('spawn-failed', `cannot start claude: ${error.message}`);
    resolveExited();
  });
  child.once('close', (code, signal) => {
    processGone = true;
    handleLines(lines.flush());
    const detail = signal === null ? `exit code ${String(code)}` : `signal ${signal}`;
    settle('crashed', `claude exited before finishing the turn (${detail})`, code);
    resolveExited();
  });

  if (spec.timeoutMs !== undefined)
    timers.push(setTimeout(() => void stop('timeout'), spec.timeoutMs));
  armIdle();
  child.stdin.end(spec.prompt, 'utf8');

  return { pid, outcome, exited, cancel: () => stop('cancelled') };
}
