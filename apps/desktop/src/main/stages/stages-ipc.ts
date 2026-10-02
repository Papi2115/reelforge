/**
 * IPC handlers of the pipeline sidebar and the Brief -> Script documents (PLAN.md#6.8, #7.1),
 * merged into `registerIpc` by main.ts. Electron-free: the native file picker and
 * `shell.openPath` come in through the options.
 */
import type { StageCommandResult, StageArtifact } from '../../shared/stages-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { Logger } from '../logger.js';
import type { ScriptDocuments } from './script-documents.js';
import { artifactPath } from './stage-artifacts.js';
import type { StageService } from './stage-service.js';

export type StagesHandlers = Pick<
  InvokeHandlers,
  | 'stagesState'
  | 'stagesRun'
  | 'stagesStop'
  | 'stagesReplace'
  | 'stagesOpen'
  | 'briefGet'
  | 'briefSave'
  | 'scriptGet'
  | 'scriptSave'
  | 'scriptApprove'
>;

export type ReplacePick = 'script' | 'voiceover';

export interface StagesHandlerOptions {
  readonly service: StageService;
  readonly documents: ScriptDocuments;
  readonly currentProject: () => string | undefined;
  /** Native file picker; undefined when cancelled. */
  readonly pickFile: (kind: ReplacePick) => Promise<string | undefined>;
  /** `shell.openPath`: resolves to an error message, '' on success. */
  readonly openPath: (file: string) => Promise<string>;
  readonly log: Logger;
}

const cancelled: StageCommandResult = { status: 'cancelled', message: null };

async function openArtifact(
  options: StagesHandlerOptions,
  artifact: StageArtifact,
): Promise<StageCommandResult> {
  const dir = options.currentProject();
  if (dir === undefined) return { status: 'error', message: 'No project is open.' };
  const resolved = await artifactPath(dir, artifact);
  if (!resolved.ok) return { status: 'error', message: resolved.error };
  const problem = await options.openPath(resolved.value);
  if (problem !== '') {
    options.log.warn(`opening ${resolved.value} failed: ${problem}`);
    return { status: 'error', message: problem };
  }
  return { status: 'ok', message: null };
}

export function stagesHandlers(options: StagesHandlerOptions): StagesHandlers {
  const { service, documents } = options;
  return {
    stagesState: () => service.state(),
    stagesRun: (request) => service.run(request.stages),
    stagesStop: (request) => Promise.resolve(service.stop(request.stage)),
    stagesReplace: async (request) => {
      if (options.currentProject() === undefined) {
        return { status: 'error', message: 'No project is open.' };
      }
      const file = await options.pickFile(request.stage);
      if (file === undefined) return cancelled;
      if (request.stage === 'script') return documents.importScript(file);
      return service.enqueue([{ stage: 'voiceover', source: file }]);
    },
    stagesOpen: (request) => openArtifact(options, request.artifact),
    briefGet: () => documents.brief(),
    briefSave: (request) => documents.saveBrief(request),
    scriptGet: () => documents.script(),
    scriptSave: (request) => documents.saveScript(request.text),
    scriptApprove: () => documents.approve(),
  };
}
