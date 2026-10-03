/**
 * Missing props → project props (PLAN.md#7.4, D9, ADR-007): when the kit lacks a prop a shot
 * needs, a prop-build turn (Opus) writes `kit-ext/props/<name>.js`, QA by code checks it (lint,
 * turntable render, size, floating parts, determinism, Haiku critic) with one fix turn, and a
 * passing prop is committed ("Prop <name> built ✓") and reused by every shot. A prop that still
 * fails is moved to `.reelforge/props-failed/` (it must not break the other shots); its shots keep
 * a fallback (⚠). One build per name per run (concurrent shots share it), at most
 * `maxNewProps` new props per film.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  KIT_EXT_PROPS_DIR,
  normalizePropName,
  PROP_NAME_PATTERN,
  propExtensionFile,
  type PropBuildRecord,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { FILES, inProject } from '../paths.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';
import { propQaRound, type PropJobContext } from './qa.js';
import { readPropsReport, savePropRecord } from './report.js';

/** prop-build turns per prop: the build and one fix with the QA findings. */
export const PROP_BUILD_ATTEMPTS = 2;

/** Turn failures that fail the prop (not the stage). */
const PROP_LEVEL_FAILURES = new Set<StageError['kind']>(['claude', 'validation', 'invalid-input']);

export interface PropRequest {
  /** camelCase kit name (`normalizePropName`). */
  readonly name: string;
  /** What it must look like (storyboard entry, or the shot that asked for it). */
  readonly description: string;
  /** Shots that need it (for the prompt and the report). */
  readonly shots: readonly StoryboardShot[];
}

export interface PropOutcome {
  readonly name: string;
  readonly status: 'built' | 'failed';
  /** Why it failed (budget, QA findings, turn failure). */
  readonly reason: string | undefined;
}

/** Names of the project's prop modules (`kit-ext/props/*.js`) right now. */
export async function projectPropNames(projectDir: string): Promise<Set<string>> {
  const directory = inProject(projectDir, KIT_EXT_PROPS_DIR);
  if (!existsSync(directory)) return new Set();
  const names = (await readdir(directory))
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.slice(0, -'.js'.length))
    .filter((name) => PROP_NAME_PATTERN.test(name));
  return new Set(names);
}

/** `z80Chip (voxel IC package …)` → name + description; undefined when no name is usable. */
export function parsePropEntry(entry: string): { name: string; description: string } | undefined {
  const head = entry.split(/[(:—–]/)[0] ?? entry;
  const name = normalizePropName(head);
  if (name === undefined) return undefined;
  const detail = /\(([^)]*)\)/.exec(entry)?.[1]?.trim();
  return {
    name,
    description: detail === undefined || detail === '' ? head.trim() : `${head.trim()}: ${detail}`,
  };
}

function shotsText(shots: readonly StoryboardShot[]): string {
  return shots.length === 0
    ? 'several shots (see storyboard.json)'
    : shots.map((shot) => `${shot.id}: ${shot.intent}`).join('; ');
}

export class PropBuilder {
  private readonly runs = new Map<string, Promise<Result<PropOutcome, StageError>>>();
  private budgetUsed: Promise<Result<number, StageError>> | undefined;
  private started = 0;

  constructor(
    private readonly job: PropJobContext,
    /** Kit prop names (never rebuilt as project props). */
    private readonly builtIn: ReadonlySet<string>,
  ) {}

  /** Builds (or reuses) one prop; concurrent requests for a name share one build. */
  ensure(request: PropRequest): Promise<Result<PropOutcome, StageError>> {
    const running = this.runs.get(request.name);
    if (running !== undefined) return running;
    const run = this.provide(request);
    this.runs.set(request.name, run);
    return run;
  }

  /** The MISSING names of a shot: built ones (kit names) and failed ones (as given). */
  async ensureNames(
    names: readonly string[],
    shot: StoryboardShot,
  ): Promise<Result<{ built: string[]; failed: string[] }, StageError>> {
    const built: string[] = [];
    const failed: string[] = [];
    for (const raw of names) {
      const parsed = parsePropEntry(raw);
      if (parsed === undefined) {
        failed.push(raw);
        continue;
      }
      const outcome = await this.ensure({
        name: parsed.name,
        description: `${parsed.description} (needed in shot ${shot.id}: ${shot.intent})`,
        shots: [shot],
      });
      if (!outcome.ok) return outcome;
      if (outcome.value.status === 'built') built.push(parsed.name);
      else failed.push(raw);
    }
    return ok({ built, failed });
  }

  private async provide(request: PropRequest): Promise<Result<PropOutcome, StageError>> {
    const { name } = request;
    if (this.builtIn.has(name)) return ok({ name, status: 'built', reason: undefined });
    const report = await readPropsReport(this.job.ctx.projectDir);
    if (!report.ok) return report;
    const previous = report.value.props.find((entry) => entry.name === name);
    const source = await readProjectText(this.job.ctx.projectDir, propExtensionFile(name));
    if (!source.ok) return source;
    if (source.value !== undefined && previous?.status === 'built') {
      return ok({ name, status: 'built', reason: undefined });
    }
    if (source.value !== undefined) {
      // Written earlier (by hand, or an interrupted run): check it before building anything.
      const qa = await propQaRound(this.job, name, request.description, 'existing');
      if (!qa.ok) return qa;
      if (qa.value.findings.length === 0) {
        return this.finish(request, previous, 0, { ...qa.value, findings: [] });
      }
    }
    const budget = await this.takeBudget();
    if (!budget.ok) return budget;
    if (!budget.value) {
      const reason = `the limit of ${String(this.job.settings.maxNewProps)} new props per film is reached`;
      return this.fail(request, previous, 0, [reason], [], undefined);
    }
    return this.build(request, previous);
  }

