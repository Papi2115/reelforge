/**
 * World projects in `reelforge kit-docs` (PLAN.md#13.6, ADR-029): a world's style always mixes its
 * own looks (`voxel-only` would list none of them), and an experimental world's looks are listed
 * only when the app runs with experimental worlds on: it sets `REELFORGE_EXPERIMENTAL_WORLDS=1`
 * for its Claude processes (the CLI shims' env), matching `StageSettings.experimentalWorlds`.
 */
import { isWorldStyle, type LookScope } from '@reelforge/kit';
import { projectLookMode, type LookMode, type ProjectFile } from '@reelforge/shared';

export const EXPERIMENTAL_WORLDS_ENV = 'REELFORGE_EXPERIMENTAL_WORLDS';

/** True when the environment turns experimental worlds on (`1` or `true`). */
export function experimentalWorldsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[EXPERIMENTAL_WORLDS_ENV]?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

/** The project's look mode for the kit docs: a world's style is always `mixed`. */
export function kitDocsLookMode(project: Pick<ProjectFile, 'lookMode' | 'style'>): LookMode {
  return isWorldStyle(project.style) ? 'mixed' : projectLookMode(project);
}

/** The catalog scope of a project style (experimental looks only with the env switch). */
export function kitDocsScope(style: string | undefined, experimental: boolean): LookScope {
  return experimental ? { style, experimental: true } : { style };
}
