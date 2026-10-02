/**
 * What the stages take from the app settings (PLAN.md §2.2, #6.7): Economy mode, model per stage,
 * the audio clean preset and the whisper model. Injected into the runner (a value or a getter, so
 * a settings change applies to the next stage run without rebuilding anything).
 */
import type { CleanPreset, WhisperModelId } from '@reelforge/pipeline';
import type { AppSettings, SettingsModel, SettingsStage } from '@reelforge/shared';

export interface CleanSettings {
  readonly preset: CleanPreset;
  /** VO stem loudness target (pipeline default -16 LUFS). */
  readonly targetLufs?: number | undefined;
  /** Shorten long pauses; words are then timed on the cleaned audio (spike 03). */
  readonly shortenSilence?: { readonly maxPauseS: number } | undefined;
  /** rnnoise model for the heavy preset. */
  readonly arnndnModelPath?: string | undefined;
}

export interface WhisperSettings {
  readonly model: WhisperModelId;
  /** Tried last when the result stays poor (only if installed); null = never. */
  readonly fallbackModel: WhisperModelId | null;
  /** Below this script coverage the words stage retries (spike 03: 0.85). */
  readonly minCoverage: number;
  readonly threads?: number | undefined;
}

/** Scene building and review (PLAN.md §4.4, #7.4-7.7). */
export interface SceneSettings {
  /** Shots built at once (also capped by the LimitGuard's concurrency, halved after a limit). */
  readonly concurrency: number;
  /** Fix turns per shot after the build turn (PLAN.md §4.4: ≤ 2). */
  readonly maxFixIterations: number;
  /** Run the Haiku critic on the smoke frames (code checks always run). */
  readonly critic: boolean;
  /** Phone legibility: smallest integer text scale and glyph height (px at 640 wide). */
  readonly minTextScale: number;
  readonly minGlyphPx: number;
}

export interface StageSettings {
  /** Economy mode: every stage on Sonnet, short turns, deterministic sound cues. */
  readonly economy: boolean;
  /** Model per bridge stage (app settings); Economy wins over it. */
  readonly models: Partial<Record<SettingsStage, SettingsModel>>;
  readonly clean: CleanSettings;
  readonly whisper: WhisperSettings;
  /** Allowed |mix loudness - target| (PLAN.md#8.3: ±1 LU). */
  readonly mixToleranceLu: number;
  /** Keep the replaced recording as `audio/vo.original.prev.<ext>`. */
  readonly archivePreviousVoiceover: boolean;
  readonly scenes: SceneSettings;
}

export const DEFAULT_SCENE_SETTINGS: SceneSettings = {
  concurrency: 2,
  maxFixIterations: 2,
  critic: true,
  minTextScale: 2,
  minGlyphPx: 14,
};

export const MIN_WORDS_COVERAGE = 0.85;

/** The turbo model's alternative is `small` (spike 03 CPU fallback); the others go to turbo. */
export function defaultFallbackModel(model: WhisperModelId): WhisperModelId {
  return model === 'large-v3-turbo-q5_0' ? 'small' : 'large-v3-turbo-q5_0';
}

export const DEFAULT_STAGE_SETTINGS: StageSettings = {
  economy: false,
  models: {},
  clean: { preset: 'standard' },
  whisper: {
    model: 'large-v3-turbo-q5_0',
    fallbackModel: 'small',
    minCoverage: MIN_WORDS_COVERAGE,
  },
  mixToleranceLu: 1,
  archivePreviousVoiceover: true,
  scenes: DEFAULT_SCENE_SETTINGS,
};

/** Stage settings from the desktop app settings (`settings.json`). */
export function stageSettingsFromApp(app: AppSettings): StageSettings {
  const model = app.tools.whisperModel;
  return {
    ...DEFAULT_STAGE_SETTINGS,
    economy: app.economy,
    models: app.models,
    whisper: {
      ...DEFAULT_STAGE_SETTINGS.whisper,
      model,
      fallbackModel: defaultFallbackModel(model),
    },
  };
}
