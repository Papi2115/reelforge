/**
 * Genre presets (PLAN.md#13.8, ADR-035, docs/genre-presets.md): one choice when a project is
 * created sets its style/world, look mode, rhythm, direction switches and research mode, and
 * carries the script's tone hint and the music/look/transition tendencies. Pure data: applying a
 * preset (genre-preset-apply.ts) writes ordinary project.json fields; the tendencies (script tone,
 * preferred moods and looks, wow pace) are looked up by `project.json#genrePreset` when the stages
 * run (`@reelforge/stages` genre.ts), so a project without a preset is untouched.
 *
 * Every number below is a DEFAULT to be tuned after real films (roadmap 3.3); the table is the
 * only place to change them. Channel Voxplain makes pop-science, tech, finance and crime films, so
 * no preset is the "default" one.
 */
import { z } from 'zod';
import { researchModeSchema } from './assets.js';
import { beatSyncModeSchema } from './beat-sync.js';
import { dramaturgyModeSchema } from './dramaturgy.js';
import { genrePresetIdSchema, lookModeSchema, type ProjectFile } from './project.js';
import { repetitionControlModeSchema } from './repetition.js';
import { SHOT_RANGE_PRESETS, shotsPerMinuteSchema } from './scene-count.js';
import { stylePresetIdSchema } from './style-preset.js';
import { tensionMapModeSchema } from './tension.js';

/**
 * Mood ids of the generative music engine (`@reelforge/pipeline` MUSIC_MOODS; shared does not
 * depend on the pipeline, a `@reelforge/stages` test keeps the two lists equal).
 */
export const GENRE_MUSIC_MOODS = [
  'calm-tech',
  'lofi-chill',
  'tense-investigation',
  'bright-explainer',
  'retro-wave',
] as const;
export type GenreMusicMood = (typeof GENRE_MUSIC_MOODS)[number];

const kebabIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const oneLineSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\r\n]*$/, 'one line');

/** The direction switches a preset sets (project.json fields of the same names). */
export const genreDirectionSchema = z.strictObject({
  tensionMap: tensionMapModeSchema,
  beatSync: beatSyncModeSchema,
  patternInterrupts: dramaturgyModeSchema,
  openLoops: dramaturgyModeSchema,
  revealMoments: dramaturgyModeSchema,
  repetitionControl: repetitionControlModeSchema,
});
export type GenreDirection = z.infer<typeof genreDirectionSchema>;

export const genrePresetSchema = z.strictObject({
  id: genrePresetIdSchema,
  name: oneLineSchema(40),
  /** One plain line for the New project form. */
  description: oneLineSchema(160),
  /**
   * Styles / worlds in order of preference: the first one the app offers wins when the preset is
   * applied (a world that is not wired, or experimental with the switch off, is skipped). None
   * offered = the style is left to the channel / app default.
   */
  styles: z.array(stylePresetIdSchema).min(1).max(8),
  lookMode: lookModeSchema,
  shotsPerMinute: shotsPerMinuteSchema,
  /** Lighter scene QA (ADR-027); absent = the preset leaves it alone. */
  fasterChecks: z.boolean().optional(),
  direction: genreDirectionSchema,
  ambientVariation: z.boolean(),
  researchMode: researchModeSchema,
  /** A world's style turns continuity links on regardless (world-defaults.ts). */
  continuityLinks: z.boolean(),
  /** Appended to the brief's tone in the script prompt (one short line). */
  scriptTone: oneLineSchema(200),
  /** Music moods in order of preference: a hint in the sound-cues prompt (any mood stays valid). */
  musicMoodsPreferred: z.array(z.enum(GENRE_MUSIC_MOODS)).min(1).max(GENRE_MUSIC_MOODS.length),
  /**
   * Looks of the built-in styles to favour in `mixed`: a hint in the storyboard prompt (only the
   * looks the project offers; worlds use their own looks, so they get none).
   */
  preferredLooks: z.array(kebabIdSchema).max(8).optional(),
  /**
   * Multiplier of the wow-transition budget and pace (1 = as without a preset), for the storyboard
   * prompt and validator; clamped to `WOW_SCALE_BOUNDS` (wow-transitions.ts).
   */
  wowTransitionBudget: z.number().min(0).max(3).optional(),
  notes: z.string().max(1_000).optional(),
});
export type GenrePreset = z.infer<typeof genrePresetSchema>;

const ALL_AUTO: GenreDirection = {
  tensionMap: 'auto',
  beatSync: 'auto',
  patternInterrupts: 'auto',
  openLoops: 'auto',
  revealMoments: 'auto',
  repetitionControl: 'auto',
};

/**
 * The built-in presets, in the order the form lists them. DEFAULTS, tuned after real films.
 * Shot ranges reuse the dialog's named ranges: calm 3–5, balanced 5–8, dynamic 8–12 per minute.
 */
