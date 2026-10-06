/**
 * World wording of the stage prompts (PLAN.md#13.6, ADR-029): the texts per world id (= style id)
 * and the prompt variables built from them. The stages pick a world by the project's style and add
 * what comes from the kit and the engine (the world's label, its first look, its page-native
 * transitions); this package stays free of kit and engine imports.
 */
import { SKETCHBOOK_PROMPTS } from './sketchbook.js';
import type { WorldPromptText, WorldTransitionOption } from './types.js';

export type { WorldPromptText, WorldTransitionOption } from './types.js';

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

/** Storyboard variables of a world project (with the look variables of `mixed` mode). */
export function storyboardWorldVars(
  world: PromptWorld,
  firstLook: string,
  transitions: readonly WorldTransitionOption[],
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
  };
}

/** Scene-build variables of a world project. */
export function sceneWorldVars(world: PromptWorld): Record<string, string> {
  const { text } = world;
  return {
    world: world.label,
    worldShared: text.shared,
    craftBrief: text.craftBrief,
    worldAnnotate: text.annotate,
    worldMotion: text.motion,
    worldMissing: text.missing,
  };
}

/** Scene-fix variables of a world project: the craft brief and the shot's look. */
export function fixWorldVars(world: PromptWorld, lookId: string): Record<string, string> {
  return { world: world.label, craftBrief: world.text.craftBrief, lookId };
}

/** Critic variables of a world project: medium, style, vibe and the craft checklist. */
export function criticWorldVars(world: PromptWorld): Record<string, string> {
  const { text } = world;
  return {
    world: world.label,
    worldMedium: text.criticMedium,
    worldCriticStyle: text.criticStyle,
    worldVibe: text.vibe,
    worldChecklist: text.checklist,
  };
}
