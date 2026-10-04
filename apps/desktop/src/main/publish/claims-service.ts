/**
 * Sources panel of the open project (PLAN.md#12.18, ADR-016): `claims.json` with the state the
 * panel needs (script present / changed since the check), "Check sources" (one Sonnet turn through
 * the stages' `checkSources`: read-only tools, no web; one at a time) and the user's edits
 * (attach a URL/document/note, detach, change a status). Every change is written atomically and
 * committed. Electron-free.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promptModel } from '@reelforge/prompts';
import {
  applyClaimEdit,
  claimsFileSchema,
  CLAIMS_FILE,
  formatClaimsReport,
  textFingerprint,
  type AppSettings,
} from '@reelforge/shared';
import { checkSources, FILES, writeClaimsFile, type ClaudeRunner } from '@reelforge/stages';
import type {
  ClaimEditRequest,
  ClaimEditResult,
  ClaimsCheckResult,
  ClaimsState,
} from '../../shared/publish-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson } from '../project-files.js';

export interface ClaimsServiceOptions {
  readonly currentProject: () => string | undefined;
  readonly claude: ClaudeRunner;
  readonly settings: () => AppSettings;
  readonly now: () => Date;
  /** Commits claims.json (project autocommit, step `sources`); false when it failed. */
  readonly commit: (dir: string, message: string) => Promise<boolean>;
  readonly log: Logger;
}

async function readScript(dir: string): Promise<string | null> {
  try {
    return await readFile(path.join(dir, FILES.script), 'utf8');
  } catch {
    return null; // no script yet
  }
}

export class ClaimsService {
  private checking: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: ClaimsServiceOptions) {}

  async state(): Promise<ClaimsState> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    return this.stateOf(dir);
  }

  /** One Check sources turn at a time per app. */
  async check(): Promise<ClaimsCheckResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    if (this.checking !== null) return { status: 'error', message: 'Already checking sources.' };
    this.checking = dir;
    try {
      const settings = this.options.settings();
      const checked = await checkSources({
        projectDir: dir,
        claude: this.options.claude,
        model: promptModel('claims', { economy: settings.economy }),
        now: this.options.now,
      });
      if (!checked.ok) return { status: 'error', message: checked.error };
      this.options.log.info(
        `check sources: ${formatClaimsReport(checked.value.file).split('\n')[0] ?? ''}`,
      );
      await this.options.commit(dir, 'Check sources');
      this.checking = null;
      return {
        status: 'ok',
        state: await this.stateOf(dir),
        warnings: [...checked.value.warnings],
      };
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    } finally {
      this.checking = null;
    }
  }

  /** Edits are applied one after another (each reads the file the previous one wrote). */
  edit(request: ClaimEditRequest): Promise<ClaimEditResult> {
    const run = this.queue.then(() => this.runEdit(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runEdit(request: ClaimEditRequest): Promise<ClaimEditResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    if (this.checking === dir) {
      return { status: 'error', message: 'Wait until Check sources has finished.' };
    }
    const read = await readProjectJson(dir, CLAIMS_FILE, claimsFileSchema);
    if (read.status !== 'ok') {
      return { status: 'error', message: 'No valid claims.json yet: run Check sources first.' };
    }
    const edited = applyClaimEdit(read.data, request);
    if (!edited.ok) return { status: 'error', message: edited.message };
    const written = await writeClaimsFile(dir, edited.file);
    if (!written.ok) return { status: 'error', message: written.error };
    await this.options.commit(dir, `Sources: ${request.op} ${request.claimId}`);
    return { status: 'ok', state: await this.stateOf(dir) };
  }

  private async stateOf(dir: string): Promise<ClaimsState> {
    const [read, script] = await Promise.all([
      readProjectJson(dir, CLAIMS_FILE, claimsFileSchema),
      readScript(dir),
    ]);
    const file = read.status === 'ok' ? read.data : null;
    const fingerprint = file?.scriptFingerprint;
    return {
      status: 'ok',
      file,
      hasScript: script !== null && script.trim() !== '',
      scriptChanged:
        script !== null && fingerprint !== undefined && fingerprint !== textFingerprint(script),
      checking: this.checking === dir,
      problem: read.status === 'error' ? read.error.message : null,
    };
  }
}
