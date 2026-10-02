/**
 * Typed accessors that turn the app settings (PLAN.md#6.7) into the options of their consumers:
 * the claude-bridge (models per stage, Economy, budgets), the prompt model helper of
 * `@reelforge/prompts` (same `{ economy, models }` shape), the video export (workers, encoder,
 * GPU) and the ffmpeg / whisper.cpp locators. Pure functions; the services call them on every use
 * so a changed setting applies to the next turn / export without a restart.
 */
import {
  DEFAULT_STAGE_MODELS,
  ECONOMY_MODEL,
  type ModelAlias,
  type SessionManagerOptions,
  type Stage,
  type UsageBudget,
} from '@reelforge/claude-bridge';
import type {
  DetectEncoderOptions,
  ExportVideoOptions,
  LocateOptions,
  WhisperManagerOptions,
  WhisperModelId,
} from '@reelforge/pipeline';
import {
  SETTINGS_STAGES,
  type AppSettings,
  type EncoderPreference,
  type GpuPreference,
} from '@reelforge/shared';

/** Fed to `new SessionManager({ ...bridgeModelOptions(settings) })` and to `promptModel()`. */
export interface BridgeModelOptions {
  readonly economy: boolean;
  readonly models: Readonly<Record<Stage, ModelAlias>>;
}

export function bridgeModelOptions(
  settings: AppSettings,
): BridgeModelOptions & Pick<SessionManagerOptions, 'economy' | 'models'> {
  const models: Record<Stage, ModelAlias> = { ...DEFAULT_STAGE_MODELS };
  for (const stage of SETTINGS_STAGES) models[stage] = settings.models[stage];
  models.chat = settings.chat.model;
  return { economy: settings.economy, models };
}

/** Model of one chat turn: the boost model behind the "harder fix" toggle; Economy wins. */
export function chatTurnModel(settings: AppSettings, boost: boolean): ModelAlias {
  if (settings.economy) return ECONOMY_MODEL;
  return boost ? settings.chat.boostModel : settings.chat.model;
}

/** Self-QA iterations per shot (PLAN.md#7.4: retry <= 2; Economy: 1). */
export function qaIterations(settings: AppSettings): number {
  return settings.economy ? 1 : 2;
}

/** `UsageLedgerOptions.budgetFor`: the same soft budget for every project (none when unset). */
export function usageBudgetFor(
  settings: () => AppSettings,
): (projectDir: string) => UsageBudget | undefined {
  return () => {
    const costUsd = settings().usage.softBudgetUsd;
    return costUsd === null ? undefined : { costUsd };
  };
}

const ENCODER_IDS: Readonly<
  Record<EncoderPreference, NonNullable<DetectEncoderOptions['prefer']>>
> = {
  auto: 'auto',
  nvenc: 'h264_nvenc',
  qsv: 'h264_qsv',
  amf: 'h264_amf',
  cpu: 'libx264',
};

/** Chromium switches for the GPU preference (Electron's main process and export renderers). */
export function gpuSwitches(preference: GpuPreference): string[] {
  switch (preference) {
    case 'auto':
      return [];
    case 'high-performance':
      return ['force_high_performance_gpu'];
    case 'low-power':
      return ['force_low_power_gpu'];
  }
}

export interface ExportSettings {
  readonly workers: NonNullable<ExportVideoOptions['workers']>;
  readonly encoder: NonNullable<DetectEncoderOptions['prefer']>;
  /** Extra Chromium command-line flags (`--name`) for headless frame renderers. */
  readonly chromiumArgs: readonly string[];
}

/** `auto` workers = max(1, floor(cores / 2)) (pipeline `defaultWorkerCount`), never above cores. */
export function exportSettings(settings: AppSettings, cores: number): ExportSettings {
  const { exportWorkers, encoder, gpu } = settings.performance;
  const available = Math.max(1, Math.floor(cores));
  const workers =
    exportWorkers === 'auto'
      ? Math.max(1, Math.floor(available / 2))
      : Math.min(exportWorkers, available);
  return {
    workers,
    encoder: ENCODER_IDS[encoder],
    chromiumArgs: gpuSwitches(gpu).map((name) => `--${name}`),
  };
}

export function ffmpegLocateOptions(settings: AppSettings): LocateOptions {
  return { configuredPath: settings.tools.ffmpegPath ?? undefined };
}

/** `base`: app-wide options (test hooks: install root, download mirror). */
export function whisperManagerOptions(
  settings: AppSettings,
  base: WhisperManagerOptions = {},
): WhisperManagerOptions {
  return { ...base, configuredPath: settings.tools.whisperPath ?? undefined };
}

export function whisperModel(settings: AppSettings): WhisperModelId {
  return settings.tools.whisperModel;
}
