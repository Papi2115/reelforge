/**
 * Prompt -> bridge stage (tool permissions, default model, usage bucket) and model selection.
 * Model priority mirrors the bridge's `resolveModel`: explicit override > Economy (all
 * `ECONOMY_MODEL`) > the app's model per stage > the model declared in the prompt file.
 */
import { ECONOMY_MODEL, type ModelAlias, type Stage } from '@reelforge/claude-bridge';
import { loadPrompt, type PromptId } from './catalog.js';

/**
 * Bridge stage whose permissions (and model setting, usage bucket) a prompt runs under. The
 * pipeline prompts map 1:1 to the stage of the same name; the whole-video review prompts reuse
 * the closest one: triage looks at frames like the critic (Haiku, read-only), the fix plan is
 * planning work like the storyboard (Sonnet), and so is the YouTube text of an export (Sonnet);
 * a project prop (kit-ext) is built like a scene (Opus, project edits + reelforge).
 */
export const PROMPT_PERMISSION_STAGE: Readonly<Record<PromptId, Stage>> = {
  research: 'research',
  script: 'script',
  storyboard: 'storyboard',
  'scene-build': 'scene-build',
  'scene-fix': 'scene-fix',
  critic: 'critic',
  'sound-cues': 'sound-cues',
  'review-triage': 'critic',
  'review-plan': 'storyboard',
  'youtube-meta': 'storyboard',
  // Asset research (PLAN.md#12.10) plans like the storyboard: Sonnet, reelforge only, no web tools.
  assets: 'storyboard',
  // A project prop is scene-building work: same tools (project edits + reelforge), Opus.
  'prop-build': 'scene-build',
  // A project role (PLAN.md#12.20) is a role spec, data not code: planning work like the
  // storyboard (Sonnet, project edits + reelforge).
  roles: 'storyboard',
  // The tension map (PLAN.md#12.22) is planning before the storyboard: Sonnet, project edits.
  tension: 'storyboard',
  // Fact-checking the script (PLAN.md#12.18) only reads: the critic's permissions (read-only
  // tools, no web); the app asks for the prompt's own model (Sonnet) explicitly.
  claims: 'critic',
  // Hook lab openings (PLAN.md#12.16) are written from the script alone: read-only tools, no web
  // (the critic's permissions); the app asks for the prompt's own model (Sonnet) explicitly.
  hooks: 'critic',
  // The production line's brief (PLAN.md#13.9) is written from the topic alone: read-only tools,
  // no web (the critic's permissions); the line asks for the prompt's own model (Sonnet).
  brief: 'critic',
  // A world film's own assets (PLAN.md#13.15) are built like project props: Opus, project edits
  // (the stage puts back anything outside assets/) + reelforge.
  'world-assets': 'scene-build',
  // The world-assets critic (PLAN.md#13.15) names each asset crop: the critic's Haiku, read-only.
  'world-asset-critic': 'critic',
};

export function permissionStageFor(id: PromptId): Stage {
  return PROMPT_PERMISSION_STAGE[id];
}

export interface PromptModelOptions {
  /** Economy mode (PLAN.md §2.2): every stage on the bridge's `ECONOMY_MODEL`. */
  readonly economy?: boolean;
  /** Explicit choice for this one turn; wins over everything. */
  readonly override?: ModelAlias;
  /**
   * Model per bridge stage from the app settings (same shape as `SessionManagerOptions.models`);
   * below Economy, above the model declared in the prompt file.
   */
  readonly models?: Partial<Record<Stage, ModelAlias>>;
}

export function promptModel(id: PromptId, options: PromptModelOptions = {}): ModelAlias {
  if (options.override !== undefined) return options.override;
  if (options.economy === true) return ECONOMY_MODEL;
  return options.models?.[permissionStageFor(id)] ?? loadPrompt(id).model;
}

/** Built-in tool names a prompt declares, without rule content (`Bash(reelforge *)` -> `Bash`). */
export function promptToolNames(id: PromptId): string[] {
  return [...new Set(loadPrompt(id).tools.map((tool) => tool.replace(/\(.*\)$/, '')))];
}
