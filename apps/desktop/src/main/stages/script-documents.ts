/**
 * The Brief -> Script documents of the open project (PLAN.md#7.1): brief.json from the brief form,
 * the script view (script.txt, research.md, beats.md, sources, the script report), the editor's
 * autosave (atomic write; commits coalesced into one `manual` commit per editing pause), a script
 * imported from a file (Replace) and the acceptance gate ("Approve script" in pipeline.json).
 * Changing the script marks the later stages that already produced something out of date.
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { PipelineStateStore } from '@reelforge/claude-bridge';
import { writeAtomic } from '@reelforge/project';
import {
  BRIEF_FILE_VERSION,
  briefFileSchema,
  scriptReportSchema,
  type BriefFile,
  type PipelineState,
  type StageState,
} from '@reelforge/shared';
import {
  FILES,
  inProject,
  markStale,
  readProjectSnapshot,
  REPORTS,
  stagesToInvalidate,
} from '@reelforge/stages';
import type {
  BriefInput,
  BriefResult,
  ResearchSource,
  ScriptDocument,
  StageCommandResult,
} from '../../shared/stages-contract.js';
import { MAX_SCRIPT_CHARS } from '../../shared/stages-contract.js';
import { describeError, type Logger } from '../logger.js';
import { readProjectJson, readProjectText } from '../project-files.js';

export interface ScriptDocumentsOptions {
  readonly store: PipelineStateStore;
  readonly currentProject: () => string | undefined;
  /** The script stage runs or waits in `dir` (its files must not be edited meanwhile). */
  readonly scriptBusy: (dir: string) => boolean;
  /** Autocommit (`manual`) of `dir`; failures are logged by the caller. */
  readonly commit: (dir: string, message: string, step: string) => Promise<void>;
  /** Something changed on disk: the sidebar state must be re-read. */
  readonly afterChange: () => void;
  readonly log: Logger;
  /** Epoch ms. */
  readonly now?: () => number;
  /** Editing pause after which the edits are committed. Default 2 s. */
  readonly commitDelayMs?: number;
}

export const MAX_SOURCES = 100;
const MAX_IMPORT_BYTES = 1024 * 1024;
const URL_PATTERN = /https?:\/\/\S+/g;
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const ok = (message: string | null = null): StageCommandResult => ({ status: 'ok', message });
const failed = (message: string): StageCommandResult => ({ status: 'error', message });

const count = (text: string, char: string): number => text.split(char).length - 1;

