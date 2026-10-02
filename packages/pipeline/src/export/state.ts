/**
 * `.reelforge/cache/export/export-state.json`: the resumable record of the current export. Written
 * atomically after every finished shot, so a killed export knows which shots are already encoded.
 * Segments themselves are content-addressed (`segments/<cache key>.mp4`) and only ever appear via
 * rename after a successful encode, so a listed shot is reused only if its file still exists.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { readJsonFile, writeJsonAtomic, type JsonFileError } from '../schemas/json-file.js';
import { err, ok, type Result } from '../result.js';

export const EXPORT_STATE_VERSION = 1;

export const ExportStateShotSchema = z.object({
  id: z.string().min(1),
  /** Segment cache key (sha256 hex). */
  key: z.string().regex(/^[0-9a-f]{64}$/),
  frames: z.int().positive(),
});

export const ExportStateSchema = z.object({
  version: z.literal(EXPORT_STATE_VERSION),
  /** Fingerprint of the whole job (all shot keys + output settings + audio + title). */
  jobKey: z.string().min(1),
  status: z.enum(['running', 'complete']),
  output: z.string().min(1),
  preset: z.string().min(1),
  encoder: z.string().min(1),
  totalShots: z.int().nonnegative(),
  /** Shots whose segments are encoded, in completion order. */
  finished: z.array(ExportStateShotSchema),
});
export type ExportState = z.infer<typeof ExportStateSchema>;
export type ExportStateShot = z.infer<typeof ExportStateShotSchema>;

export interface ExportPaths {
  readonly cacheDir: string;
  readonly segmentsDir: string;
  readonly stateFile: string;
  readonly outDir: string;
}

export function exportPaths(projectDir: string): ExportPaths {
  const cacheDir = path.join(projectDir, '.reelforge', 'cache', 'export');
  return {
    cacheDir,
    segmentsDir: path.join(cacheDir, 'segments'),
    stateFile: path.join(cacheDir, 'export-state.json'),
    outDir: path.join(projectDir, 'out'),
  };
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    // Missing or inaccessible: treated as absent (the segment is re-rendered).
    return false;
  }
}

/** Reads the state; a missing file is `null`, a corrupt one is an error the caller may ignore. */
export async function readExportState(
  stateFile: string,
): Promise<Result<ExportState | null, JsonFileError>> {
  if (!(await fileExists(stateFile))) return ok(null);
  const read = await readJsonFile(stateFile, ExportStateSchema);
  return read.ok ? ok(read.value) : err(read.error);
}

/** Serializes state writes: concurrent workers finish shots in any order. */
export class ExportStateWriter {
  private state: ExportState;
  private queue: Promise<Result<ExportState, JsonFileError>>;

  constructor(
    private readonly stateFile: string,
    initial: ExportState,
  ) {
    this.state = initial;
    this.queue = Promise.resolve(ok(initial));
  }

  get current(): ExportState {
    return this.state;
  }

  private enqueue(next: ExportState): Promise<Result<ExportState, JsonFileError>> {
    this.state = next;
    this.queue = this.queue.then(() => writeJsonAtomic(this.stateFile, ExportStateSchema, next));
    return this.queue;
  }

  write(): Promise<Result<ExportState, JsonFileError>> {
    return this.enqueue(this.state);
  }

  markFinished(shot: ExportStateShot): Promise<Result<ExportState, JsonFileError>> {
    const finished = [...this.state.finished.filter((entry) => entry.id !== shot.id), shot];
    return this.enqueue({ ...this.state, finished });
  }

  markComplete(): Promise<Result<ExportState, JsonFileError>> {
    return this.enqueue({ ...this.state, status: 'complete' });
  }
}
