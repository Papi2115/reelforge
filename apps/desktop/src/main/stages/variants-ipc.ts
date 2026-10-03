/**
 * IPC handlers of shot variants (PLAN.md#11.3), merged into `registerIpc` by main.ts. Generating,
 * picking and dropping variants are Scenes built runs on the StageService queue (Stop, the usage
 * limit pause and the usage booking work like for any scene run). On the first read of a project
 * in this app session, variants a closed app left `building` are settled (dropped as interrupted).
 */
import type { AppSettings } from '@reelforge/shared';
import { settleInterruptedVariants, type FrameRenderer } from '@reelforge/stages';
import type { InvokeHandlers } from '../ipc-router.js';
import { describeError, type Logger } from '../logger.js';
import {
  readVariantsState,
  variantEstimate,
  variantManifest,
  variantRequest,
} from './shot-variants.js';
import type { StageService } from './stage-service.js';
import { appStageSettings } from './stage-runtime.js';
import { VariantClips } from './variant-clips.js';

export type VariantsHandlers = Pick<
  InvokeHandlers,
  'variantsState' | 'variantsEstimate' | 'variantsRun' | 'variantsClip' | 'variantsManifest'
>;

export interface VariantsHandlerOptions {
  readonly service: Pick<StageService, 'enqueue' | 'isBusyWith'>;
  readonly currentProject: () => string | undefined;
  readonly settings: () => AppSettings;
  /** Claude turns allowed at once now (the app's LimitGuard). */
  readonly claudeConcurrency: () => number;
  readonly frames: FrameRenderer;
  readonly log: Logger;
  readonly now?: () => Date;
}

export function variantsHandlers(options: VariantsHandlerOptions): VariantsHandlers {
  const clips = new VariantClips(options.frames);
  const settled = new Set<string>();
  const settle = async (dir: string): Promise<void> => {
    if (settled.has(dir) || options.service.isBusyWith(dir, 'scenes')) return;
    settled.add(dir);
    const result = await settleInterruptedVariants(dir, options.now?.() ?? new Date());
    if (!result.ok) options.log.warn(`variants not settled: ${result.error.message}`);
    else if (result.value.length > 0) {
      options.log.info(`interrupted variants settled: ${result.value.join(', ')}`);
    }
  };
  return {
    variantsState: async () => {
      const dir = options.currentProject();
      if (dir !== undefined) await settle(dir);
      try {
        return await readVariantsState(dir);
      } catch (error) {
        options.log.warn(`variants not read: ${describeError(error)}`);
        return { projectDir: dir ?? null, sets: [] };
      }
    },
    variantsEstimate: (request) =>
      variantEstimate(
        options.currentProject(),
        request.count,
        appStageSettings(options.settings()),
        options.claudeConcurrency(),
      ),
    variantsRun: (request) => options.service.enqueue([variantRequest(request.shotId, request.op)]),
    variantsClip: async (request) => {
      const dir = options.currentProject();
      if (dir === undefined) return { status: 'error', message: 'No project is open.' };
      return clips.clip(dir, request.shotId, request.key);
    },
    variantsManifest: (request) =>
      variantManifest(options.currentProject(), request.shotId, request.key),
  };
}