const BUILT_IN_GENRE_PRESETS: readonly GenrePreset[] = [
  {
    id: 'true-crime',
    name: 'True crime',
    description: 'Low-key noir voxel, measured pace, open loops and reveals carry the case.',
    styles: ['noir-voxel'],
    lookMode: 'mixed',
    // Measured: time for evidence to land; tension map drives the faster stretches.
    shotsPerMinute: SHOT_RANGE_PRESETS.balanced,
    direction: ALL_AUTO,
    ambientVariation: true,
    researchMode: 'ask',
    // Evidence objects carry over between shots (match cuts).
    continuityLinks: true,
    scriptTone: 'investigative and measured: concrete dates, places and sources; no gore, no hype',
    musicMoodsPreferred: ['tense-investigation', 'calm-tech'],
    // Plans and maps (blueprint), documents and files (retro-ui).
    preferredLooks: ['blueprint', 'retro-ui'],
    // Half the flashy transitions: the story, not the edit, holds attention.
    wowTransitionBudget: 0.5,
  },
  {
    id: 'tech-explainer',
    name: 'Tech explainer',
    description: 'Crisp neon voxel (or the notebook), fast cuts, pattern interrupts on.',
    styles: ['voxel-pixel-crisp640', 'sketchbook'],
    lookMode: 'mixed',
    shotsPerMinute: SHOT_RANGE_PRESETS.dynamic,
    direction: ALL_AUTO,
    ambientVariation: true,
    researchMode: 'ask',
    continuityLinks: false,
    scriptTone: 'clear and energetic: one idea at a time, concrete examples and numbers, no hype',
    musicMoodsPreferred: ['bright-explainer', 'calm-tech', 'retro-wave'],
    preferredLooks: ['blueprint', 'retro-ui', 'flat-2d'],
    wowTransitionBudget: 1.25,
  },
  {
    id: 'history',
    name: 'History',
    description: 'Hand-drawn notebook first, calmer pace, people and dates told as a story.',
    // Comic joins as soon as it is wired; soft voxel when no world is offered.
    styles: ['sketchbook', 'comic', 'soft-480'],
    lookMode: 'mixed',
    shotsPerMinute: SHOT_RANGE_PRESETS.calm,
    // Calmer: no planned pattern interrupts; loops and reveals still shape the story.
    direction: { ...ALL_AUTO, patternInterrupts: 'off' },
    ambientVariation: true,
    researchMode: 'ask',
    // Objects and the timeline carry through the eras.
    continuityLinks: true,
    scriptTone:
      'storytelling in order: people, places and dates by name; vivid but sourced; no anachronisms',
    musicMoodsPreferred: ['lofi-chill', 'calm-tech', 'tense-investigation'],
    preferredLooks: ['paper-cutout', 'diorama', 'whiteboard'],
    wowTransitionBudget: 0.75,
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Crisp voxel or the notebook, steady pace, charts and real numbers.',
    styles: ['voxel-pixel-crisp640', 'sketchbook'],
    lookMode: 'mixed',
    shotsPerMinute: SHOT_RANGE_PRESETS.balanced,
    direction: ALL_AUTO,
    ambientVariation: true,
    researchMode: 'ask',
    continuityLinks: false,
    scriptTone:
      'calm and precise: real figures with dates and sources, charts over adjectives, risks said plainly; no financial advice',
    musicMoodsPreferred: ['calm-tech', 'lofi-chill'],
    // Charts-heavy: flat infographics, blueprint diagrams, retro UI dashboards.
    preferredLooks: ['flat-2d', 'blueprint', 'retro-ui'],
    wowTransitionBudget: 0.75,
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Notebook or voxel with mixed looks, intuition first, then the numbers.',
    styles: ['sketchbook', 'voxel-pixel-crisp640'],
    lookMode: 'mixed',
    shotsPerMinute: SHOT_RANGE_PRESETS.balanced,
    direction: ALL_AUTO,
    ambientVariation: true,
    researchMode: 'ask',
    continuityLinks: false,
    scriptTone:
      'curious and wonder-driven: intuition first, then the numbers; everyday analogies; say what is still unknown',
    musicMoodsPreferred: ['bright-explainer', 'calm-tech', 'lofi-chill'],
    preferredLooks: ['diorama', 'whiteboard', 'blueprint'],
    wowTransitionBudget: 1,
  },
  {
    id: 'pop-culture',
    name: 'Pop culture / gaming',
    description:
      'First-person game world when available, else voxel with retro UI; fast and playful.',
    // Game B2 joins as soon as it is wired; until then crisp voxel with the retro-ui look.
    styles: ['game-b2', 'voxel-pixel-crisp640'],
    lookMode: 'mixed',
    shotsPerMinute: SHOT_RANGE_PRESETS.dynamic,
    direction: ALL_AUTO,
    ambientVariation: true,
    researchMode: 'ask',
    continuityLinks: false,
    scriptTone:
      'playful and fast: references the audience knows, punchy lines, real facts behind the trivia',
    musicMoodsPreferred: ['retro-wave', 'bright-explainer'],
    preferredLooks: ['retro-ui', 'flat-2d'],
    wowTransitionBudget: 1.5,
  },
];

/** The built-in presets (validated once at load: a typo in the table fails every test). */
export const GENRE_PRESETS: readonly GenrePreset[] = Object.freeze(
  BUILT_IN_GENRE_PRESETS.map((preset) => Object.freeze(genrePresetSchema.parse(preset))),
);

export const GENRE_PRESET_IDS: readonly string[] = Object.freeze(
  GENRE_PRESETS.map((preset) => preset.id),
);

/** The built-in preset with this id; undefined for an unknown (or retired) id. */
export function findGenrePreset(
  id: string | null | undefined,
  presets: readonly GenrePreset[] = GENRE_PRESETS,
): GenrePreset | undefined {
  return id === null || id === undefined ? undefined : presets.find((preset) => preset.id === id);
}

/** The script tone hint of the project's preset; undefined without a (known) preset. */
export function genrePresetScriptTone(
  project: Pick<ProjectFile, 'genrePreset'>,
  presets: readonly GenrePreset[] = GENRE_PRESETS,
): string | undefined {
  return findGenrePreset(project.genrePreset, presets)?.scriptTone;
}
