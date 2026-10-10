/**
 * World wording of the stage prompts (PLAN.md#13.6, ADR-029): the texts per world id (= style id)
 * and the prompt variables built from them. The stages pick a world by the project's style and add
 * what comes from the kit and the engine (the world's label, its first look, its page-native
 * transitions); this package stays free of kit and engine imports.
 */
import {
  criticMomentVars,
  sceneMomentVars,
  storyboardContinuityVars,
  storyboardMomentVars,
} from './moment-vars.js';
import { C_CAM_PROMPTS } from './c-cam.js';
import { COMIC_PROMPTS } from './comic.js';
import { GAME_B1_PROMPTS } from './game-b1.js';
import { GAME_B2_PROMPTS } from './game-b2.js';
import { SKETCHBOOK_PROMPTS } from './sketchbook.js';
import type { WorldFilmGrammar, WorldPromptText, WorldTransitionOption } from './types.js';
import { maxNonCutTransitions } from '../validators/rhythm.js';
import {
  maxViewSwitches,
  minGameplayShots,
  minNativeTransitions,
} from '../validators/world-grammar.js';
import type { WorldQuotaOverride } from './variety.js';
import { paceContinuityBudget, type WorldPace } from './pace.js';

export type { WorldMomentOption, WorldPromptText, WorldTransitionOption } from './types.js';
export type { WorldPace } from './pace.js';
export { worldMomentOption } from './moment-vars.js';
export {
  C_CAM_API,
  C_CAM_CAST_TAG,
  C_CAM_MODULE_TOPICS,
  C_CAM_PLACE_TAG,
  C_CAM_SNIPPETS,
  C_CAM_TEXT_METHODS,
  C_CAM_TOPICS,
  type CCamSnippet,
  type CCamTopic,
} from './c-cam-api.js';
export { COMIC_SNIPPETS, type ComicSnippet } from './comic-snippets.js';
export { GAME_B1_SNIPPETS, type GameB1Snippet } from './game-b1-snippets.js';
export { GAME_B2_SNIPPETS, type GameB2Snippet } from './game-b2-snippets.js';
export { SKETCHBOOK_SNIPPETS, type SketchbookSnippet } from './sketchbook-snippets.js';
export {
  breakthroughQuota,
  continuityQuota,
  WORLD_VARIETY_RULES,
  type BreakthroughQuota,
  type WorldQuotaOverride,
  type WorldVarietyRules,
} from './variety.js';

/** Prompt texts per world id. */
export const WORLD_PROMPTS: Readonly<Record<string, WorldPromptText>> = Object.freeze({
  sketchbook: SKETCHBOOK_PROMPTS,
  comic: COMIC_PROMPTS,
  'game-b2': GAME_B2_PROMPTS,
  'game-b1': GAME_B1_PROMPTS,
  // Grim Ink: prompts ready, the world is not wired yet (PLAN.md#14.10, #14.12).
  'c-cam': C_CAM_PROMPTS,
});

/** The prompt texts of a world (undefined for every other style). */
export function worldPromptText(worldId: string | undefined): WorldPromptText | undefined {
  if (worldId === undefined || !Object.hasOwn(WORLD_PROMPTS, worldId)) return undefined;
  return WORLD_PROMPTS[worldId];
}

