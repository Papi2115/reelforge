/**
 * `<app data>/settings.json` (PLAN.md#6.7): app-wide settings of the desktop app. Every field has a
 * default, so a partial or older file still parses; `migrateAppSettings` upgrades older versions.
 * Values mirror other packages (bridge model aliases/stages, pipeline whisper models, engine
 * default style); tests in apps/desktop keep them in sync.
 */
import { z } from 'zod';
import { characterModeSchema, mascotChoiceSchema } from './characters.js';
import { videoLanguageSchema } from './project.js';
import { shotsPerMinuteSchema } from './scene-count.js';
import { stylePresetIdSchema } from './style-preset.js';
import { tasteLearningSchema } from './taste-profile.js';

export const APP_SETTINGS_VERSION = 1;

/** Claude model aliases the app offers (= `MODEL_ALIASES` of the claude-bridge). */
export const SETTINGS_MODEL_ALIASES = ['opus', 'sonnet', 'haiku'] as const;
export const settingsModelSchema = z.enum(SETTINGS_MODEL_ALIASES);
export type SettingsModel = z.infer<typeof settingsModelSchema>;

/** Pipeline stages with their own model (bridge stages without `chat`, PLAN.md §2.2). */
export const SETTINGS_STAGES = [
  'research',
  'script',
  'storyboard',
  'scene-build',
  'scene-fix',
  'critic',
  'sound-cues',
] as const;
export type SettingsStage = (typeof SETTINGS_STAGES)[number];

/** PLAN.md §2.2: Sonnet for words, Opus for scene code, Haiku for the frame critic. */
export const DEFAULT_SETTINGS_STAGE_MODELS: Readonly<Record<SettingsStage, SettingsModel>> = {
  research: 'sonnet',
  script: 'sonnet',
  storyboard: 'sonnet',
  'scene-build': 'opus',
  'scene-fix': 'opus',
  critic: 'haiku',
  'sound-cues': 'sonnet',
};

/** Video encoder preference; `auto` probes NVENC/QSV/AMF first, `cpu` = libx264. */
export const ENCODER_PREFERENCES = ['auto', 'nvenc', 'qsv', 'amf', 'cpu'] as const;
export type EncoderPreference = (typeof ENCODER_PREFERENCES)[number];

/** Which GPU Chromium (preview + frame renders) should use on multi-GPU machines. */
export const GPU_PREFERENCES = ['auto', 'high-performance', 'low-power'] as const;
export type GpuPreference = (typeof GPU_PREFERENCES)[number];

/** ggml models the whisper manager can download (= `WHISPER_MODEL_IDS` of the pipeline). */
export const SETTINGS_WHISPER_MODELS = ['large-v3-turbo-q5_0', 'small', 'medium', 'base'] as const;
export const settingsWhisperModelSchema = z.enum(SETTINGS_WHISPER_MODELS);
export type SettingsWhisperModel = z.infer<typeof settingsWhisperModelSchema>;

/** Built-in style new projects start with (= the engine's `DEFAULT_STYLE_ID`). */
export const SETTINGS_DEFAULT_STYLE = 'voxel-pixel-crisp640';

export const MAX_EXPORT_WORKERS = 64;

/** Export presets (= `EXPORT_PRESET_IDS` of the pipeline). */
export const EXPORT_PRESET_CHOICES = ['1080p30', '1440p', '4k'] as const;
export type ExportPresetChoice = (typeof EXPORT_PRESET_CHOICES)[number];
/** Quality profiles of the export dialog: Draft (fast) / Standard / High. */
export const EXPORT_QUALITY_PROFILES = ['draft', 'standard', 'high'] as const;
export type ExportQualityProfile = (typeof EXPORT_QUALITY_PROFILES)[number];
export const MAX_SOFT_BUDGET_USD = 100_000;

