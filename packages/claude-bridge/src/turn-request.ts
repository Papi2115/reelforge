/**
 * TurnRequest -> CLI flags: model per stage (Economy mode = all Sonnet, PLAN.md §2.2), the
 * stage's permissions (PLAN.md#5.7) with per-request overrides, and the Economy turn hint.
 */
import type { ModelAlias, TurnFlags } from './args.js';
import { permissionsForStage, type ToolPolicy } from './permissions.js';
import {
  DEFAULT_STAGE_MODELS,
  type SessionManagerOptions,
  type TurnRequest,
} from './session-types.js';

export const ECONOMY_MODEL: ModelAlias = 'sonnet';

/** Appended to the system prompt in Economy mode (shorter turns, fewer tokens). */
export const ECONOMY_HINT =
  'Economy mode is on: keep this turn short. Do only what the task needs, avoid exploratory reads, render at most one contact sheet for self-checks, and answer briefly.';

/** Explicit request model > Economy (all Sonnet) > per-manager stage map > PLAN.md defaults. */
export function resolveModel(request: TurnRequest, options: SessionManagerOptions): ModelAlias {
  if (request.model !== undefined) return request.model;
  if (options.economy === true) return ECONOMY_MODEL;
  return options.models?.[request.stage] ?? DEFAULT_STAGE_MODELS[request.stage];
}

export interface PreparedTurn {
  /** Everything but `--resume` (decided per attempt). */
  readonly flags: Omit<TurnFlags, 'resume'>;
  /** Bridge-side policy to audit the turn's tool calls against; undefined when overridden. */
  readonly policy: ToolPolicy | undefined;
}

function joinPrompts(parts: readonly (string | undefined)[]): string | undefined {
  const present = parts.filter((part): part is string => part !== undefined && part !== '');
  return present.length === 0 ? undefined : present.join('\n\n');
}

export function prepareTurn(
  request: TurnRequest,
  options: SessionManagerOptions,
  model: ModelAlias,
  projectDir: string,
): PreparedTurn {
  const stage =
    options.permissions === false
      ? undefined
      : permissionsForStage(request.stage, projectDir, options.permissions);
  const overridden =
    request.tools !== undefined ||
    request.allowedTools !== undefined ||
    request.disallowedTools !== undefined ||
    request.addDirs !== undefined;
  return {
    flags: {
      model,
      tools: request.tools ?? stage?.tools,
      allowedTools: request.allowedTools ?? stage?.allowedTools,
      disallowedTools: request.disallowedTools ?? stage?.disallowedTools,
      permissionMode: request.permissionMode ?? stage?.permissionMode,
      appendSystemPrompt: joinPrompts([
        request.appendSystemPrompt,
        options.economy === true ? ECONOMY_HINT : undefined,
      ]),
      addDirs: request.addDirs ?? stage?.addDirs,
      settingSources: stage?.settingSources,
      settings: stage?.settings,
    },
    policy: overridden ? undefined : stage?.policy,
  };
}
