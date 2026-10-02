/**
 * Writes timeline edits (PLAN.md#6.5) into the open project: reads the raw `storyboard.json` /
 * `cues.json`, applies the edits strictly (shared/timeline-edits.ts; unknown keys survive),
 * validates the result with the schema its readers use (shared storyboard schema + contiguity,
 * the pipeline's CuesFileSchema), writes it atomically (tmp + rename) and commits the project
 * (`ReelForge-Kind: manual`). Changes run one at a time, in arrival order.
 */
import { randomBytes } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CuesFileSchema, renameRetrying } from '@reelforge/pipeline';
import { storyboardFileSchema } from '@reelforge/shared';
import { z } from 'zod';
import { SNAPSHOT_FILES } from '../shared/snapshot-contract.js';
import {
  rawCueSchema,
  type CueEdit,
  type CueTrack,
  type FileEdits,
  type MoveBoundaryEdit,
  type TimelineEditRequest,
  type TimelineEditResult,
} from '../shared/timeline-contract.js';
import {
  applyBoundaryEdits,
  applyCueEdits,
  contiguityBreaks,
  cueLabel,
  type CueAdapter,
} from '../shared/timeline-edits.js';
import { describeError, type Logger } from './logger.js';
import { describeIssues, readProjectText } from './project-files.js';

const looseShotSchema = z.looseObject({ id: z.string(), t0: z.number(), t1: z.number() });
const looseStoryboardSchema = z.looseObject({ shots: z.array(looseShotSchema) });
const looseSfxSchema = z.looseObject({ t: z.number(), gainDb: z.number().optional() });
const looseRangeSchema = z.looseObject({
  from: z.number(),
  to: z.number(),
  gainDb: z.number().optional(),
});
const looseCuesSchema = z.looseObject({
  sfx: z.array(looseSfxSchema).optional(),
  ambience: z.array(looseRangeSchema).optional(),
  music: z.array(looseRangeSchema).optional(),
});
type LooseSfx = z.infer<typeof looseSfxSchema>;
type LooseRange = z.infer<typeof looseRangeSchema>;

const rawAdapter: CueAdapter<LooseSfx, LooseRange> = {
  sfxFromRaw: (raw) => looseSfxSchema.safeParse(raw).data,
  rangeFromRaw: (raw) => looseRangeSchema.safeParse(raw).data,
  toRaw: (item) => rawCueSchema.parse(item),
};

/** Result of applying a change to a file's raw JSON. */
type Applied =
  | { readonly ok: true; readonly json: unknown; readonly inverse: FileEdits }
  | { readonly ok: false; readonly message: string };

export interface TimelineEditServiceOptions {
  /** Folder of the open project (undefined: none open). */
  readonly projectDir: () => string | undefined;
  /** Commits the open project; resolves true when a commit was made. */
  readonly commit: (message: string) => Promise<boolean>;
  readonly log: Logger;
}

const MANY_CUES_VERB: Readonly<Record<CueEdit['kind'], string>> = {
  'move-sfx': 'Move',
  'set-range': 'Resize',
  'set-gain': 'Change the gain of',
  'insert-cue': 'Add',
  'delete-cue': 'Delete',
};

function seconds(t: number): string {
  return `${t.toFixed(2)} s`;
}

/** Commit subject of a change, e.g. `Move boundary s02/s03 to 12.34 s`. */
export function describeChange(
  change: FileEdits,
  labelOf: (track: CueTrack, index: number) => string,
): string {
  if (change.file === 'storyboard') {
    const [edit] = change.edits;
    return change.edits.length === 1 && edit
      ? `Move boundary ${edit.left}/${edit.right} to ${seconds(edit.to)}`
      : `Move ${String(change.edits.length)} shot boundaries`;
  }
  const [first] = change.edits;
  if (change.edits.length === 1 && first) return describeCueEdit(first, labelOf);
  const kinds = new Set(change.edits.map((item) => item.kind));
  const verb = kinds.size === 1 && first ? MANY_CUES_VERB[first.kind] : 'Edit';
  return `${verb} ${String(change.edits.length)} cues`;
}

function describeCueEdit(
  edit: CueEdit,
  labelOf: (track: CueTrack, index: number) => string,
): string {
  switch (edit.kind) {
    case 'move-sfx':
      return `Move cue ${labelOf('sfx', edit.index)} to ${seconds(edit.to)}`;
    case 'set-range':
      return `Set ${edit.track} ${labelOf(edit.track, edit.index)} to ${edit.to.from.toFixed(2)}–${seconds(edit.to.to)}`;
    case 'set-gain':
      return `Set ${edit.track} ${labelOf(edit.track, edit.index)} gain to ${String(edit.to)} dB`;
    case 'insert-cue':
      return `Add ${edit.track} cue ${cueLabel(edit.cue, edit.track)}`;
    case 'delete-cue':
      return `Delete ${edit.track} cue ${labelOf(edit.track, edit.index)}`;
  }
}

