/**
 * View model of the "Research assets" row of Project settings (PLAN.md#12.10): the four research
 * modes with their explanations (full-auto carries the ⚠ licence warning), the open-licence
 * sources of the allowlist mode, and the patches the controls send. Pure.
 */
import { ALLOWLIST_SOURCES, type ResearchMode } from '@reelforge/shared';
import type {
  ProjectSettings,
  ProjectSettingsPatch,
} from '../../shared/project-settings-contract.js';

export type ResearchSourceId = (typeof ALLOWLIST_SOURCES)[number];

export interface ResearchModeChoice {
  readonly value: ResearchMode;
  readonly title: string;
  readonly hint: string;
  /** Shows the ⚠ warning when picked. */
  readonly risky: boolean;
}

export const RESEARCH_MODE_CHOICES: readonly ResearchModeChoice[] = [
  {
    value: 'ask',
    title: 'Ask me for each package',
    hint: 'Claude proposes photos and footage (thumbnail, source, licence); you approve them before anything is downloaded.',
    risky: false,
  },
  {
    value: 'allowlist',
    title: 'Automatic from selected sources',
    hint: 'Claude downloads on its own, only from the sources ticked below and only with a verified open licence.',
    risky: false,
  },
  {
    value: 'full-auto',
    title: 'Full auto ⚠ risky',
    hint: 'Claude may also use any website found by a broad search; licences can be unverified.',
    risky: true,
  },
  {
    value: 'off',
    title: 'Off',
    hint: 'No network at all: every shot is built from the kit and your own assets.',
    risky: false,
  },
];

export const FULL_AUTO_WARNING =
  '⚠ Full auto can download images whose licence nobody checked. They are marked ⚠ unverified in the asset list, the credits and the export dialog. You are responsible for checking every licence before you publish. YouTube, video platforms, social networks and anything behind a login or paywall stay blocked.';

export interface ResearchSourceChoice {
  readonly id: ResearchSourceId;
  readonly label: string;
  readonly hint: string;
}

export const RESEARCH_SOURCE_CHOICES: readonly ResearchSourceChoice[] = [
  { id: 'wikimedia', label: 'Wikimedia Commons', hint: 'photos, maps, documents' },
  { id: 'openverse', label: 'Openverse', hint: 'openly licensed images from many sites' },
  { id: 'internet-archive', label: 'Internet Archive', hint: 'public-domain footage and scans' },
  { id: 'nasa', label: 'NASA Image and Video Library', hint: 'space and science' },
  { id: 'loc', label: 'Library of Congress', hint: 'historical photos and prints' },
];

/** Picked when the allowlist mode is chosen with no source yet (PLAN.md example). */
export const DEFAULT_ALLOWLIST_SOURCES: readonly ResearchSourceId[] = ['wikimedia', 'nasa'];

export const RESEARCH_NOTE =
  'Applies to the next Storyboard and Assets steps. Assets already downloaded stay in the project; no step is marked out of date.';

/** The patch of picking `mode` (the allowlist mode starts with Wikimedia + NASA when empty). */
export function researchModePatch(
  settings: ProjectSettings,
  mode: ResearchMode,
): ProjectSettingsPatch {
  if (mode === 'allowlist' && settings.researchSources.length === 0) {
    return { researchMode: mode, researchSources: [...DEFAULT_ALLOWLIST_SOURCES] };
  }
  return { researchMode: mode };
}

/** The patch of ticking / unticking a source (kept in the catalogue order). */
export function researchSourcePatch(
  settings: ProjectSettings,
  source: ResearchSourceId,
  checked: boolean,
): ProjectSettingsPatch {
  const next = new Set(settings.researchSources);
  if (checked) next.add(source);
  else next.delete(source);
  return { researchSources: ALLOWLIST_SOURCES.filter((id) => next.has(id)) };
}

/** Why the allowlist mode would find nothing, else null. */
export function allowlistProblem(settings: ProjectSettings): string | null {
  return settings.researchMode === 'allowlist' && settings.researchSources.length === 0
    ? 'Tick at least one source: with none, Claude cannot download anything.'
    : null;
}
