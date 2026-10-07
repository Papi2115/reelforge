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
import { SKETCHBOOK_PROMPTS } from './sketchbook.js';
import type { WorldPromptText, WorldTransitionOption } from './types.js';
import type { WorldQuotaOverride } from './variety.js';

export type { WorldMomentOption, WorldPromptText, WorldTransitionOption } from './types.js';
export { worldMomentOption } from './moment-vars.js';
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

/** One line per page-native transition in the storyboard prompt. */
export function worldTransitionLine(option: WorldTransitionOption): string {
  return `- \`${option.id}\` (${option.type}, about ${String(option.duration)} s): ${option.description}.`;
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

/** Script variables of a world project: what a surprise beat is in this world. */
export function scriptWorldVars(world: PromptWorld): Record<string, string> {
  return { world: world.label, worldSurprise: world.text.surprise };
}
