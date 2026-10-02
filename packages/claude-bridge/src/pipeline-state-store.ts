/**
 * PipelineStateStore (PLAN.md#5.4): `<project>/.reelforge/pipeline.json` (schema in
 * @reelforge/shared) with per-stage status, the work-item queue and the limit pause. Every change
 * is an atomic, per-file serialized read-modify-write, so a crash never loses finished items.
 */
import path from 'node:path';
import {
  PIPELINE_STATE_VERSION,
  pipelineStateSchema,
  type PipelinePause,
  type PipelineState,
  type SessionPurpose,
  type StageRunStatus,
  type WorkItem,
} from '@reelforge/shared';
import { JsonFileStore, type JsonFileError } from './json-file.js';
import type { Result } from './result.js';

export const PIPELINE_FILE = path.join('.reelforge', 'pipeline.json');

export function pipelineFilePath(projectDir: string): string {
  return path.join(projectDir, PIPELINE_FILE);
}

/** A job to add to a stage's queue (e.g. one shot of scene-build). */
export interface WorkItemSpec {
  readonly id: string;
  readonly prompt: string;
  readonly purpose?: SessionPurpose;
  readonly newSession?: boolean;
}

type PatchableKey = 'status' | 'attempts' | 'limitHits' | 'lastError' | 'sessionId' | 'finishedAt';

/** `undefined` clears an optional field (e.g. `lastError` once the item succeeded). */
export type WorkItemPatch = { readonly [K in PatchableKey]?: WorkItem[K] | undefined };

export class PipelineStateStore {
  private readonly store: JsonFileStore<PipelineState>;

  constructor(private readonly now: () => Date = () => new Date()) {
    this.store = new JsonFileStore(pipelineStateSchema, () => ({
      version: PIPELINE_STATE_VERSION,
      updatedAt: this.stamp(),
      stages: {},
      queue: [],
    }));
  }

  read(projectDir: string): Promise<Result<PipelineState, JsonFileError>> {
    return this.store.read(pipelineFilePath(projectDir));
  }

  update(
    projectDir: string,
    mutate: (state: PipelineState) => PipelineState,
  ): Promise<Result<PipelineState, JsonFileError>> {
    return this.store.update(pipelineFilePath(projectDir), (state) => ({
      ...mutate(state),
      updatedAt: this.stamp(),
    }));
  }

  /** Adds items whose (stage, id) is not queued yet; existing items (done or not) are kept as is. */
  addItems(
    projectDir: string,
    stage: string,
    specs: readonly WorkItemSpec[],
  ): Promise<Result<PipelineState, JsonFileError>> {
    return this.update(projectDir, (state) => {
      const known = new Set(
        state.queue.filter((item) => item.stage === stage).map((item) => item.id),
      );
      const stamp = this.stamp();
      const added = specs
        .filter((spec) => !known.has(spec.id))
        .map((spec): WorkItem => ({
          id: spec.id,
          stage,
          prompt: spec.prompt,
          ...(spec.purpose === undefined ? {} : { purpose: spec.purpose }),
          ...(spec.newSession === undefined ? {} : { newSession: spec.newSession }),
          status: 'pending',
          attempts: 0,
          limitHits: 0,
          createdAt: stamp,
          updatedAt: stamp,
        }));
      return { ...state, queue: [...state.queue, ...added] };
    });
  }

  patchItem(
    projectDir: string,
    stage: string,
    id: string,
    patch: WorkItemPatch,
  ): Promise<Result<PipelineState, JsonFileError>> {
    return this.update(projectDir, (state) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.stage === stage && item.id === id
          ? { ...applyItemPatch(item, patch), updatedAt: this.stamp() }
          : item,
      ),
    }));
  }

  /** After a restart nothing is in flight: `running` items of `stage` become `pending` again. */
  recoverRunning(projectDir: string, stage: string): Promise<Result<PipelineState, JsonFileError>> {
    return this.update(projectDir, (state) => ({
      ...state,
      queue: state.queue.map((item) =>
        item.stage === stage && item.status === 'running'
          ? { ...item, status: 'pending', updatedAt: this.stamp() }
          : item,
      ),
    }));
  }

  setStage(
    projectDir: string,
    stage: string,
    status: StageRunStatus,
    message?: string,
  ): Promise<Result<PipelineState, JsonFileError>> {
    return this.update(projectDir, (state) => ({
      ...state,
      stages: {
        ...state.stages,
        [stage]: { status, updatedAt: this.stamp(), ...(message === undefined ? {} : { message }) },
      },
    }));
  }

  setPause(
    projectDir: string,
    pause: PipelinePause | undefined,
  ): Promise<Result<PipelineState, JsonFileError>> {
    return this.update(projectDir, (state) => {
      if (pause !== undefined) return { ...state, pause };
      const next = { ...state };
      delete next.pause;
      return next;
    });
  }

  private stamp(): string {
    return this.now().toISOString();
  }
}

/**
 * `item` with `patch` applied; patch keys set to undefined remove the field
 * (`exactOptionalPropertyTypes`: only optional fields are patchable to undefined).
 */
export function applyItemPatch(item: WorkItem, patch: WorkItemPatch): WorkItem {
  const merged: WorkItem = { ...item };
  const target = merged as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) Reflect.deleteProperty(target, key);
    else target[key] = value;
  }
  return merged;
}
