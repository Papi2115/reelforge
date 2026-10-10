/** The scene-run handler of the stage panels on a recording fake service (no Electron, no stages). */
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { describe, expect, it } from 'vitest';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import { createLogger } from '../logger.js';
import { MicPermissionGate } from '../mic-permission.js';
import { ScriptDocuments } from './script-documents.js';
import type { StageService } from './stage-service.js';
import { stagesHandlers } from './stages-ipc.js';

type Enqueued = Parameters<StageService['enqueue']>[0];

function handlers(): { readonly handlers: ReturnType<typeof stagesHandlers>; queued: Enqueued[] } {
  const queued: Enqueued[] = [];
  const queuedResult: StageCommandResult = { status: 'queued', message: null };
  const service: Pick<StageService, 'state' | 'run' | 'stop' | 'enqueue'> = {
    state: () => Promise.reject(new Error('not used')),
    run: () => Promise.resolve(queuedResult),
    stop: () => false,
    enqueue: (requests) => {
      queued.push(requests);
      return Promise.resolve(queuedResult);
    },
  };
  const unused = (): never => {
    throw new Error('not used');
  };
  const log = createLogger(() => undefined);
  const currentProject = (): string => 'C:/projects/Creatorize Suite/film';
  return {
    queued,
    handlers: stagesHandlers({
      service,
      documents: new ScriptDocuments({
        store: new PipelineStateStore(),
        currentProject,
        scriptBusy: () => false,
        commit: () => Promise.resolve(),
        afterChange: () => undefined,
        log,
      }),
      currentProject,
      pickFile: unused,
      openPath: unused,
      probe: unused,
      hasWhisperModel: () => true,
      mic: new MicPermissionGate('reelforge://app'),
      commit: () => Promise.resolve(),
      log,
    }),
  };
}

describe('scenesRun', () => {
  it('queues the look assets of a world film as one whole-film scenes action', async () => {
    const { handlers: api, queued } = handlers();
    expect(await api.scenesRun({ action: 'world-assets', shots: ['s01'] })).toEqual({
      status: 'queued',
      message: null,
    });
    expect(queued).toEqual([[{ stage: 'scenes', action: 'world-assets' }]]);
  });

  it("queues a Grim Ink film's people and places as one whole-film scenes action", async () => {
    const { handlers: api, queued } = handlers();
    await api.scenesRun({ action: 'c-cam-modules', shots: ['s01'] });
    expect(queued).toEqual([[{ stage: 'scenes', action: 'c-cam-modules' }]]);
  });

  it('keeps a build of chosen shots and a review as before', async () => {
    const { handlers: api, queued } = handlers();
    await api.scenesRun({ action: 'build', shots: ['s02'] });
    await api.scenesRun({ action: 'final-review', shots: null });
    expect(queued).toEqual([
      [{ stage: 'scenes', shots: ['s02'] }],
      [{ stage: 'scenes', action: 'final-review' }],
    ]);
  });
});
