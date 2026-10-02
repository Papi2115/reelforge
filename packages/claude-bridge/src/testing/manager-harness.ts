/** Test support for SessionManager tests: managers wired to fake-claude + cleanup. */
import type { StreamEvent } from '../events.js';
import { SessionManager } from '../session-manager.js';
import type { SessionManagerOptions, TurnHandle, TurnLifecycleEvent } from '../session-types.js';
import type { TurnOutcome } from '../turn.js';
import { TempDirs, fakeEnv, fakeLauncher } from './fake-claude.js';

export interface Drained {
  readonly events: StreamEvent[];
  readonly outcome: TurnOutcome;
}

export async function drain(handle: TurnHandle): Promise<Drained> {
  const events: StreamEvent[] = [];
  for await (const event of handle) events.push(event);
  return { events, outcome: await handle.outcome };
}

/** The `fake_probe` event (argv/stdin/env key names as seen by the child). */
export function probeOf(events: readonly StreamEvent[]): {
  argv: string[];
  stdin: string;
  cwd: string;
  claudeEnvKeys: string[];
} {
  const probe = events.find((event) => event.kind === 'unknown' && event.type === 'fake_probe');
  if (probe?.kind !== 'unknown') throw new Error('no fake_probe event (set FAKE_CLAUDE_PROBE=1)');
  const raw = probe.raw;
  return {
    argv: raw['argv'] as string[],
    stdin: raw['stdin'] as string,
    cwd: raw['cwd'] as string,
    claudeEnvKeys: raw['claudeEnvKeys'] as string[],
  };
}

export function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

/** Creates managers and temp project dirs; `dispose()` cancels, reaps processes, deletes dirs. */
export class Harness {
  readonly temps = new TempDirs();
  private readonly managers: SessionManager[] = [];

  manager(
    vars: Record<string, string> = {},
    options: Partial<SessionManagerOptions> = {},
  ): { manager: SessionManager; lifecycle: TurnLifecycleEvent[] } {
    const manager = new SessionManager({
      launcher: fakeLauncher,
      env: fakeEnv(vars),
      exitGraceMs: 3_000,
      ...options,
    });
    const lifecycle: TurnLifecycleEvent[] = [];
    manager.on('turn', (event) => lifecycle.push(event));
    this.managers.push(manager);
    return { manager, lifecycle };
  }

  project(): string {
    return this.temps.make('rf project ');
  }

  async dispose(): Promise<void> {
    for (const manager of this.managers.splice(0)) {
      await manager.cancelAll();
      await manager.whenIdle();
    }
    this.temps.cleanup();
  }
}
