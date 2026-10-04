/**
 * Hook lab of the open project (PLAN.md#12.16, ADR-021): "Generate" runs the stages'
 * `generateHooks` (one Sonnet turn, read-only tools, no web; one at a time per app), "Use this
 * opening" the stages' `pickHook` after the script editor's pending edits are committed, then
 * commits script.txt (`Hook lab: opening 2 (Question)`, step `script`) and refreshes the
 * pipeline (later stages are out of date). Refused while the Script stage runs. Electron-free.
 */
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import { promptModel } from '@reelforge/prompts';
import { HOOK_STYLE_LABELS, type AppSettings } from '@reelforge/shared';
import {
  discardHooks,
  generateHooks,
  pickHook,
  readHookLabState,
  type ClaudeRunner,
} from '@reelforge/stages';
import type {
  HookLabPickRequest,
  HookLabResult,
  HookLabState,
  HookLabView,
} from '../../shared/hook-lab-contract.js';
import { describeError, type Logger } from '../logger.js';

export interface HookLabServiceOptions {
  readonly currentProject: () => string | undefined;
  readonly claude: ClaudeRunner;
  readonly settings: () => AppSettings;
  readonly store: PipelineStateStore;
  /** The Script stage runs or waits in `dir`. */
  readonly scriptBusy: (dir: string) => boolean;
  /** Commits the script editor's pending edits first (their own "Edit script" commit). */
  readonly flushScript: () => Promise<void>;
  /** Autocommit (`manual`, step `script`); false when it failed (logged by the caller). */
  readonly commit: (dir: string, message: string) => Promise<boolean>;
  /** Something changed on disk: the pipeline sidebar must be re-read. */
  readonly afterChange: () => void;
  readonly now: () => Date;
  readonly log: Logger;
}

const NO_PROJECT: HookLabResult = { status: 'error', message: 'No project is open.' };
const SCRIPT_BUSY = 'The script is being written: wait or stop it.';

export class HookLabService {
  private generating: string | null = null;

  constructor(private readonly options: HookLabServiceOptions) {}

  async state(): Promise<HookLabState> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    const view = await this.view(dir);
    return view === undefined ? { status: 'error', message: 'Cannot read the hook lab.' } : view;
  }

  async generate(): Promise<HookLabResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return NO_PROJECT;
    if (this.generating !== null) return { status: 'error', message: 'Already writing openings.' };
    if (this.options.scriptBusy(dir)) return { status: 'error', message: SCRIPT_BUSY };
    this.generating = dir;
    let generated: Awaited<ReturnType<typeof generateHooks>>;
    try {
      await this.options.flushScript();
      generated = await generateHooks({
        projectDir: dir,
        claude: this.options.claude,
        model: promptModel('hooks', { economy: this.options.settings().economy }),
        now: this.options.now,
      });
    } catch (error) {
      return { status: 'error', message: describeError(error) };
    } finally {
      this.generating = null;
    }
    if (!generated.ok) return { status: 'error', message: generated.error };
    this.options.log.info(`hook lab: set ${String(generated.value.number)} written in ${dir}`);
    return this.result(dir, null, [...generated.value.warnings], []);
  }

  async pick(request: HookLabPickRequest): Promise<HookLabResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return NO_PROJECT;
    if (this.generating === dir || this.options.scriptBusy(dir)) {
      return { status: 'error', message: 'Wait until the script or the openings are written.' };
    }
    await this.options.flushScript();
    const picked = await pickHook({
      projectDir: dir,
      number: request.number,
      index: request.index,
      store: this.options.store,
      now: this.options.now,
    });
    if (!picked.ok) return { status: 'error', message: picked.error.message };
    const committed = await this.options.commit(dir, picked.value.commitMessage);
    const warnings = [...picked.value.warnings];
    if (!committed) warnings.push('The new opening is saved but was not committed.');
    this.options.afterChange();
    const variant = picked.value.set.variants.find((entry) => entry.index === request.index);
    this.options.log.info(`hook lab: ${picked.value.commitMessage} in ${dir}`);
    const message =
      variant === undefined
        ? 'The new opening is in the script.'
        : `Opening ${String(variant.index)} (${HOOK_STYLE_LABELS[variant.style]}) is now the script's opening.`;
    return this.result(dir, message, warnings, [...picked.value.invalidated]);
  }

  async discard(number: number): Promise<HookLabResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return NO_PROJECT;
    const discarded = await discardHooks({
      projectDir: dir,
      number,
      store: this.options.store,
      now: this.options.now,
    });
    if (!discarded.ok) return { status: 'error', message: discarded.error.message };
    return this.result(dir, 'Kept the current opening.', [], []);
  }

  private async view(dir: string): Promise<Extract<HookLabState, { status: 'ok' }> | undefined> {
    const read = await readHookLabState(dir, this.options.store);
    if (!read.ok) {
      this.options.log.warn(`hook lab state: ${read.error.message}`);
      return undefined;
    }
    const view: HookLabView = {
      ...read.value,
      lockedShots: [...read.value.lockedShots],
      generating: this.generating === dir,
      scriptBusy: this.options.scriptBusy(dir),
    };
    return { status: 'ok', view };
  }

  private async result(
    dir: string,
    message: string | null,
    warnings: string[],
    invalidated: string[],
  ): Promise<HookLabResult> {
    const view = await this.view(dir);
    if (view === undefined) return { status: 'error', message: 'Cannot read the hook lab.' };
    return { status: 'ok', view: view.view, message, warnings, invalidated };
  }
}
