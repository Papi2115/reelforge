/**
 * Test support: StageRunner Claude turns on tools/fake-claude (never the real CLI, never a model
 * call). Each harness writes its own sidecar script (`sequence` = one step per turn, in order).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LimitGuard,
  SessionManager,
  UsageLedger,
  type Clock,
  type TurnLifecycleEvent,
} from '@reelforge/claude-bridge';
import {
  fakeClaudeLauncher,
  type FakeClaudeScenario,
  type FakeClaudeScript,
  type FakeClaudeStep,
} from '@reelforge/fake-claude';
import { BridgeClaudeRunner, type ClaudeRunner, type ClaudeTurnSpec } from '../claude.js';

export type Step = FakeClaudeScenario | FakeClaudeStep;

/** A `tools-write` step writing project-relative files. */
export function writes(files: Readonly<Record<string, string>>, reply = 'Done.'): FakeClaudeStep {
  return {
    scenario: 'tools-write',
    reply,
    writes: Object.entries(files).map(([file, content]) => ({ path: file, content })),
  };
}

function isScript(value: readonly Step[] | FakeClaudeScript): value is FakeClaudeScript {
  return !Array.isArray(value);
}

function parentEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  return env;
}

export interface FakeClaudeHarnessOptions {
  readonly clock?: Clock;
  readonly guard?: LimitGuard;
  /** SessionManager concurrency and the guard's max concurrency (default 1). */
  readonly concurrency?: number;
}

export class FakeClaudeHarness {
  readonly manager: SessionManager;
  readonly runner: ClaudeRunner;
  readonly guard: LimitGuard;
  readonly usage = new UsageLedger();
  /** Every turn requested, in order. */
  readonly specs: ClaudeTurnSpec[] = [];
  readonly lifecycle: TurnLifecycleEvent[] = [];
  private readonly dir: string;
  private readonly sidecar: string;

  /** `steps`: one step per turn in order; a script: e.g. `rules` matched on the prompt. */
  constructor(steps: readonly Step[] | FakeClaudeScript, options: FakeClaudeHarnessOptions = {}) {
    this.dir = mkdtempSync(path.join(os.tmpdir(), 'rf stages fake '));
    this.sidecar = path.join(this.dir, 'script.json');
    this.setScript(isScript(steps) ? steps : { version: 1, sequence: steps });
    const concurrency = options.concurrency ?? 1;
    this.guard =
      options.guard ??
      new LimitGuard({
        maxConcurrency: concurrency,
        ...(options.clock === undefined ? {} : { clock: options.clock }),
      });
    this.manager = new SessionManager({
      launcher: fakeClaudeLauncher(),
      env: { ...parentEnv(), FAKE_CLAUDE_SCRIPT: this.sidecar },
      exitGraceMs: 3_000,
      debugDumps: false,
      guard: this.guard,
      usage: this.usage,
      concurrency,
    });
    this.manager.on('turn', (event) => {
      this.lifecycle.push(event);
    });
    const bridge = new BridgeClaudeRunner(this.manager);
    this.runner = {
      run: (spec, turnOptions) => {
        this.specs.push(spec);
        return bridge.run(spec, turnOptions);
      },
    };
  }

  /** Replaces the sidecar script (and restarts its `sequence` counter) for the next turns. */
  setScript(script: FakeClaudeScript): void {
    writeFileSync(this.sidecar, JSON.stringify(script));
    rmSync(`${this.sidecar}.state`, { force: true });
  }

  /** Model of every started turn, in order. */
  get models(): string[] {
    return this.lifecycle.flatMap((event) => (event.type === 'started' ? [event.model] : []));
  }

  async dispose(): Promise<void> {
    this.guard.dispose();
    await this.manager.cancelAll();
    await this.manager.whenIdle();
    rmSync(this.dir, { recursive: true, force: true });
  }
}