const stageModelsSchema = z.object({
  research: settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS.research),
  script: settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS.script),
  storyboard: settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS.storyboard),
  'scene-build': settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS['scene-build']),
  'scene-fix': settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS['scene-fix']),
  critic: settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS.critic),
  'sound-cues': settingsModelSchema.default(DEFAULT_SETTINGS_STAGE_MODELS['sound-cues']),
});

const exportWorkersSchema = z.union([z.literal('auto'), z.int().min(1).max(MAX_EXPORT_WORKERS)]);
const softBudgetSchema = z.number().positive().max(MAX_SOFT_BUDGET_USD).nullable();
const toolPathSchema = z.string().min(1).max(1_000).nullable();

export const appSettingsSchema = z.object({
  version: z.literal(APP_SETTINGS_VERSION),
  /** Default video language of new projects (CLAUDE.md §8: EN, PL supported). */
  language: videoLanguageSchema.default('en'),
  /** Style preset new projects start with. */
  defaultStyle: stylePresetIdSchema.default(SETTINGS_DEFAULT_STYLE),
  /** The app has one theme. */
  theme: z.literal('dark').default('dark'),
  models: stageModelsSchema.prefault({}),
  /** Edit chat: `model` by default, `boostModel` behind the "harder fix" toggle (PLAN.md §2.2). */
  chat: z
    .object({
      model: settingsModelSchema.default('sonnet'),
      boostModel: settingsModelSchema.default('opus'),
    })
    .prefault({}),
  /** Economy mode: every stage on Sonnet, short turns, one QA iteration. */
  economy: z.boolean().default(false),
  /** Soft per-project budget (CLI list-price estimate, a relative meter); null = none. */
  usage: z.object({ softBudgetUsd: softBudgetSchema.default(null) }).prefault({}),
  performance: z
    .object({
      /** Parallel export render workers; `auto` = max(1, cores / 2). */
      exportWorkers: exportWorkersSchema.default('auto'),
      encoder: z.enum(ENCODER_PREFERENCES).default('auto'),
      gpu: z.enum(GPU_PREFERENCES).default('auto'),
    })
    .prefault({}),
  tools: z
    .object({
      /** ffmpeg binary or folder chosen by the user; null = auto-detect. */
      ffmpegPath: toolPathSchema.default(null),
      /** whisper-cli binary or folder chosen by the user; null = app-managed / auto-detect. */
      whisperPath: toolPathSchema.default(null),
      /** Model used for "Words timed". */
      whisperModel: settingsWhisperModelSchema.default('large-v3-turbo-q5_0'),
    })
    .prefault({}),
  /**
   * Characters and mascot new projects start with (PLAN.md#12.20), so a channel mascot carries
   * over from project to project; each project keeps its own choice afterwards. Scenes per
   * minute and faster checks (ADR-027): what the New project form starts with (null = no range).
   */
  newProjectDefaults: z
    .object({
      characters: characterModeSchema.default('pack'),
      mascot: mascotChoiceSchema.default('none'),
      shotsPerMinute: shotsPerMinuteSchema.nullable().default(null),
      fasterChecks: z.boolean().default(false),
    })
    .prefault({}),
  /** Sound design: generated background music per act (the sound-cues stage). */
  music: z.object({ enabled: z.boolean().default(true) }).prefault({}),
  /** Scenes built: the quiet final review after a whole-film build (PLAN.md#11.5). */
  scenes: z.object({ finalReview: z.boolean().default(true) }).prefault({}),
  /**
   * Global asset library (PLAN.md#12.19): what is saved to it automatically. Downloaded assets
   * the user approved (or with a verified licence) by default; own imports only when asked.
   */
  assetLibrary: z
    .object({
      saveDownloaded: z.boolean().default(true),
      saveOwn: z.boolean().default(false),
    })
    .prefault({}),
  /**
   * Taste learning (PLAN.md#12.13): a file without the field (an install from before 2.3) reads
   * as `off`; a new install starts with `auto` (`defaultAppSettings`).
   */
  taste: z.object({ learning: tasteLearningSchema.default('off') }).prefault({}),
  /** Last choices of the export dialog (PLAN.md#9.1); encoder and workers live in `performance`. */
  export: z
    .object({
      preset: z.enum(EXPORT_PRESET_CHOICES).default('1080p30'),
      quality: z.enum(EXPORT_QUALITY_PROFILES).default('standard'),
      includeChapters: z.boolean().default(true),
      includeThumbnail: z.boolean().default(true),
      /** Folder of the MP4 chosen with main's folder picker; null = `<project>/out`. */
      outputDir: toolPathSchema.default(null),
    })
    .prefault({}),
  /**
   * Experimental features (PLAN.md#13.6): `worlds` offers the worlds not shipped yet (Sketchbook
   * preview) to new projects, the stages (`StageSettings.experimentalWorlds`) and the `reelforge`
   * CLI of Claude's turns (`REELFORGE_EXPERIMENTAL_WORLDS`). Off by default.
   */
  experimental: z.object({ worlds: z.boolean().default(false) }).prefault({}),
  /**
   * Look of the app itself (PLAN.md#13.12, U13): `pixelTitles` sets section and dialog titles in
   * the pixel face made from the engine's display font; off = system text everywhere.
   */
  ui: z.object({ pixelTitles: z.boolean().default(true) }).prefault({}),
  onboarding: z
    .object({
      /** The first-run "Connect Claude" gate was completed or skipped. */
      connectClaudeDone: z.boolean().default(false),
      /** The Welcome screen after the gate (example / brief / open) was answered (PLAN.md#10.3). */
      welcomeDone: z.boolean().optional(),
      /** The guided tour of the workspace was dismissed with "Don't show again". */
      tourDone: z.boolean().optional(),
    })
    // Profiles that passed the gate before the Welcome screen and the tour existed are not
    // onboarded again: both default to the gate's state.
    .transform((onboarding) => ({
      connectClaudeDone: onboarding.connectClaudeDone,
      welcomeDone: onboarding.welcomeDone ?? onboarding.connectClaudeDone,
      tourDone: onboarding.tourDone ?? onboarding.connectClaudeDone,
    }))
    .prefault({}),
});
export type AppSettings = z.output<typeof appSettingsSchema>;

