/**
 * Prompt evals on the REAL Claude Code CLI. COSTS SUBSCRIPTION USAGE: every stage turn is a full
 * agentic model turn counted against the 5-hour limit (Sonnet for research/script/storyboard/
 * sound-cues, Opus for scene-build/scene-fix, Haiku for critic). The default selection is 3 Sonnet
 * turns; the report's `summary.costUsd` shows the CLI's list-price estimate afterwards.
 * Never runs in CI or `pnpm test`; manual only:
 *   REELFORGE_REAL_CLAUDE=1 pnpm --filter @reelforge/prompts eval:real
 * Knobs: REELFORGE_EVAL_CASES (default en-short-prism), REELFORGE_EVAL_STAGES (default
 * script,storyboard,sound-cues), REELFORGE_EVAL_MAX_TURNS (hard cap, default 3).
 * Report: packages/prompts/out/evals/report.real.json.
 */
import os from 'node:os';
import path from 'node:path';
import { resolveClaudeExecutable } from '@reelforge/claude-bridge';
import { CuesFileSchema } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import { isPromptId, type PromptId } from '../catalog.js';
import { runEvals, writeEvalReport } from './runner.js';

const REAL = process.env['REELFORGE_REAL_CLAUDE'] === '1';
const REPORT_FILE = path.join(import.meta.dirname, '..', '..', 'out', 'evals', 'report.real.json');
const TURN_TIMEOUT_MS = 10 * 60_000;

function listEnv(name: string, fallback: readonly string[]): string[] {
  const value = process.env[name];
  return value === undefined || value.trim() === ''
    ? [...fallback]
    : value.split(',').map((item) => item.trim());
}

function stagesFromEnv(): PromptId[] {
  return listEnv('REELFORGE_EVAL_STAGES', ['script', 'storyboard', 'sound-cues']).map((stage) => {
    if (!isPromptId(stage)) throw new Error(`REELFORGE_EVAL_STAGES: unknown stage ${stage}`);
    return stage;
  });
}

const maxTurns = Number(process.env['REELFORGE_EVAL_MAX_TURNS'] ?? '3');

describe.skipIf(!REAL)('prompt evals (REAL claude CLI, spends subscription usage)', () => {
  it(
    'stage outputs pass the validators',
    { timeout: (maxTurns + 1) * TURN_TIMEOUT_MS },
    async () => {
      const executable = resolveClaudeExecutable().executable;
      if (executable === undefined) throw new Error('claude executable not found on PATH');
      if (!Number.isInteger(maxTurns) || maxTurns < 1) {
        throw new Error('REELFORGE_EVAL_MAX_TURNS must be a positive integer');
      }
      const report = await runEvals({
        mode: 'real',
        launcher: { command: executable, args: [] },
        env: process.env,
        workDir: path.join(os.tmpdir(), `rf prompt evals real ${String(process.pid)}`),
        cuesSchema: CuesFileSchema,
        cases: listEnv('REELFORGE_EVAL_CASES', ['en-short-prism']),
        stages: stagesFromEnv(),
        maxTurns,
        turnTimeoutMs: TURN_TIMEOUT_MS,
        hookRuntime: process.execPath,
      });
      writeEvalReport(REPORT_FILE, report);
      expect(report.results.filter((result) => result.status === 'fail')).toEqual([]);
    },
  );
});
