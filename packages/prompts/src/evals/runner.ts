/**
 * Prompt eval runner (PLAN.md#5.8): for each case x stage, render the prompt, run it through the
 * claude-bridge SessionManager (stage permissions, sanitized env) in a temp copy of the case
 * project, then validate what the turn produced. CI uses fake-claude with canned outputs
 * (`mode: 'fake'`); the real CLI only runs from `evals.real.test.ts` behind REELFORGE_REAL_CLAUDE=1.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  SessionManager,
  type ClaudeLauncher,
  type ToolViolation,
  type TurnOutcome,
} from '@reelforge/claude-bridge';
import type { FakeClaudeFileWrite, FakeClaudeScript } from '@reelforge/fake-claude';
import {
  PROMPT_IDS,
  PROMPT_VERSIONS,
  renderPrompt,
  type PromptId,
  type PromptVersion,
} from '../catalog.js';
import { permissionStageFor } from '../stages.js';
import { formatValue } from '../template.js';
import type { CuesLike, CuesSchema } from '../validators/cues.js';
import { issue, type ValidationIssue } from '../validators/issues.js';
import { listEvalCases, loadEvalCase, type EvalCase } from './cases.js';
import { checkStageOutput } from './stage-checks.js';
import { stageFiles, stageVars } from './stage-vars.js';

export type EvalMode = 'fake' | 'real';

/** What fake-claude does for one stage turn. */
export interface CannedTurn {
  readonly reply: string;
  readonly writes: readonly FakeClaudeFileWrite[];
}

export interface EvalOptions<T extends CuesLike> {
  readonly mode: EvalMode;
  /** fake: `fakeClaudeLauncher()`; real: the resolved `claude` executable. */
  readonly launcher: ClaudeLauncher;
  /** Parent env of the child (the bridge sanitizes it). Fake mode adds FAKE_CLAUDE_SCRIPT. */
  readonly env: NodeJS.ProcessEnv;
  /** Temp folder for project copies and sidecars (removed afterwards unless `keepWorkDir`). */
  readonly workDir: string;
  readonly cuesSchema: CuesSchema<T>;
  readonly cases?: readonly string[];
  readonly stages?: readonly PromptId[];
  /** Hard cap on stage turns in this run; the rest are reported as `skipped`. */
  readonly maxTurns: number;
  readonly turnTimeoutMs?: number;
  /** Node-compatible runtime for the bridge's bash guard hook (real runs). */
  readonly hookRuntime?: string;
  /** Fake mode: replace the canned output of a case/stage (negative tests). */
  readonly canned?: (caseId: string, stage: PromptId, golden: CannedTurn) => CannedTurn;
  readonly keepWorkDir?: boolean;
  readonly casesDir?: string;
}

export type StageStatus = 'pass' | 'fail' | 'skipped';

export interface StageResult {
  readonly caseId: string;
  readonly stage: PromptId;
  readonly status: StageStatus;
  readonly turnStatus: TurnOutcome['status'] | undefined;
  readonly costUsd: number;
  readonly issues: readonly ValidationIssue[];
}

export interface EvalReport {
  readonly version: 1;
  readonly mode: EvalMode;
  readonly promptVersions: Readonly<Record<PromptId, PromptVersion>>;
  readonly results: readonly StageResult[];
  readonly summary: {
    readonly pass: number;
    readonly fail: number;
    readonly skipped: number;
    readonly costUsd: number;
  };
}

function goldenTurn(evalCase: EvalCase, stage: PromptId, files: readonly string[]): CannedTurn {
  const reply = evalCase.file.replies[stage];
  return {
    reply: formatValue(reply),
    writes: files.map((file) => ({
      path: file,
      content: readFileSync(path.join(evalCase.projectDir, file), 'utf8'),
    })),
  };
}

function cleanParentEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) clean[key] = value;
  }
  return clean;
}

interface TurnRun {
  readonly outcome: TurnOutcome;
  readonly violations: readonly ToolViolation[];
}

async function runTurn<T extends CuesLike>(
  options: EvalOptions<T>,
  stage: PromptId,
  projectDir: string,
  prompt: string,
  sidecar: string | undefined,
): Promise<TurnRun> {
  const env = cleanParentEnv(options.env);
  const manager = new SessionManager({
    launcher: options.launcher,
    env: sidecar === undefined ? env : { ...env, FAKE_CLAUDE_SCRIPT: sidecar },
    debugDumps: false,
    permissions: { hookRuntime: options.hookRuntime },
    ...(options.turnTimeoutMs === undefined ? {} : { turnTimeoutMs: options.turnTimeoutMs }),
  });
  const violations: ToolViolation[] = [];
  manager.on('turn', (event) => {
    if (event.type === 'policy-violation') violations.push(...event.violations);
  });
  const handle = manager.enqueue({
    projectDir,
    stage: permissionStageFor(stage),
    prompt,
    newSession: true,
  });
  const outcome = await handle.outcome;
  await manager.whenIdle();
  return { outcome, violations };
}