const REASON_PREFIX: Readonly<Record<TimelineEditRequest['reason'], string>> = {
  edit: '',
  undo: 'Undo: ',
  redo: 'Redo: ',
};

function applyToStoryboard(json: unknown, edits: readonly MoveBoundaryEdit[]): Applied {
  const loose = looseStoryboardSchema.safeParse(json);
  if (!loose.success) return { ok: false, message: 'storyboard.json has no valid shots list' };
  const applied = applyBoundaryEdits(loose.data.shots, edits, 'strict');
  if (!applied.ok) return { ok: false, message: applied.error };
  const next = { ...loose.data, shots: applied.value.shots };
  const valid = storyboardFileSchema.safeParse(next);
  if (!valid.success) {
    return { ok: false, message: `storyboard.json: ${describeIssues(valid.error)}` };
  }
  if (contiguityBreaks(applied.value.shots) > contiguityBreaks(loose.data.shots)) {
    return { ok: false, message: 'the edit would leave a gap or overlap between shots' };
  }
  return { ok: true, json: next, inverse: { file: 'storyboard', edits: applied.value.inverse } };
}

function applyToCues(json: unknown, edits: readonly CueEdit[]): Applied {
  const loose = looseCuesSchema.safeParse(json);
  if (!loose.success) return { ok: false, message: 'cues.json is not a cues object' };
  const lists = {
    sfx: loose.data.sfx ?? [],
    ambience: loose.data.ambience ?? [],
    music: loose.data.music ?? [],
  };
  const applied = applyCueEdits(lists, edits, rawAdapter, 'strict');
  if (!applied.ok) return { ok: false, message: applied.error };
  const next: Record<string, unknown> = { ...loose.data };
  for (const track of ['sfx', 'ambience', 'music'] as const) {
    const list = applied.value.cues[track];
    if (loose.data[track] !== undefined || list.length > 0) next[track] = list;
  }
  const valid = CuesFileSchema.safeParse(next);
  if (!valid.success) return { ok: false, message: `cues.json: ${describeIssues(valid.error)}` };
  return { ok: true, json: next, inverse: { file: 'cues', edits: applied.value.inverse } };
}

function cueLabelOf(json: unknown): (track: CueTrack, index: number) => string {
  const loose = looseCuesSchema.safeParse(json);
  return (track, index) => {
    const cue = loose.success ? loose.data[track]?.[index] : undefined;
    return cue === undefined ? `#${String(index + 1)}` : cueLabel(cue, `#${String(index + 1)}`);
  };
}

/** Writes UTF-8 text via a temp file + rename (Windows-safe atomic replace). */
export async function writeTextAtomic(file: string, text: string): Promise<void> {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(tmp, text, 'utf8');
    // Windows: git (autocommit) or a reader may hold the target for a moment (EPERM / EBUSY).
    await renameRetrying(tmp, file);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

export class TimelineEditService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: TimelineEditServiceOptions) {}

  /** Runs another writer of storyboard.json / cues.json (the Sound panel) in the same queue. */
  exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Applies one change; queued behind the previous ones. */
  edit(request: TimelineEditRequest): Promise<TimelineEditResult> {
    const run = this.queue.then(() => this.run(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(request: TimelineEditRequest): Promise<TimelineEditResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const { change } = request;
    const relative = change.file === 'storyboard' ? SNAPSHOT_FILES.storyboard : SNAPSHOT_FILES.cues;
    const text = await readProjectText(dir, relative);
    let json: unknown;
    if (text.status === 'ok') {
      try {
        json = JSON.parse(text.data);
      } catch (error) {
        return {
          status: 'rejected',
          message: `${relative} is not valid JSON: ${describeError(error)}`,
        };
      }
    } else if (text.status === 'missing' && change.file === 'cues') {
      json = { version: 1 };
    } else {
      const reason = text.status === 'missing' ? 'does not exist' : text.error.message;
      return { status: 'rejected', message: `${relative} ${reason}` };
    }
    const applied =
      change.file === 'storyboard'
        ? applyToStoryboard(json, change.edits)
        : applyToCues(json, change.edits);
    if (!applied.ok) {
      this.options.log.warn(`timeline edit of ${relative} rejected: ${applied.message}`);
      return { status: 'rejected', message: applied.message };
    }
    const message = `${REASON_PREFIX[request.reason]}${describeChange(change, cueLabelOf(json))}`;
    try {
      await writeTextAtomic(path.join(dir, relative), `${JSON.stringify(applied.json, null, 2)}\n`);
    } catch (error) {
      this.options.log.error(`cannot write ${relative}: ${describeError(error)}`);
      return { status: 'error', message: `cannot write ${relative}: ${describeError(error)}` };
    }
    const committed = await this.options.commit(message);
    this.options.log.info(`timeline edit: ${message}${committed ? '' : ' (not committed)'}`);
    return { status: 'ok', inverse: applied.inverse, message, committed };
  }
}
