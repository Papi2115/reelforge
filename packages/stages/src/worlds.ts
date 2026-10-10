/**
 * World projects in the stages (PLAN.md#13.6, ADR-029): a project whose style is a world's makes
 * that world's film. Its look mode is always `mixed` (the world's A/B/C looks; `voxel-only` has no
 * meaning there), its prompts carry the world's wording (`@reelforge/prompts` worlds), its
 * storyboard names only the world's page-native transitions, and shots without a style get one of
 * them. An experimental world counts only with `StageSettings.experimentalWorlds`; until then (and
 * for every built-in style) nothing here changes a prompt, a check or a file. A world whose looks
 * are optional (Grim Ink, PLAN.md#14.12) offers only the looks the project keeps on
 * (project.json `worldLooks`), its rolls lettered by place and its storyboard wording to match.
 */
import { WORLD_TRANSITIONS, type WorldTransition } from '@reelforge/engine';
import { isWorldStyle, LOOK_ROLLS, WORLDS, type Look, type World } from '@reelforge/kit';
import {
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  worldTextForLooks,
  worldTransitionRange,
  type PromptWorld,
  type WorldQuotaOverride,
  type WorldVarietyOptions,
} from '@reelforge/prompts';
import {
  enabledWorldLooks,
  isContinuityStyle,
  PAGE_CAMERA_HINTS,
  type ContinuityKind,
  type MomentKind,
  projectLookMode,
  shotLook,
  transitionHash,
  type LookMode,
  type ProjectFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { fallbackLook, styleLooks } from './looks.js';
import type { StageSettings } from './settings.js';

/** Whether experimental worlds count (the stage settings' flag). */
export interface WorldScope {
  readonly experimental?: boolean | undefined;
}

export function worldScope(settings: Pick<StageSettings, 'experimentalWorlds'>): WorldScope {
  return { experimental: settings.experimentalWorlds === true };
}

/**
 * The world of `style` when it is offered in `scope` (shipped, or experimental with the flag); a
 * world that is not wired yet (no prompts or project defaults) is never offered.
 */
export function activeWorld(
  style: string | undefined,
  scope: WorldScope = {},
  worlds: readonly World[] = WORLDS,
): World | undefined {
  const world = worlds.find((entry) => entry.id === style);
  if (world === undefined || !world.wired) return undefined;
  return world.experimental && scope.experimental !== true ? undefined : world;
}

/** The project's look mode; a world's style always mixes the world's looks. */
export function effectiveLookMode(project: Pick<ProjectFile, 'lookMode' | 'style'>): LookMode {
  return isWorldStyle(project.style) ? 'mixed' : projectLookMode(project);
}

/** Look mode, offered looks and world of a project (one place for every stage). */
export interface LookSetup {
  readonly lookMode: LookMode;
  readonly looks: readonly Look[];
  readonly world: World | undefined;
}

/**
 * The looks a world project keeps on (`worldLooks`; every look of a world without optional looks):
 * with some turned off, each look in use gets the roll of its place (A, B, C).
 */
export function looksInUse(
  world: World | undefined,
  looks: readonly Look[],
  chosen: readonly string[] | undefined,
): Look[] {
  if (world?.optionalLooks !== true) return [...looks];
  const kept = enabledWorldLooks(looks, chosen);
  if (kept.length === looks.length) return kept;
  return kept.map((look, index) => {
    const roll = LOOK_ROLLS[index];
    return roll === undefined ? look : { ...look, rolls: [roll] };
  });
}

export function lookSetup(
  project: Pick<ProjectFile, 'lookMode' | 'style' | 'worldLooks'>,
  scope: WorldScope = {},
): LookSetup {
  const world = activeWorld(project.style, scope);
  return {
    lookMode: effectiveLookMode(project),
    looks: looksInUse(world, styleLooks(project.style, scope), project.worldLooks),
    world,
  };
}

/** The world's prompt wording (undefined when the prompts package has none for it). */
export function promptWorld(world: World | undefined): PromptWorld | undefined {
  const text = worldPromptText(world?.id);
  return world === undefined || text === undefined ? undefined : { label: world.label, text };
}

/**
 * The world's storyboard wording for the looks the project keeps (a world without optional looks,
 * or with all of them on: its wording as it is).
 */
function storyboardPromptWorld(setup: LookSetup): PromptWorld | undefined {
  const world = promptWorld(setup.world);
  if (world === undefined || setup.world?.optionalLooks !== true) return world;
  const all = setup.world.looks.map((look) => look.id);
  const kept = setup.looks.map((look) => look.id);
  return { ...world, text: worldTextForLooks(world.text, all, kept) };
}

/**
 * A world's page-native transition as the prompt, the validator and the picker use it; `link` =
 * the continuity link kind it renders (Game B1's calendar zoom and cartridge in / out).
 */
export type WorldTransitionChoice = Pick<
  WorldTransition,
  'id' | 'type' | 'duration' | 'description'
> & { readonly link?: ContinuityKind };

/** The page-native transitions of a world (engine `WORLD_TRANSITIONS`), in engine order. */
export function worldTransitionOptions(world: World | undefined): WorldTransitionChoice[] {
  if (world === undefined) return [];
  return Object.values(WORLD_TRANSITIONS)
    .filter((style) => style.world === world.id)
    .map((style) => {
      const { id, type, duration, description } = style;
      const link = 'link' in style ? style.link : undefined;
      return { id, type, duration, description, ...(link === undefined ? {} : { link }) };
    });
}

/**
 * Storyboard prompt variables of the world (none outside a world): with the film's length its
 * moment catalog and quota (real run Sketchbook 1); `override` = a test driver's quota.
 */
export function storyboardWorldPromptVars(
  setup: LookSetup,
  durationS?: number,
  override?: WorldQuotaOverride,
): Record<string, string> {
  const world = storyboardPromptWorld(setup);
  if (world === undefined) return {};
  const first = setup.looks[0]?.id ?? fallbackLook(setup.looks).id;
  const film = durationS === undefined ? undefined : { durationS, override };
  return storyboardWorldVars(world, first, worldTransitionOptions(setup.world), film);
}

/**
 * Storyboard validator options of the world: its transitions are the only named styles, and its
 * moment catalog brings the variety checks (quota, spacing, runs, distinct transitions; with
 * `continuityLinks` on also the film's link quota).
 */
export function storyboardWorldOptions(
  setup: LookSetup,
  override?: WorldQuotaOverride,
  continuityLinks = false,
): {
  readonly worldTransitions?: readonly WorldTransitionChoice[];
  readonly worldVariety?: WorldVarietyOptions;
} {
  if (setup.world === undefined) return {};
  const transitions = worldTransitionOptions(setup.world);
  const text = storyboardPromptWorld(setup)?.text;
  const moments = text?.moments ?? [];
  return {
    worldTransitions: transitions,
    ...(moments.length === 0
      ? {}
      : {
          worldVariety: {
            moments,
            transitions,
            // the world's film grammar (Game B1 rework); other worlds have none
            ...(text?.grammar === undefined ? {} : { grammar: text.grammar }),
            // the world's transition pace (Comic: pages flow into each other); others have none
            ...(text?.pace === undefined ? {} : { pace: text.pace }),
            ...(override === undefined ? {} : { override }),
            ...(continuityLinks ? { continuityLinks } : {}),
          },
        }),
  };
}

/** Scene-build prompt variables of the world and the shot's planned moment (none outside). */
export function sceneWorldPromptVars(
  world: World | undefined,
  shot?: Pick<StoryboardShot, 'worldMoment'>,
): Record<string, string> {
  const text = promptWorld(world);
  return text === undefined ? {} : sceneWorldVars(text, shot?.worldMoment);
}

/** Script prompt variables of the world: its surprise beats (none outside a world). */
export function scriptWorldPromptVars(
  world: World | undefined,
  targetMinutes?: number,
): Record<string, string> {
  const text = promptWorld(world);
  return text === undefined ? {} : scriptWorldVars(text, targetMinutes);
}

/** Reveal-moment camera hints of a world (its camera never orbits); undefined outside. */
export function worldMomentCameraHints(
  world: World | undefined,
): Readonly<Record<MomentKind, string>> | undefined {
  return world === undefined ? undefined : PAGE_CAMERA_HINTS;
}

/** Scene-fix prompt variables of the world: its craft brief and the shot's look. */
export function fixWorldPromptVars(
  world: World | undefined,
  shot: StoryboardShot,
  looks: readonly Look[],
): Record<string, string> {
  const text = promptWorld(world);
  if (text === undefined) return {};
  const look = looks.find((entry) => entry.id === shotLook(shot)) ?? fallbackLook(looks);
  return fixWorldVars(text, look.id, shot.worldMoment);
}

/** Critic prompt variables of the world and the shot's planned moment (none outside). */
export function criticWorldPromptVars(
  world: World | undefined,
  shot?: Pick<StoryboardShot, 'worldMoment'>,
): Record<string, string> {
  const text = promptWorld(world);
  return text === undefined ? {} : criticWorldVars(text, shot?.worldMoment);
}

/**
 * Fills a world style into every non-cut transition that names none (deterministic: project seed
 * + shot id, never the style used just before); continuity links and named styles stay. A style
 * that renders a link (`link`) is never filled in: an unplanned link has no object.
 */
export function assignWorldTransitions(
  shots: readonly StoryboardShot[],
  choices: readonly WorldTransitionChoice[],
  seed: number,
): { readonly shots: StoryboardShot[]; readonly changed: readonly string[] } {
  const options = choices.filter((option) => option.link === undefined);
  const changed: string[] = [];
  let previous: string | undefined;
  const result = shots.map((shot, index): StoryboardShot => {
    const transition = shot.transitionIn;
    if (index === 0 || transition === undefined || transition.type === 'cut') return shot;
    if (isContinuityStyle(transition.style)) return shot;
    if (transition.style !== undefined) {
      previous = transition.style;
      return shot;
    }
    const fresh = options.filter((option) => option.id !== previous);
    const pool = fresh.length > 0 ? fresh : options;
    const picked = pool[transitionHash(`${String(seed >>> 0)}|${shot.id}`) % pool.length];
    if (picked === undefined) return shot;
    previous = picked.id;
    const { min, max } = worldTransitionRange(picked);
    const keeps = transition.duration >= min && transition.duration <= max;
    changed.push(shot.id);
    return {
      ...shot,
      transitionIn: {
        ...transition,
        type: picked.type,
        duration: keeps ? transition.duration : picked.duration,
        style: picked.id,
      },
    };
  });
  return { shots: result, changed };
}