/** A URL as written in markdown, without trailing punctuation or an unbalanced `)`. */
export function cleanUrl(raw: string): string {
  let url = raw.replace(/[>\]]+$/, '').replace(/[.,;:!?'"]+$/, '');
  while (url.endsWith(')') && count(url, ')') > count(url, '(')) {
    url = url.slice(0, -1).replace(/[.,;:!?'"]+$/, '');
  }
  return url;
}

/** Every distinct URL in research.md with the claim on its line. */
export function researchSources(markdown: string): ResearchSource[] {
  const sources: ResearchSource[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    for (const match of line.matchAll(URL_PATTERN)) {
      const url = cleanUrl(match[0]);
      if (seen.has(url)) continue;
      seen.add(url);
      const claim = line
        .replace(URL_PATTERN, '')
        .replace(/\(\s*\)/g, '')
        .replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')
        .replace(/[\s—–:(.-]+$/, '')
        .trim();
      sources.push({ url, claim });
    }
  }
  return sources.slice(0, MAX_SOURCES);
}

/** brief.json content of the form (empty optional fields left out). */
export function briefFromInput(input: BriefInput): BriefFile {
  const optional = (value: string): string | undefined => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  };
  const tone = optional(input.tone);
  const audience = optional(input.audience);
  const notes = optional(input.notes);
  return briefFileSchema.parse({
    version: BRIEF_FILE_VERSION,
    topic: input.topic.trim(),
    language: input.language,
    targetMinutes: input.targetMinutes,
    ...(tone === undefined ? {} : { tone }),
    ...(audience === undefined ? {} : { audience }),
    ...(notes === undefined ? {} : { notes }),
  });
}

/** The script stage state after the user changed the script (by hand or by an import). */
export function scriptEdited(
  state: PipelineState,
  options: { readonly stamp: string; readonly message: string; readonly resetApproval: boolean },
): PipelineState {
  const current = state.stages['script'];
  const keepCurrent = current?.status === 'done' && !options.resetApproval;
  const next: StageState = keepCurrent
    ? current
    : {
        status: 'done',
        updatedAt: options.stamp,
        message: options.message,
        ...(options.resetApproval || current?.approvedAt === undefined
          ? {}
          : { approvedAt: current.approvedAt }),
      };
  return { ...state, stages: { ...state.stages, script: next } };
}

export function clip(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

export class ScriptDocuments {
  private pending:
    { readonly dir: string; readonly timer: ReturnType<typeof setTimeout> } | undefined;

  constructor(private readonly options: ScriptDocumentsOptions) {}

  /** Editor changes wait for their commit. */
  get dirty(): boolean {
    return this.pending !== undefined;
  }

  async brief(): Promise<BriefResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return { brief: null, error: 'No project is open.' };
    const brief = await readProjectJson(dir, FILES.brief, briefFileSchema);
    if (brief.status === 'ok') return { brief: brief.data, error: null };
    return { brief: null, error: brief.status === 'missing' ? null : brief.error.message };
  }

  async saveBrief(input: BriefInput): Promise<StageCommandResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return failed('No project is open.');
    if (this.options.scriptBusy(dir))
      return failed('The script is being written: wait or stop it.');
    const brief = briefFromInput(input);
    try {
      await writeAtomic(inProject(dir, FILES.brief), `${JSON.stringify(brief, null, 2)}\n`);
    } catch (error) {
      return failed(`brief.json not saved: ${describeError(error)}`);
    }
    await this.options.commit(dir, `Brief: ${clip(brief.topic, 60)}`, 'brief');
    this.options.afterChange();
    return ok();
  }

  async script(): Promise<ScriptDocument> {
    const dir = this.options.currentProject();
    const empty: ScriptDocument = {
      script: null,
      research: null,
      beats: null,
      sources: [],
      targetMinutes: null,
      report: null,
    };
    if (dir === undefined) return empty;
    const [script, research, beats, brief, report] = await Promise.all([
      readProjectText(dir, FILES.script),
      readProjectText(dir, FILES.research),
      readProjectText(dir, FILES.beats),
      readProjectJson(dir, FILES.brief, briefFileSchema),
      readProjectJson(dir, REPORTS.script, scriptReportSchema),
    ]);
    const text = (state: typeof script): string | null =>
      state.status === 'ok' ? state.data : null;
    const researchText = text(research);
    return {
      script: text(script),
      research: researchText,
      beats: text(beats),
      sources: researchText === null ? [] : researchSources(researchText),
      targetMinutes: brief.status === 'ok' ? (brief.data.targetMinutes ?? null) : null,
      report: report.status === 'ok' ? report.data : null,
    };
  }

  /** Editor autosave: writes script.txt now, commits after the editing pause. */
  async saveScript(text: string): Promise<StageCommandResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return failed('No project is open.');
    if (this.options.scriptBusy(dir))
      return failed('The script is being written: wait or stop it.');
    const previous = await readProjectText(dir, FILES.script);
    if (previous.status === 'ok' && previous.data === text) return ok('No changes.');
    const written = await this.writeScript(dir, text, 'edited by hand', false);
    if (written.status === 'error') return written;
    this.scheduleCommit(dir);
    this.options.afterChange();
    return written;
  }

  /** Replace: a script from a text file; it needs a new approval. */
  async importScript(file: string): Promise<StageCommandResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return failed('No project is open.');
    if (this.options.scriptBusy(dir))
      return failed('The script is being written: wait or stop it.');
    let text: string;
    try {
      const info = await stat(file);
      if (info.size > MAX_IMPORT_BYTES) return failed(`${path.basename(file)} is too large.`);
      const raw = await readFile(file, 'utf8');
      text = raw.startsWith(BYTE_ORDER_MARK) ? raw.slice(1) : raw;
    } catch (error) {
      return failed(`Cannot read ${path.basename(file)}: ${describeError(error)}`);
    }
    if (text.length > MAX_SCRIPT_CHARS) return failed(`${path.basename(file)} is too long.`);
    const name = path.basename(file);
    const written = await this.writeScript(dir, text, `imported from ${name}`, true);
    if (written.status === 'error') return written;
    await this.flush();
    await this.options.commit(dir, `Import script from ${name}`, 'script');
    this.options.afterChange();
    return ok(`Imported ${name}.`);
  }

  /** The acceptance gate: later stages may run once the script is approved. */
  async approve(): Promise<StageCommandResult> {
    const dir = this.options.currentProject();
    if (dir === undefined) return failed('No project is open.');
    if (this.options.scriptBusy(dir))
      return failed('The script is being written: wait or stop it.');
    const script = await readProjectText(dir, FILES.script);
    if (script.status !== 'ok' || script.data.trim() === '') {
      return failed('Write or import a script first.');
    }
    await this.flush();
    const stamp = this.stamp();
    const updated = await this.options.store.update(dir, (state) => {
      const current = state.stages['script'];
      const approved: StageState = {
        ...(current ?? { message: 'written by hand' }),
        status: 'done',
        updatedAt: stamp,
        approvedAt: stamp,
      };
      return { ...state, stages: { ...state.stages, script: approved } };
    });
    if (!updated.ok) return failed(`Approval not saved: ${updated.error.message}`);
    this.options.log.info(`script approved in ${dir}`);
    this.options.afterChange();
    return ok('Script approved.');
  }

  /** Commits pending editor changes now (project switch, quit, before an import/approval). */
  async flush(): Promise<void> {
    const pending = this.pending;
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.pending = undefined;
    await this.options.commit(pending.dir, 'Edit script', 'script');
  }

  private stamp(): string {
    return new Date(this.options.now?.() ?? Date.now()).toISOString();
  }

  private scheduleCommit(dir: string): void {
    const pending = this.pending;
    if (pending !== undefined && pending.dir !== dir) void this.flush();
    if (this.pending !== undefined) clearTimeout(this.pending.timer);
    const timer = setTimeout(() => {
      void this.flush();
    }, this.options.commitDelayMs ?? 2_000);
    this.pending = { dir, timer };
  }

  private async writeScript(
    dir: string,
    text: string,
    message: string,
    resetApproval: boolean,
  ): Promise<StageCommandResult> {
    try {
      await writeAtomic(inProject(dir, FILES.script), text);
    } catch (error) {
      return failed(`script.txt not saved: ${describeError(error)}`);
    }
    const snapshot = await readProjectSnapshot(dir, this.options.store);
    const invalidate = stagesToInvalidate('script', snapshot);
    const stamp = this.stamp();
    const updated = await this.options.store.update(dir, (state) => {
      const edited = scriptEdited(state, { stamp, message, resetApproval });
      return invalidate.length === 0
        ? edited
        : markStale(edited, invalidate, 'script changed', stamp);
    });
    if (!updated.ok)
      this.options.log.warn(`pipeline.json after a script edit: ${updated.error.message}`);
    return ok(invalidate.length === 0 ? null : `Out of date now: ${invalidate.join(', ')}.`);
  }
}
