/**
 * Home → Shorts (PLAN.md#13.18): every Short grouped under its film, which films can have Shorts,
 * and the steps of "New short from a film" (film → angle → captions and create) with their checks
 * and review. Pure: no React, no IPC.
 */
import { shortEndCardText, supportsShorts, SHORTS_UNSUPPORTED_MESSAGE } from '@reelforge/shared';
import type { HomeProject } from '../../shared/home-contract.js';
import { MAX_ANGLE_HINT_LENGTH, type ShortsCreateRequest } from '../../shared/overview-contract.js';
import { dirKey } from './home-view.js';

export interface ShortGroup {
  /** The film's folder (the group's key). */
  readonly filmDir: string;
  readonly filmTitle: string;
  /** The film's card when Home lists it (it can be opened). */
  readonly film: HomeProject | undefined;
  /** 30 s first. */
  readonly shorts: readonly HomeProject[];
}

function newest(projects: readonly HomeProject[]): number {
  return Math.max(0, ...projects.map((project) => Date.parse(project.updatedAt ?? '') || 0));
}

/** Every Short under its film; the group edited last first. */
export function shortGroups(projects: readonly HomeProject[]): ShortGroup[] {
  const films = new Map(projects.map((project) => [dirKey(project.dir), project]));
  const groups = new Map<string, { filmDir: string; title: string; shorts: HomeProject[] }>();
  for (const short of projects) {
    if (short.kind !== 'short') continue;
    const filmDir = short.parentDir ?? '';
    const key = dirKey(filmDir);
    const group = groups.get(key) ?? {
      filmDir,
      title: films.get(key)?.title ?? short.parentTitle ?? 'Film not found',
      shorts: [],
    };
    group.shorts.push(short);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      filmDir: group.filmDir,
      filmTitle: group.title,
      film: films.get(key),
      shorts: [...group.shorts].sort(
        (first, second) => (first.short?.lengthS ?? 0) - (second.short?.lengthS ?? 0),
      ),
    }))
    .sort((first, second) => newest(second.shorts) - newest(first.shorts));
}

/** A Short's card shows its planned length until its storyboard has one. */
export function shortCardProject(short: HomeProject): HomeProject {
  return short.durationS !== null || short.short === null
    ? short
    : { ...short, durationS: short.short.lengthS };
}

export type ShortEligibility = 'ok' | 'not-a-film' | 'missing' | 'no-script' | 'unsupported';

export function shortEligibility(project: HomeProject): ShortEligibility {
  if (project.kind !== 'film') return 'not-a-film';
  if (!project.exists || project.problem !== null) return 'missing';
  if (project.style === null || !supportsShorts(project.style)) return 'unsupported';
  return project.hasScript ? 'ok' : 'no-script';
}

/** Films the wizard offers: a script and a style that has Shorts. */
export function eligibleFilms(projects: readonly HomeProject[]): HomeProject[] {
  return projects.filter((project) => shortEligibility(project) === 'ok');
}

/** Why some films are not offered; null when none is left out. */
export function hiddenFilmsNote(projects: readonly HomeProject[]): string | null {
  const reasons = projects.map(shortEligibility);
  const noScript = reasons.filter((reason) => reason === 'no-script').length;
  const unsupported = reasons.filter((reason) => reason === 'unsupported').length;
  const parts = [
    ...(noScript > 0 ? [`${String(noScript)} without a script yet`] : []),
    ...(unsupported > 0 ? [`${String(unsupported)} in another style`] : []),
  ];
  if (parts.length === 0) return null;
  return `Not listed: ${parts.join(', ')}. ${SHORTS_UNSUPPORTED_MESSAGE}`;
}

export const SHORT_WIZARD_STEPS = ['film', 'angle', 'create'] as const;
export type ShortWizardStep = (typeof SHORT_WIZARD_STEPS)[number];

export const SHORT_WIZARD_TITLES: Readonly<Record<ShortWizardStep, string>> = {
  film: 'Film',
  angle: 'Angle',
  create: 'Captions and create',
};

export type AngleMode = 'auto' | 'steer';

export interface ShortWizardState {
  readonly filmDir: string | undefined;
  readonly angle: AngleMode;
  readonly hint: string;
  readonly captions: boolean;
}

export const NEW_SHORT_WIZARD: ShortWizardState = {
  filmDir: undefined,
  angle: 'auto',
  hint: '',
  captions: false,
};

/** Why Next waits on `step`; undefined = ready. */
export function shortStepProblem(
  step: ShortWizardStep,
  state: ShortWizardState,
  films: readonly HomeProject[],
): string | undefined {
  if (step === 'film') {
    if (films.length === 0) return 'No film can have Shorts yet.';
    return films.some((film) => film.dir === state.filmDir) ? undefined : 'Pick a film.';
  }
  if (step === 'angle' && state.angle === 'steer') {
    const hint = state.hint.trim();
    if (hint === '') return 'Write the angle hint, or pick “Two different angles”.';
    if (hint.length > MAX_ANGLE_HINT_LENGTH) {
      return `Keep the hint under ${String(MAX_ANGLE_HINT_LENGTH)} characters.`;
    }
  }
  return undefined;
}

/** The step after (or before) `step`; undefined past the ends. */
export function nextShortStep(step: ShortWizardStep, by: 1 | -1): ShortWizardStep | undefined {
  return SHORT_WIZARD_STEPS[SHORT_WIZARD_STEPS.indexOf(step) + by];
}

/** The review rows of the last step. */
export function shortsReview(
  state: ShortWizardState,
  film: HomeProject | undefined,
  channelName: string,
): { label: string; value: string }[] {
  return [
    { label: 'Film', value: film?.title ?? '—' },
    { label: 'Shorts', value: '30 s + 60 s, vertical 9:16' },
    {
      label: 'Angle',
      value:
        state.angle === 'auto'
          ? 'Two different angles (automatic)'
          : `Steered toward: ${state.hint.trim()}`,
    },
    { label: 'End card', value: shortEndCardText(channelName) },
    { label: 'Captions', value: state.captions ? 'Word by word' : 'Off' },
  ];
}

/** The create request; undefined until a film is picked. */
export function shortsRequest(state: ShortWizardState): ShortsCreateRequest | undefined {
  if (state.filmDir === undefined) return undefined;
  const hint = state.hint.trim();
  return {
    dir: state.filmDir,
    captions: state.captions,
    ...(state.angle === 'steer' && hint !== '' ? { angleHint: hint } : {}),
  };
}
