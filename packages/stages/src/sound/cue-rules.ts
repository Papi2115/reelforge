/**
 * The sound director's rule table (data, not code): which built-in recipe and variants each kind of
 * on-screen / spoken event gets, how loud it sits under the voice, how far it leads the event and
 * how important it is when cues crowd each other. `cue-events.ts` finds the events, the director
 * (`cue-director.ts`) applies these rules. Documented in docs/sfx.md ("How cues are chosen").
 */
import { SFX_CATEGORY, type SfxCategory, type SfxRecipe } from '@reelforge/pipeline';

export const CUE_EVENT_KINDS = [
  /** Hard cut between shots: moving into a UI-like shot = swoosh, into a 3D scene = whoosh. */
  'transition-cut',
  'transition-crossfade',
  'transition-glitch',
  'transition-wipe',
  /** An object pops into view (scene `pop`/`bubble`/`blip`, or an anchor without a sound). */
  'appear',
  /** One item of a list reveal (several scene pops close together): rising pop series. */
  'list-item',
  /** One step of a counter roll (tick / tock alternating). */
  'counter-step',
  /** The counter lands. */
  'counter-final',
  /** A spoken number or key fact. */
  'number',
  /** A number the scene highlights visually (anchor on it) in a title / chart / counter shot. */
  'number-big',
  /** A text card or kinetic text comes in. */
  'text-in',
  /** Text typed on screen (scene `typewriter`). */
  'text-typed',
  /** Build-up into an emphasised word (ends where the hit lands). */
  'emphasis-riser',
  'emphasis-hit',
  /** The closing card. */
  'end-card',
  /** Any other sound a scene scheduled with `ctx.sfx.at` (its own recipe). */
  'scene',
] as const;
export type CueEventKind = (typeof CUE_EVENT_KINDS)[number];

export interface RecipeChoice {
  readonly recipe: SfxRecipe;
  /** Allowed variant names (docs/sfx.md); empty = all of the recipe's variants. */
  readonly variants: readonly string[];
}

export interface CueRule {
  /**
   * Recipes in order of preference; the event picks one (by its `choice`, else the first).
   * `event` = the recipe the scene asked for.
   */
  readonly choices: readonly RecipeChoice[] | 'event';
  /** dB on top of the category level (`CATEGORY_GAIN_DB`). */
  readonly trimDb: number;
  /** The cue starts this long before the event (s), e.g. a whoosh peaking on the cut. */
  readonly leadS: number;
  /**
   * Lower = kept first when cues crowd each other: 0 what the scenes asked for and the end card,
   * 1 non-cut transitions, 2 numbers, 3 text cards / repeats / anchors, 4 emphasis, 5 cuts.
   */
  readonly priority: number;
  /** Recipe length override (s); undefined = the recipe's default. */
  readonly durationS?: number | undefined;
  /** Transitions may sit in the first 0.3 s of a shot; nothing else may. */
  readonly transition?: boolean | undefined;
}

/**
 * Level of each category under the voice-over (dB, relative to the recipe's own reference level,
 * docs/sfx.md "Level"). Motion and tonal sounds are long and smeared, so they sit lowest.
 */
export const CATEGORY_GAIN_DB: Readonly<Record<SfxCategory, number>> = {
  motion: -10,
  impact: -7,
  texture: -8,
  ui: -9,
  tonal: -11,
};

const choice = (recipe: SfxRecipe, ...variants: string[]): RecipeChoice => ({ recipe, variants });

/**
 * Bass-heavy variants the director never picks on its own (the music and SFX stay light; a scene
 * or Claude may still ask for them with an explicit seed in cues.json).
 */
export const HEAVY_VARIANTS: Readonly<Partial<Record<SfxRecipe, readonly string[]>>> = {
  hit: ['deep', 'cinematic'],
  boom: ['deep', 'explosion'],
  'whoosh-impact': ['heavy'],
  stamp: ['heavy'],
};

/** `pop` variants from low to high pitch (spectral centroid, tested): list items rise. */
export const LIST_PITCH_ORDER = ['low', 'cork', 'pluck', 'mouth'] as const;