/** Settings of a new install (no settings file yet): taste learning on. */
export function defaultAppSettings(): AppSettings {
  return appSettingsSchema.parse({ version: APP_SETTINGS_VERSION, taste: { learning: 'auto' } });
}

/**
 * What the renderer may change. Tool paths are absent on purpose: main sets them only from its own
 * file picker (a renderer-supplied path would become an executable main spawns).
 */
export const appSettingsPatchSchema = z.strictObject({
  language: videoLanguageSchema.optional(),
  defaultStyle: stylePresetIdSchema.optional(),
  // Plain (default-free) fields: a patch must not fill in defaults over the user's other choices.
  models: z
    .strictObject({
      research: settingsModelSchema,
      script: settingsModelSchema,
      storyboard: settingsModelSchema,
      'scene-build': settingsModelSchema,
      'scene-fix': settingsModelSchema,
      critic: settingsModelSchema,
      'sound-cues': settingsModelSchema,
    })
    .partial()
    .optional(),
  chat: z
    .strictObject({ model: settingsModelSchema, boostModel: settingsModelSchema })
    .partial()
    .optional(),
  economy: z.boolean().optional(),
  usage: z.strictObject({ softBudgetUsd: softBudgetSchema }).partial().optional(),
  performance: z
    .strictObject({
      exportWorkers: exportWorkersSchema,
      encoder: z.enum(ENCODER_PREFERENCES),
      gpu: z.enum(GPU_PREFERENCES),
    })
    .partial()
    .optional(),
  tools: z.strictObject({ whisperModel: settingsWhisperModelSchema }).partial().optional(),
  newProjectDefaults: z
    .strictObject({
      characters: characterModeSchema,
      mascot: mascotChoiceSchema,
      shotsPerMinute: shotsPerMinuteSchema.nullable(),
      fasterChecks: z.boolean(),
    })
    .partial()
    .optional(),
  music: z.strictObject({ enabled: z.boolean() }).partial().optional(),
  scenes: z.strictObject({ finalReview: z.boolean() }).partial().optional(),
  assetLibrary: z
    .strictObject({ saveDownloaded: z.boolean(), saveOwn: z.boolean() })
    .partial()
    .optional(),
  taste: z.strictObject({ learning: tasteLearningSchema }).partial().optional(),
  // The output folder is absent on purpose: main sets it only from its own folder picker.
  export: z
    .strictObject({
      preset: z.enum(EXPORT_PRESET_CHOICES),
      quality: z.enum(EXPORT_QUALITY_PROFILES),
      includeChapters: z.boolean(),
      includeThumbnail: z.boolean(),
    })
    .partial()
    .optional(),
  experimental: z.strictObject({ worlds: z.boolean() }).partial().optional(),
  ui: z.strictObject({ pixelTitles: z.boolean() }).partial().optional(),
  onboarding: z
    .strictObject({
      connectClaudeDone: z.boolean(),
      welcomeDone: z.boolean(),
      tourDone: z.boolean(),
    })
    .partial()
    .optional(),
});
export type AppSettingsPatch = z.infer<typeof appSettingsPatchSchema>;

