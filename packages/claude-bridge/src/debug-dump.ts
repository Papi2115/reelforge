/**
 * Raw streams of failed turns -> `<project>/.reelforge/debug/` (PLAN.md#5.4, ADR-001): the real
 * usage-limit stream has never been observed, so the first one must be captured as a fixture.
 * The folder carries its own `.gitignore` (`*`): project repos never commit these dumps.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeAtomic, type JsonFileError } from './json-file.js';
import { err, ok, type Result } from './result.js';
import type { TurnOutcome } from './turn.js';

export const DEBUG_DIR = path.join('.reelforge', 'debug');

export interface FailedTurnInfo {
  readonly turnId: string;
  readonly stage: string;
  readonly model: string;
  readonly outcome: TurnOutcome;
}

export interface DumpPaths {
  readonly stream: string;
  readonly meta: string;
}

/** Writes `<stamp>-<turnId>.jsonl` (raw stdout lines) + `.meta.json`; returns both paths. */
export async function dumpFailedTurn(
  projectDir: string,
  info: FailedTurnInfo,
  now: Date,
): Promise<Result<DumpPaths, JsonFileError>> {
  const dir = path.join(projectDir, DEBUG_DIR);
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const base = path.join(dir, `${stamp}-${info.turnId}`);
  const paths: DumpPaths = { stream: `${base}.jsonl`, meta: `${base}.meta.json` };
  const { outcome } = info;
  // Write-only diagnostics (never read back by the app), hence no zod schema; versioned anyway.
  const meta = {
    version: 1,
    turnId: info.turnId,
    stage: info.stage,
    model: info.model,
    at: now.toISOString(),
    status: outcome.status,
    failure: outcome.failure,
    limit: outcome.limit,
    exitCode: outcome.exitCode,
    message: outcome.message,
    stderrTail: outcome.stderrTail,
  };
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, '.gitignore'), '*\n', 'utf8');
    await writeAtomic(paths.stream, outcome.rawStream.map((line) => `${line}\n`).join(''));
    await writeAtomic(paths.meta, `${JSON.stringify(meta, null, 2)}\n`);
  } catch (error) {
    return err({ kind: 'io', path: base, message: String(error) });
  }
  return ok(paths);
}