/** A world as the prompt variables need it: its label (kit `World.label`) and texts. */
export interface PromptWorld {
  readonly label: string;
  readonly text: WorldPromptText;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Durations a storyboard may give a world transition (a warning outside). */
export function worldTransitionRange(option: Pick<WorldTransitionOption, 'duration'>): {
  readonly min: number;
  readonly max: number;
} {
  return { min: round2(option.duration * 0.75), max: round2(option.duration * 1.5) };
}

/**
 * One line per page-native transition in the storyboard prompt; a transition that renders a
 * continuity link (Game B1) names its kind.
 */
export function worldTransitionLine(option: WorldTransitionOption): string {
  const link = option.link === undefined ? '' : `; the \`${option.link}\` link`;
  return `- \`${option.id}\` (${option.type}, about ${String(option.duration)} s${link}): ${option.description}.`;
}

function transitionExample(option: WorldTransitionOption): string {
  return `{ "type": "${option.type}", "duration": ${String(option.duration)}, "style": "${option.id}" }`;
}

/** The film the storyboard plans moments for: its length and a test driver's quota override. */
export interface MomentFilm {
  readonly durationS: number;
  readonly override?: WorldQuotaOverride | undefined;
}

/**
 * The grammar's numbers for a film of `durationS` (B1 rework): appended to the rhythm sentence,
 * and the film's non-cut budget at the grammar's pace (it replaces the look rhythm's
 * `maxTransitions`, which assumes mostly hard cuts).
 */
function grammarVars(
  text: WorldPromptText,
  grammar: WorldFilmGrammar,
  durationS: number,
): Record<string, string> {
  const shots = Math.max(1, Math.round(durationS / 5));
  const rule = `Film grammar (checked): at least ${String(Math.round(grammar.minGameShare * 100))} % of the shots play a game moment, at least ${String(minGameplayShots(grammar, shots))} of them \`${grammar.gameplayMoment}\` (for about ${String(shots)} shots); at most ${String(maxViewSwitches(grammar, durationS))} room <-> screen crossings in the whole film; never ${String(grammar.maxKindRun + 1)} shots of one moment (or plain) in a row; at least ${String(minNativeTransitions(grammar, durationS))} game-native transitions; never both ${grammar.exclusiveBreakthroughs.map((id) => `\`${id}\``).join(' and ')} in one film.`;
  return {
    worldRhythm: `${text.rhythm} ${rule}`,
    maxTransitions: String(maxNonCutTransitions(durationS, grammar.transitionEveryS)),
  };
}

/**
 * The pace's numbers for a film of `durationS` (Comic: pages flow into each other): the sentence
 * that replaces "transitions stay mostly hard cuts", the film's non-cut budget at the pace and the
 * continuity sentence that replaces "rare, about one per 45 s".
 */
function paceVars(pace: WorldPace, durationS: number): Record<string, string> {
  const max = maxNonCutTransitions(durationS, pace.transitionEveryS);
  const links = paceContinuityBudget(durationS, pace.continuityEveryS);
  return {
    worldPace: `Pages flow into each other in this world (checked): up to ${String(max)} non-cut transitions in this film (about one per ${String(pace.transitionEveryS)} s), the rest hard cuts; never the same transition twice in a row; never ${String(pace.dryCutRun)} plain cuts in a row without a page-native transition, a continuity link or a page that flows (say in its intent that the page flows down or across, or "thread: <the thing>" it carries across its panels). ${pace.guide}.`,
    maxTransitions: String(max),
    worldContinuityPace: `Links carry the story in this world: at most ${String(links)} links in this film, about one per ${String(pace.continuityEveryS)} s where the narration follows one thing`,
  };
}

/**
 * Storyboard variables of a world project (with the look variables of `mixed` mode); with
 * `film` also its moment catalog and the film's quota (moment-vars.ts).
 */
export function storyboardWorldVars(
  world: PromptWorld,
  firstLook: string,
  transitions: readonly WorldTransitionOption[],
  film?: MomentFilm,
): Record<string, string> {
  const { text } = world;
  const first = transitions[0];
  return {
    world: world.label,
    worldFilm: text.film,
    worldBrief: text.brief,
    worldRolls: text.rolls,
    worldTensionLooks: text.tensionLooks,
    worldRhythm: text.rhythm,
    worldShared: text.shared,
    worldTransitionIn: text.transitionIn,
    worldCamera: text.camera,
    worldInterrupts: text.interrupts,
    worldMarks: text.marks,
    worldFirstLook: firstLook,
    ...(first === undefined
      ? {}
      : {
          worldTransitions: transitions.map(worldTransitionLine).join('\n'),
          worldTransitionExample: transitionExample(first),
        }),
    ...(film === undefined ? {} : storyboardMomentVars(text, film.durationS, film.override)),
    ...(film === undefined ? {} : storyboardContinuityVars(text, film.durationS)),
    ...(film === undefined || text.grammar === undefined
      ? {}
      : grammarVars(text, text.grammar, film.durationS)),
    ...(film === undefined || text.pace === undefined ? {} : paceVars(text.pace, film.durationS)),
  };
}

/** Scene-build variables of a world project (with the shot's planned moment, if any). */
export function sceneWorldVars(world: PromptWorld, momentId?: string): Record<string, string> {
  const { text } = world;
  return {
    ...sceneMomentVars(text, momentId),
    world: world.label,
    worldShared: text.shared,
    craftBrief: text.craftBrief,
    worldAnnotate: text.annotate,
    worldMotion: text.motion,
    worldMissing: text.missing,
    ...(text.short === undefined ? {} : { worldShort: text.short }),
  };
}

/** Scene-fix variables of a world project: the craft brief, the shot's look and moment. */
export function fixWorldVars(
  world: PromptWorld,
  lookId: string,
  momentId?: string,
): Record<string, string> {
  return {
    world: world.label,
    craftBrief: world.text.craftBrief,
    lookId,
    ...sceneMomentVars(world.text, momentId),
  };
}

/** Critic variables of a world project: medium, style, vibe, checklist, the planned moment. */
export function criticWorldVars(world: PromptWorld, momentId?: string): Record<string, string> {
  const { text } = world;
  return {
    ...criticMomentVars(text, momentId),
    world: world.label,
    worldMedium: text.criticMedium,
    worldCriticStyle: text.criticStyle,
    worldVibe: text.vibe,
    worldChecklist: text.checklist,
  };
}

/**
 * Script variables of a world project: what a surprise beat is in this world and, for a world
 * whose films are written for it (Game B2), how the narration is framed.
 */
export function scriptWorldVars(world: PromptWorld): Record<string, string> {
  const { surprise, script } = world.text;
  return {
    world: world.label,
    worldSurprise: surprise,
    ...(script === undefined ? {} : { worldScript: script }),
  };
}