export const CUE_RULES: Readonly<Record<CueEventKind, CueRule>> = {
  'transition-cut': {
    // choice 0: into a UI-like shot (title, text, chart, counter, UI); 1: into a 3D scene.
    choices: [choice('swoosh-in', 'soft'), choice('whoosh', 'fast', 'up', 'down')],
    trimDb: -6,
    leadS: 0.25,
    priority: 5,
    transition: true,
  },
  'transition-crossfade': {
    choices: [choice('whoosh', 'air', 'slow')],
    trimDb: -4,
    leadS: 0.3,
    priority: 1,
    transition: true,
  },
  'transition-glitch': {
    choices: [choice('glitch', 'digital', 'stutter', 'corrupt')],
    trimDb: -3,
    leadS: 0,
    priority: 1,
    transition: true,
  },
  'transition-wipe': {
    choices: [choice('swoosh-in', 'soft', 'bright')],
    trimDb: -3,
    leadS: 0.05,
    priority: 1,
    transition: true,
  },
  appear: {
    choices: [
      choice('pop', 'cork', 'mouth', 'pluck'),
      choice('bubble', 'single', 'small'),
      choice('blip', 'square', 'triangle'),
    ],
    trimDb: -3,
    leadS: 0,
    priority: 3,
  },
  'list-item': {
    choices: [choice('pop', ...LIST_PITCH_ORDER)],
    trimDb: -3,
    leadS: 0,
    priority: 0,
  },
  'counter-step': {
    choices: [choice('tick', 'clock', 'fine'), choice('tock', 'wood', 'block')],
    trimDb: -8,
    leadS: 0,
    priority: 0,
  },
  'counter-final': {
    choices: [choice('ding', 'bell', 'soft'), choice('hit', 'punchy', 'tight')],
    trimDb: -1,
    leadS: 0,
    priority: 0,
  },
  number: {
    choices: [choice('hit-soft', 'felt', 'muted')],
    trimDb: -1,
    leadS: 0,
    priority: 2,
  },
  'number-big': {
    // whoosh-impact lands ~0.25 s after its start.
    choices: [choice('whoosh-impact', 'snappy', 'classic')],
    trimDb: -4,
    leadS: 0.25,
    priority: 2,
  },
  'text-in': {
    choices: [choice('swoosh-in', 'soft', 'tick')],
    trimDb: -5,
    leadS: 0,
    priority: 3,
  },
  'text-typed': {
    choices: [choice('typewriter', 'typewriter', 'laptop')],
    trimDb: -6,
    leadS: 0,
    priority: 0,
  },
  'emphasis-riser': {
    choices: [choice('riser', 'noise', 'tonal')],
    trimDb: -9,
    leadS: 0,
    priority: 4,
  },
  'emphasis-hit': {
    choices: [choice('hit-soft', 'felt', 'muted')],
    trimDb: -2,
    leadS: 0,
    priority: 4,
  },
  'end-card': {
    choices: [choice('chime', 'up'), choice('success', 'chord')],
    trimDb: -2,
    leadS: 0,
    priority: 0,
  },
  scene: {
    choices: 'event',
    trimDb: 0,
    leadS: 0,
    priority: 0,
  },
};

/** Density control (docs/sfx.md). */
export const DENSITY = {
  /** Two cues of different gestures never start closer than this (s). */
  minCueGapS: 0.15,
  /** Two gestures (a cue or a designed series) never start closer than this (s). */
  minGestureGapS: 0.8,
  /** No cue in the first part of a shot, except transitions (s). */
  shotHeadS: 0.3,
  /**
   * A scene's cue that falls into the head is moved to its end when that is at most this late
   * (the anchor sync tolerance), otherwise dropped.
   */
  headNudgeS: 0.15,
  /** On average about one gesture per this many seconds (budget = duration / this + 1). */
  secondsPerGesture: 3,
  /** A scene's repeated sound (same recipe again in the same shot) has this priority. */
  repeatPriority: 3,
  /** At most `maxPerWindow` gestures start within any `windowS` seconds. */
  windowS: 4,
  maxPerWindow: 3,
} as const;

/** Category of a recipe and the gain a rule gives it (dB). */
export function ruleGainDb(rule: CueRule, recipe: SfxRecipe): number {
  return CATEGORY_GAIN_DB[SFX_CATEGORY[recipe]] + rule.trimDb;
}
