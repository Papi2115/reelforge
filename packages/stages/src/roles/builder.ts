/**
 * Project roles (PLAN.md#12.20, ADR-026): when the story needs a person the character pack lacks
 * (the storyboard's `newRoles`, or a scene calling `kit.cast.person('<id>')` for an unknown id), a
 * roles turn (Sonnet: a role spec is data) writes `characters/roles/<id>.json` in the pack's
 * style, QA by code + the Haiku critic checks it with one fix turn, and the role is committed
 * ("Role <id> built ✓", or ⚠ when findings are left: it stays usable). A role file that still does
 * not parse is moved to `.reelforge/roles-failed/`; its shots fall back to a cast member. One
 * build per id per run (builds run one at a time), at most MAX_NEW_ROLES new roles per film.
 */
import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { PACK_IDS } from '@reelforge/kit';
import {
  castRoleFile,
  castRoleId,
  type RoleBuildRecord,
  type RoleBuildStatus,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { FILES, inProject } from '../paths.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';
import { roleQaRound, type RoleJobContext, type RoleQaResult } from './qa.js';
import { readRolesReport, saveRoleRecord } from './report.js';

/** Roles turns per role: the build and one fix with the QA findings. */
export const ROLE_BUILD_ATTEMPTS = 2;
/** New roles per film (each costs a Sonnet turn, a render and a Haiku turn). */
export const MAX_NEW_ROLES = 8;

/** Turn failures that fail the role (not the stage). */
const ROLE_LEVEL_FAILURES = new Set<StageError['kind']>(['claude', 'validation', 'invalid-input']);

export interface RoleRequest {
  /** camelCase role id (`castRoleId`). */
  readonly id: string;
  /** What they wear and hold (storyboard `newRoles`, or the shot that asked for it). */
  readonly description: string;
  readonly shots: readonly StoryboardShot[];
}

export interface RoleOutcome {
  readonly id: string;
  readonly status: RoleBuildStatus;
  /** Why it failed or what is left (⚠). */
  readonly reason: string | undefined;
}

interface Details {
  readonly findings: readonly string[];
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
  readonly accessories: readonly string[];
}

/** `policeOfficer` -> `Police officer`. */
export function roleLabel(id: string): string {
  const words = id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shotsText(shots: readonly StoryboardShot[]): string {
  return shots.length === 0
    ? 'several shots (see storyboard.json)'
    : shots.map((shot) => `${shot.id}: ${shot.intent}`).join('; ');
}

export class RoleBuilder {
  private readonly runs = new Map<string, Promise<Result<RoleOutcome, StageError>>>();
  /** Builds run one at a time: a half-written role must not meet another role's QA render. */
  private chain: Promise<unknown> = Promise.resolve();
  private started = 0;

  constructor(private readonly job: RoleJobContext) {}

  /** Builds (or reuses) one role; concurrent requests for an id share one build. */
  ensure(request: RoleRequest): Promise<Result<RoleOutcome, StageError>> {
    const running = this.runs.get(request.id);
    if (running !== undefined) return running;
    // provide() resolves with a Result; the catch only keeps the chain alive after a bug.
    const run = this.chain.catch(() => undefined).then(() => this.provide(request));
    this.chain = run;
    this.runs.set(request.id, run);
    return run;
  }

  /** Roles a shot calls by id: the built ones (usable) and the failed ones. */
  async ensureIds(
    ids: readonly string[],
    shot: StoryboardShot,
  ): Promise<Result<{ built: string[]; failed: string[] }, StageError>> {
    const built: string[] = [];
    const failed: string[] = [];
    for (const raw of ids) {
      const id = castRoleId(raw);
      if (id === undefined) {
        failed.push(raw);
        continue;
      }
      const outcome = await this.ensure({
        id,
        description: `${roleLabel(id)} (needed in shot ${shot.id}: ${shot.intent})`,
        shots: [shot],
      });
      if (!outcome.ok) return outcome;
      (outcome.value.status === 'failed' ? failed : built).push(id);
    }
    return ok({ built, failed });
  }

  private async provide(request: RoleRequest): Promise<Result<RoleOutcome, StageError>> {
    const { id } = request;
    if (PACK_IDS.includes(id)) return ok({ id, status: 'built', reason: undefined });
    const report = await readRolesReport(this.job.ctx.projectDir);
    if (!report.ok) return report;
    const previous = report.value.roles.find((entry) => entry.id === id);
    const source = await readProjectText(this.job.ctx.projectDir, castRoleFile(id));
    if (!source.ok) return source;
    if (source.value !== undefined && previous !== undefined && previous.status !== 'failed') {
      return ok({ id, status: previous.status, reason: undefined });
    }
    if (source.value !== undefined) {
      // Written earlier (by hand, or an interrupted run): check it before building anything.
      const qa = await roleQaRound(this.job, id, request.description, 'existing');
      if (!qa.ok) return qa;
      if (qa.value.usable && qa.value.findings.length === 0) {
        return this.finish(request, previous, 0, 'built', qa.value);
      }
    }
    const used = report.value.roles.filter((entry) => entry.attempts > 0).length;
    if (used + this.started >= MAX_NEW_ROLES) {
      const reason = `the limit of ${String(MAX_NEW_ROLES)} new roles per film is reached`;
      return this.fail(request, previous, 0, {
        findings: [reason],
        sheet: undefined,
        notes: [],
        accessories: [],
      });
    }
    this.started += 1;
    return this.build(request, previous);
  }

  private async build(
    request: RoleRequest,
    previous: RoleBuildRecord | undefined,
  ): Promise<Result<RoleOutcome, StageError>> {
    const { ctx } = this.job;
    const notes: string[] = [];
    let findings: readonly string[] = [];
    let last: RoleQaResult | undefined;
    for (let attempt = 1; attempt <= ROLE_BUILD_ATTEMPTS; attempt += 1) {
      ctx.step(`role ${request.id}: ${attempt === 1 ? 'building' : `fix ${String(attempt - 1)}`}`);
      const turn = await this.turn(request, attempt, findings);
      if (!turn.ok) return turn;
      if (turn.value !== undefined) {
        notes.push(`roles turn ${String(attempt)} failed: ${turn.value}`);
        findings = [turn.value];
        continue;
      }
      ctx.step(`role ${request.id}: QA ${String(attempt)}`);
      const qa = await roleQaRound(this.job, request.id, request.description, String(attempt));
      if (!qa.ok) return qa;
      notes.push(...qa.value.notes);
      last = qa.value;
      findings = qa.value.findings;
      if (qa.value.usable && findings.length === 0) {
        return this.finish(request, previous, attempt, 'built', { ...qa.value, notes });
      }
    }
    const details = {
      findings,
      sheet: last?.sheet,
      notes,
      accessories: last?.accessories ?? [],
    };
    // QA findings left on a valid role: usable with ⚠ (the scenes still get the profession).
    if (last?.usable === true) {
      return this.finish(request, previous, ROLE_BUILD_ATTEMPTS, 'warning', details);
    }
    return this.fail(request, previous, ROLE_BUILD_ATTEMPTS, details);
  }

  /** undefined = the turn ran; a string = it failed for this role only. */
  private async turn(
    request: RoleRequest,
    attempt: number,
    findings: readonly string[],
  ): Promise<Result<string | undefined, StageError>> {
    const prompt = render('roles', {
      roleId: request.id,
      label: roleLabel(request.id),
      description: request.description,
      shots: shotsText(request.shots),
      styleId: this.job.styleId,
      ...(findings.length === 0
        ? {}
        : { findings: findings.map((line) => `- ${line}`).join('\n'), attempt }),
    });
    if (!prompt.ok) return prompt;
    const turn = await this.job.ctx.claude({
      prompt: 'roles',
      text: prompt.value,
      purpose: 'main',
      newSession: true,
      label: `roles ${request.id}`,
      commit: false,
      detached: true,
    });
    if (turn.ok) return ok(undefined);
    return ROLE_LEVEL_FAILURES.has(turn.error.kind) ? ok(turn.error.message) : turn;
  }

  private record(
    request: RoleRequest,
    previous: RoleBuildRecord | undefined,
    status: RoleBuildStatus,
    attempts: number,
    details: Details,
  ): RoleBuildRecord {
    const shots = [...(previous?.shots ?? []), ...request.shots.map((shot) => shot.id)];
    return {
      id: request.id,
      status,
      file: castRoleFile(request.id),
      description: request.description,
      shots: [...new Set(shots)].sort(),
      attempts: (previous?.attempts ?? 0) + attempts,
      accessories: [...details.accessories],
      ...(details.sheet === undefined ? {} : { sheet: details.sheet }),
      findings: [...details.findings],
      notes: [...details.notes],
      updatedAt: this.job.ctx.now().toISOString(),
    };
  }

  private async finish(
    request: RoleRequest,
    previous: RoleBuildRecord | undefined,
    attempts: number,
    status: 'built' | 'warning',
    details: Details,
  ): Promise<Result<RoleOutcome, StageError>> {
    const saved = await saveRoleRecord(
      this.job.ctx.projectDir,
      this.record(request, previous, status, attempts, details),
    );
    if (!saved.ok) return saved;
    await this.job.ctx.commit(`Role ${request.id} built ${status === 'built' ? '✓' : '⚠'}`);
    if (status === 'warning') {
      this.job.ctx.warn(`role ${request.id} ⚠: ${details.findings.join(' | ')}`);
    }
    const reason = status === 'built' ? undefined : details.findings.join(' | ');
    return ok({ id: request.id, status, reason });
  }

  private async fail(
    request: RoleRequest,
    previous: RoleBuildRecord | undefined,
    attempts: number,
    details: Details,
  ): Promise<Result<RoleOutcome, StageError>> {
    const moved = await this.moveAside(request.id);
    if (!moved.ok) return moved;
    const saved = await saveRoleRecord(
      this.job.ctx.projectDir,
      this.record(request, previous, 'failed', attempts, details),
    );
    if (!saved.ok) return saved;
    const reason = details.findings.join(' | ');
    this.job.ctx.warn(`role ${request.id} could not be built: ${reason}`);
    return ok({ id: request.id, status: 'failed', reason });
  }

  /** An invalid role file leaves `characters/roles/` (`.reelforge/roles-failed/`). */
  private async moveAside(id: string): Promise<Result<void, StageError>> {
    const { projectDir } = this.job.ctx;
    const from = inProject(projectDir, castRoleFile(id));
    if (!existsSync(from)) return ok(undefined);
    const to = inProject(projectDir, `${FILES.rolesFailedDir}/${id}.json`);
    try {
      await mkdir(path.dirname(to), { recursive: true });
      await rename(from, to);
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(stageError('io', `cannot move ${castRoleFile(id)} aside: ${message}`));
    }
  }
}
