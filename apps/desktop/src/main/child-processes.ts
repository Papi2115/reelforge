/**
 * Registry of child processes the main process started (claude, ffmpeg, whisper, ...). On quit
 * every still-running child is killed with its whole tree (`taskkill /T /F` on Windows), so no
 * orphan keeps burning the subscription or the CPU after the window is gone.
 */
import type { Result } from '@reelforge/claude-bridge';
import type { Logger } from './logger.js';

export interface TrackedProcess {
  readonly pid?: number | undefined;
  once(event: 'exit', listener: () => void): unknown;
}

export type KillTree = (pid: number) => Promise<Result<void, string>>;

export interface ChildProcessRegistry {
  track(child: TrackedProcess): void;
  readonly size: number;
  /** Kills every tracked tree; never rejects (failures are logged). */
  killAll(): Promise<void>;
}

export function createChildProcessRegistry(killTree: KillTree, log: Logger): ChildProcessRegistry {
  const running = new Set<number>();
  return {
    track(child) {
      const pid = child.pid;
      if (pid === undefined) return;
      running.add(pid);
      child.once('exit', () => {
        running.delete(pid);
      });
    },
    get size() {
      return running.size;
    },
    async killAll() {
      const pids = [...running];
      running.clear();
      const results = await Promise.all(pids.map((pid) => killTree(pid)));
      results.forEach((result, index) => {
        if (!result.ok)
          log.warn(`could not kill process tree ${String(pids[index])}: ${result.error}`);
      });
    },
  };
}
