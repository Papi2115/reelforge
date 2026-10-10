/**
 * IPC handlers of the pipeline sidebar, the Brief -> Script documents and the stage panels
 * (PLAN.md#6.8, #7.1-7.7), merged into `registerIpc` by main.ts. Electron-free: the native file
 * picker, `shell.openPath`, the audio probe and the microphone gate come in through the options.
 */
import type { WhisperModelId } from '@reelforge/pipeline';
import { VOICEOVER_EXTENSIONS } from '@reelforge/shared';
import type { StageCommandResult, StageArtifact } from '../../shared/stages-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import { describeError, type Logger } from '../logger.js';
import type { MicPermissionGate } from '../mic-permission.js';
import type { ScriptDocuments } from './script-documents.js';
import { artifactPath } from './stage-artifacts.js';
import { lockShots } from './shot-locks.js';
import { readStageReports } from './stage-reports.js';
import type { StageService } from './stage-service.js';
import {
  checkImport,
  saveRecording,
  validateRecordingWav,
  type AudioProbe,
} from './voiceover-input.js';

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
  | 'voiceoverImport'
  | 'voiceoverRecording'
  | 'micArm'
  | 'stagesReports'
  | 'wordsRetry'
  | 'scenesRun'
  | 'shotsLock'
>;

export type ReplacePick = 'script' | 'voiceover';

/** Options of the native file picker for Replace (Electron's OpenDialogOptions shape). */
export function replacementDialogOptions(kind: ReplacePick): {
  title: string;
  buttonLabel: string;
  filters: { name: string; extensions: string[] }[];
  properties: ['openFile'];
} {
  return kind === 'script'
    ? {
        title: 'Use a script from a text file',
        buttonLabel: 'Use this script',
        filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
        properties: ['openFile'],
      }
    : {
        title: 'Import a voice-over recording',
        buttonLabel: 'Import',
        filters: [{ name: 'Audio', extensions: [...VOICEOVER_EXTENSIONS] }],
        properties: ['openFile'],
      };
}

export interface StagesHandlerOptions {
  readonly service: Pick<StageService, 'state' | 'run' | 'stop' | 'enqueue'>;
  readonly documents: ScriptDocuments;
  readonly currentProject: () => string | undefined;
  /** Native file picker; undefined when cancelled. */
  readonly pickFile: (kind: ReplacePick) => Promise<string | undefined>;
  /** `shell.openPath`: resolves to an error message, '' on success. */
  readonly openPath: (file: string) => Promise<string>;
  /** Length + audio stream of a picked recording (ffmpeg of the settings). */
  readonly probe: AudioProbe;
  readonly hasWhisperModel: (model: WhisperModelId) => boolean;
  readonly mic: MicPermissionGate;
  /** Autocommit of `paths` in a project (shot locks). */
  readonly commit: (dir: string, message: string, paths: readonly string[]) => Promise<void>;
  /**
   * Taste learning (PLAN.md#12.13): a lock approves shots as they are, a rebuild sends them back;
   * the profile owner ignores both while learning is off.
   */
  readonly taste?: {
    recordShots(dir: string, shotIds: readonly string[], kind: 'lock' | 'rebuild'): Promise<void>;
  };
  readonly log: Logger;
  readonly now?: () => Date;
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

async function importVoiceover(options: StagesHandlerOptions): Promise<StageCommandResult> {
  if (options.currentProject() === undefined) {
    return { status: 'error', message: 'No project is open.' };
  }
  const file = await options.pickFile('voiceover');
  if (file === undefined) return cancelled;
  const checked = await checkImport(file, options.probe);
  if (!checked.ok) return { status: 'error', message: checked.error };
  return options.service.enqueue([{ stage: 'voiceover', source: file }]);
}

async function saveTake(
  options: StagesHandlerOptions,
  wav: Uint8Array,
): Promise<StageCommandResult> {
  const dir = options.currentProject();
  if (dir === undefined) return { status: 'error', message: 'No project is open.' };
  const valid = validateRecordingWav(wav);
  if (!valid.ok) return { status: 'error', message: valid.error };
  let file: string;
  try {
    file = await saveRecording(dir, wav, options.now?.() ?? new Date());
  } catch (error) {
    options.log.warn(`recording not saved: ${describeError(error)}`);
    return {
      status: 'error',
      message: `The recording could not be saved: ${describeError(error)}`,
    };
  }
  options.log.info(`saved a ${valid.value.durationS.toFixed(1)} s take: ${file}`);
  return options.service.enqueue([{ stage: 'voiceover', source: file }]);
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
      if (request.stage === 'voiceover') return importVoiceover(options);
      const file = await options.pickFile(request.stage);
      if (file === undefined) return cancelled;
      return documents.importScript(file);
    },
    stagesOpen: (request) => openArtifact(options, request.artifact),
    briefGet: () => documents.brief(),
    briefSave: (request) => documents.saveBrief(request),
    scriptGet: () => documents.script(),
    scriptSave: (request) => documents.saveScript(request.text),
    scriptApprove: () => documents.approve(),
    voiceoverImport: () => importVoiceover(options),
    voiceoverRecording: (request) => saveTake(options, request.wav),
    micArm: () => {
      options.mic.arm();
      return Promise.resolve(true);
    },
    stagesReports: () => readStageReports(options.currentProject()),
    wordsRetry: (request) => {
      if (!options.hasWhisperModel(request.model)) {
        return Promise.resolve({
          status: 'error',
          message: `The ${request.model} model is not installed: download it in Settings → Tools first.`,
        });
      }
      return service.enqueue([{ stage: 'words', model: request.model }]);
    },
    scenesRun: async (request) => {
      const dir = options.currentProject();
      // Rebuilding chosen shots says the current scenes missed (read before they are replaced).
      if (dir !== undefined && request.action === 'build' && request.shots !== null) {
        await options.taste?.recordShots(dir, request.shots, 'rebuild');
      }
      // A world film's look assets (and a Grim Ink film's people and places) are one set for the
      // whole film: never per shot.
      const wholeFilm = request.action === 'world-assets' || request.action === 'c-cam-modules';
      const shots = wholeFilm ? null : request.shots;
      return service.enqueue([
        {
          stage: 'scenes',
          ...(request.action === 'build' ? {} : { action: request.action }),
          ...(shots === null ? {} : { shots }),
        },
      ]);
    },
    shotsLock: async (request) => {
      const dir = options.currentProject();
      const result = await lockShots({
        dir,
        shotIds: request.shotIds,
        locked: request.locked,
        now: options.now?.() ?? new Date(),
        commit: options.commit,
      });
      if (dir !== undefined && request.locked && result.status === 'ok') {
        await options.taste?.recordShots(dir, request.shotIds, 'lock');
      }
      return result;
    },
  };
}