function failed(caseId: string, stage: PromptId, message: string): StageResult {
  return {
    caseId,
    stage,
    status: 'fail',
    turnStatus: undefined,
    costUsd: 0,
    issues: [issue('error', 'setup', message)],
  };
}

async function runStage<T extends CuesLike>(
  options: EvalOptions<T>,
  evalCase: EvalCase,
  stage: PromptId,
): Promise<StageResult> {
  const caseId = evalCase.file.id;
  const vars = stageVars(stage, evalCase);
  if (!vars.ok) return failed(caseId, stage, vars.error);
  const prompt = renderPrompt(stage, vars.value);
  if (!prompt.ok) return failed(caseId, stage, `prompt: ${JSON.stringify(prompt.error)}`);
  const files = stageFiles(stage, evalCase, vars.value);
  if (!files.ok) return failed(caseId, stage, files.error);
  const projectDir = mkdtempSync(path.join(options.workDir, `${caseId} ${stage} `));
  cpSync(evalCase.projectDir, projectDir, { recursive: true });
  if (files.value.removeBeforeTurn) {
    for (const file of files.value.paths) rmSync(path.join(projectDir, file), { force: true });
  }
  let sidecar: string | undefined;
  if (options.mode === 'fake') {
    const golden = goldenTurn(evalCase, stage, files.value.paths);
    const turn = options.canned?.(caseId, stage, golden) ?? golden;
    const script: FakeClaudeScript = {
      version: 1,
      default: { scenario: 'tools-write', reply: turn.reply, writes: turn.writes },
    };
    sidecar = path.join(options.workDir, `${caseId}.${stage}.fake-claude.json`);
    writeFileSync(sidecar, JSON.stringify(script), 'utf8');
  }
  const { outcome, violations } = await runTurn(options, stage, projectDir, prompt.value, sidecar);
  const issues: ValidationIssue[] = [];
  if (outcome.status !== 'completed') {
    issues.push(issue('error', 'turn', `turn ${outcome.status}: ${outcome.message}`));
  }
  for (const violation of violations) {
    issues.push(issue('error', 'policy-violation', `${violation.name}: ${violation.reason}`));
  }
  issues.push(
    ...checkStageOutput({
      stage,
      evalCase,
      projectDir,
      files: files.value.paths,
      reply: outcome.result?.text ?? '',
      cuesSchema: options.cuesSchema,
      strictReplies: options.mode === 'fake',
    }),
  );
  return {
    caseId,
    stage,
    status: issues.some((entry) => entry.severity === 'error') ? 'fail' : 'pass',
    turnStatus: outcome.status,
    costUsd: outcome.result?.costUsd ?? 0,
    issues,
  };
}

export async function runEvals<T extends CuesLike>(options: EvalOptions<T>): Promise<EvalReport> {
  mkdirSync(options.workDir, { recursive: true });
  const caseIds = options.cases ?? listEvalCases(options.casesDir);
  const stages = options.stages ?? PROMPT_IDS;
  const results: StageResult[] = [];
  let turns = 0;
  try {
    for (const caseId of caseIds) {
      const evalCase = loadEvalCase(caseId, options.casesDir);
      for (const stage of stages) {
        if (turns >= options.maxTurns) {
          results.push({
            caseId,
            stage,
            status: 'skipped',
            turnStatus: undefined,
            costUsd: 0,
            issues: [issue('warning', 'turn-cap', `turn cap ${String(options.maxTurns)} reached`)],
          });
          continue;
        }
        turns += 1;
        results.push(await runStage(options, evalCase, stage));
      }
    }
  } finally {
    if (options.keepWorkDir !== true) rmSync(options.workDir, { recursive: true, force: true });
  }
  const count = (status: StageStatus): number =>
    results.filter((result) => result.status === status).length;
  return {
    version: 1,
    mode: options.mode,
    promptVersions: PROMPT_VERSIONS,
    results,
    summary: {
      pass: count('pass'),
      fail: count('fail'),
      skipped: count('skipped'),
      costUsd: results.reduce((sum, result) => sum + result.costUsd, 0),
    },
  };
}

export function writeEvalReport(file: string, report: EvalReport): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
