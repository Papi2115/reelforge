/**
 * Words of the header and the status bar (docs/ux/redesign-2.4.md U4): the project line
 * ("EN · Voxel Pixel · Crisp 640 · 30 fps", the style by its display name, not its id) and the
 * model mode next to the Claude chip. Pure.
 */
import { findStylePreset } from '@reelforge/engine';
import type { ProjectSummary } from '../../shared/project-contract.js';

/** The style's display name; an unknown id (a style this build does not ship) shows as is. */
export function styleDisplayName(styleId: string): string {
  return findStylePreset(styleId)?.name ?? styleId;
}

export function projectMeta(project: Pick<ProjectSummary, 'language' | 'style' | 'fps'>): string {
  return `${project.language.toUpperCase()} · ${styleDisplayName(project.style)} · ${String(project.fps)} fps`;
}

/** The model mode in the status bar; null until the settings are loaded. */
export function modelsText(economy: boolean | undefined): string | null {
  if (economy === undefined) return null;
  return economy ? 'Economy mode: Sonnet only' : 'Sonnet / Opus per step';
}