  /** True when one more new prop fits the film's budget (and counts it). */
  private async takeBudget(): Promise<Result<boolean, StageError>> {
    this.budgetUsed ??= readPropsReport(this.job.ctx.projectDir).then((report) =>
      report.ok ? ok(report.value.props.filter((entry) => entry.attempts > 0).length) : report,
    );
    const used = await this.budgetUsed;
    if (!used.ok) return used;
    if (used.value + this.started >= this.job.settings.maxNewProps) return ok(false);
    this.started += 1;
    return ok(true);
  }

  private async build(
    request: PropRequest,
    previous: PropBuildRecord | undefined,
  ): Promise<Result<PropOutcome, StageError>> {
    const { ctx } = this.job;
    const notes: string[] = [];
    let findings: readonly string[] = [];
    let sheet: string | undefined;
    for (let attempt = 1; attempt <= PROP_BUILD_ATTEMPTS; attempt += 1) {
      ctx.step(
        `prop ${request.name}: ${attempt === 1 ? 'building' : `fix ${String(attempt - 1)}`}`,
      );
      const turn = await this.turn(request, attempt, findings);
      if (!turn.ok) return turn;
      if (turn.value !== undefined) {
        notes.push(`prop-build turn ${String(attempt)} failed: ${turn.value}`);
        findings = [turn.value];
        continue;
      }
      ctx.step(`prop ${request.name}: QA ${String(attempt)}`);
      const qa = await propQaRound(this.job, request.name, request.description, String(attempt));
      if (!qa.ok) return qa;
      notes.push(...qa.value.notes);
      sheet = qa.value.sheet ?? sheet;
      findings = qa.value.findings;
      if (findings.length === 0) {
        return this.finish(request, previous, attempt, { findings: [], sheet, notes });
      }
    }
    return this.fail(request, previous, PROP_BUILD_ATTEMPTS, findings, notes, sheet);
  }

  /** undefined = the turn ran; a string = it failed for this prop only. */
  private async turn(
    request: PropRequest,
    attempt: number,
    findings: readonly string[],
  ): Promise<Result<string | undefined, StageError>> {
    const prompt = render('prop-build', {
      propName: request.name,
      description: request.description,
      shots: shotsText(request.shots),
      styleId: this.job.styleId,
      ...(findings.length === 0
        ? {}
        : { findings: findings.map((line) => `- ${line}`).join('\n'), attempt }),
    });
    if (!prompt.ok) return prompt;
    const turn = await this.job.ctx.claude({
      prompt: 'prop-build',
      text: prompt.value,
      purpose: 'main',
      newSession: true,
      label: `prop-build ${request.name}`,
      commit: false,
      detached: true,
    });
    if (turn.ok) return ok(undefined);
    return PROP_LEVEL_FAILURES.has(turn.error.kind) ? ok(turn.error.message) : turn;
  }

  private record(
    request: PropRequest,
    previous: PropBuildRecord | undefined,
    status: PropBuildRecord['status'],
    attempts: number,
    details: { findings: readonly string[]; sheet: string | undefined; notes: readonly string[] },
  ): PropBuildRecord {
    const shots = [...(previous?.shots ?? []), ...request.shots.map((shot) => shot.id)];
    return {
      name: request.name,
      status,
      file: propExtensionFile(request.name),
      description: request.description,
      shots: [...new Set(shots)].sort(),
      attempts: (previous?.attempts ?? 0) + attempts,
      ...(details.sheet === undefined ? {} : { sheet: details.sheet }),
      findings: [...details.findings],
      notes: [...details.notes],
      updatedAt: this.job.ctx.now().toISOString(),
    };
  }

  private async finish(
    request: PropRequest,
    previous: PropBuildRecord | undefined,
    attempts: number,
    details: { findings: readonly string[]; sheet: string | undefined; notes: readonly string[] },
  ): Promise<Result<PropOutcome, StageError>> {
    const saved = await savePropRecord(
      this.job.ctx.projectDir,
      this.record(request, previous, 'built', attempts, details),
    );
    if (!saved.ok) return saved;
    await this.job.ctx.commit(`Prop ${request.name} built ✓`);
    return ok({ name: request.name, status: 'built', reason: undefined });
  }

  private async fail(
    request: PropRequest,
    previous: PropBuildRecord | undefined,
    attempts: number,
    findings: readonly string[],
    notes: readonly string[],
    sheet: string | undefined,
  ): Promise<Result<PropOutcome, StageError>> {
    const moved = await this.moveAside(request.name);
    if (!moved.ok) return moved;
    const saved = await savePropRecord(
      this.job.ctx.projectDir,
      this.record(request, previous, 'failed', attempts, { findings, sheet, notes }),
    );
    if (!saved.ok) return saved;
    this.job.ctx.warn(`prop ${request.name} could not be built: ${findings.join(' | ')}`);
    return ok({ name: request.name, status: 'failed', reason: findings.join(' | ') });
  }

  /** A failed module must not break the other shots: it moves to `.reelforge/props-failed/`. */
  private async moveAside(name: string): Promise<Result<void, StageError>> {
    const { projectDir } = this.job.ctx;
    const from = inProject(projectDir, propExtensionFile(name));
    if (!existsSync(from)) return ok(undefined);
    const to = inProject(projectDir, `${FILES.propsFailedDir}/${name}.js`);
    try {
      await mkdir(path.dirname(to), { recursive: true });
      await rename(from, to);
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(stageError('io', `cannot move ${propExtensionFile(name)} aside: ${message}`));
    }
  }
}
