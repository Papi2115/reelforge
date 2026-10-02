/**
 * Prompt -> bridge stage (tool permissions, default model, usage bucket) and model selection.
 * Model priority mirrors the bridge's `resolveModel`: explicit override > Economy (all
 * `ECONOMY_MODEL`) > the app's model per stage > the model declared in the prompt file.
 */
import { ECONOMY_MODEL, type ModelAlias, type Stage } from '@reelforge/claude-bridge';
import { loadPrompt, type PromptId } from './catalog.js';

/** Bridge stage whose permissions a prompt runs under (1:1: every prompt has its own stage). */
export const PROMPT_PERMISSION_STAGE: Readonly<Record<PromptId, Stage>> = {
  research: 'research',
  script: 'script',
  storyboard: 'storyboard',
  'scene-build': 'scene-build',
  'scene-fix': 'scene-fix',
  critic: 'critic',
  'sound-cues': 'sound-cues',
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