/** Merges a patch (one level deep) and re-validates the result. */
export function applyAppSettingsPatch(settings: AppSettings, patch: AppSettingsPatch): AppSettings {
  return appSettingsSchema.parse({
    ...settings,
    ...(patch.language === undefined ? {} : { language: patch.language }),
    ...(patch.defaultStyle === undefined ? {} : { defaultStyle: patch.defaultStyle }),
    ...(patch.economy === undefined ? {} : { economy: patch.economy }),
    models: { ...settings.models, ...patch.models },
    chat: { ...settings.chat, ...patch.chat },
    usage: { ...settings.usage, ...patch.usage },
    performance: { ...settings.performance, ...patch.performance },
    tools: { ...settings.tools, ...patch.tools },
    newProjectDefaults: { ...settings.newProjectDefaults, ...patch.newProjectDefaults },
    music: { ...settings.music, ...patch.music },
    scenes: { ...settings.scenes, ...patch.scenes },
    assetLibrary: { ...settings.assetLibrary, ...patch.assetLibrary },
    taste: { ...settings.taste, ...patch.taste },
    export: { ...settings.export, ...patch.export },
    experimental: { ...settings.experimental, ...patch.experimental },
    ui: { ...settings.ui, ...patch.ui },
    onboarding: { ...settings.onboarding, ...patch.onboarding },
  });
}

export type AppSettingsMigration =
  | { readonly ok: true; readonly settings: AppSettings; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly reason: 'corrupt' | 'newer-version'; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Raw JSON -> current settings. Version 0 = a file without `version` (hand-written, or written
 * before the field existed): read as v1. Newer versions are refused (written by a newer app).
 */
export function migrateAppSettings(raw: unknown): AppSettingsMigration {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'corrupt', message: 'settings are not a JSON object' };
  }
  const version = raw['version'] ?? 0;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return {
      ok: false,
      reason: 'corrupt',
      message: `invalid settings version ${JSON.stringify(version)}`,
    };
  }
  if (version > APP_SETTINGS_VERSION) {
    return {
      ok: false,
      reason: 'newer-version',
      message: `settings version ${String(version)} is newer than this app (${String(APP_SETTINGS_VERSION)})`,
    };
  }
  const parsed = appSettingsSchema.safeParse({ ...raw, version: APP_SETTINGS_VERSION });
  if (!parsed.success) {
    return { ok: false, reason: 'corrupt', message: z.prettifyError(parsed.error) };
  }
  return {
    ok: true,
    settings: parsed.data,
    migratedFrom: version === APP_SETTINGS_VERSION ? null : version,
  };
}
