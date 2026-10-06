/**
 * View model of the Director tab (docs/ux/redesign-2.4.md §2.4, U9): the side column's tabs
 * (Chat · History · Director, the last choice remembered on this computer), the tab's sections and
 * their one-line statuses: the tension curve summary and its mini curve, the current opening's
 * first line, and the live directions of this session (newest first, with Undo / Redo). Pure.
 */
import type { TensionFile, TensionPoint } from '@reelforge/shared';
import { z } from 'zod';
import { plural } from '../../shared/plural.js';
import type { StageReports } from '../../shared/voiceover-contract.js';
import type { DirectionSession } from '../direction/direction-view.js';
import { redoTarget, undoTarget } from '../direction/direction-view.js';
import { dramaturgyKey } from '../dramaturgy/dramaturgy-view.js';
import { curvePath, sourceText, type TensionGeometry } from '../tension/tension-view.js';

export const SIDE_TABS = ['chat', 'history', 'director'] as const;
export type SideTab = (typeof SIDE_TABS)[number];
export const sideTabSchema = z.enum(SIDE_TABS);
/** localStorage key of the remembered tab (UI state, never project.json). */
export const SIDE_TAB_STORAGE_KEY = 'reelforge.layout.side-tab.v1';
export const DEFAULT_SIDE_TAB: SideTab = 'chat';

export const SIDE_TAB_LABELS: Readonly<Record<SideTab, string>> = {
  chat: 'Chat',
  history: 'History',
  director: 'Director',
};

export const DIRECTOR_SECTIONS = ['tension', 'beats', 'editing', 'opening', 'directions'] as const;
export type DirectorSection = (typeof DIRECTOR_SECTIONS)[number];

export const DIRECTOR_SECTION_TITLES: Readonly<Record<DirectorSection, string>> = {
  tension: 'Tension curve',
  beats: 'Story beats',
  editing: 'Editing',
  opening: 'Opening',
  directions: 'Directions',
};

/** DOM id of a section (scrolled into view when an old entry point opens the tab on it). */
export function directorSectionId(section: DirectorSection): string {
  return `director-${section}`;
}

/**
 * Refresh key of the sections that read reports through main (story beats, editing, opening):
 * changes with the project's video inputs (project.json, the shot plan, …), a review or a sync check.
 */
export function directorRefreshKey(
  revision: number,
  reports: Pick<StageReports, 'finalReview' | 'sync'> | undefined,
): string {
  return dramaturgyKey([revision, reports?.finalReview?.finishedAt, reports?.sync?.createdAt]);
}

/** What the tab says while there is nothing to direct (no shot plan yet). */
export function directorEmptyLine(nextStep: string | undefined): string {
  const next = nextStep ?? 'Plan the shots (Storyboard).';
  return `The Director opens once the shots are planned. Next: ${next}`;
}

export const DIRECTOR_FOOTER =
  'The switches are the Project settings switches (what each does and when it applies: Project settings → Direction). They apply from the next build and never mark a step out of date.';

/** Where old entry points point (one release, docs/ux/redesign-2.4.md §9 risks). */
export const SCENES_POINTER = 'Story beats and Editing are now in the Director.';
export const OPEN_DIRECTOR_LABEL = 'Open the Director';

const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
};

/** "Drawn by you · 6 points · peak 95 % at 0:04", or why there is no curve. */
export function tensionSummary(file: TensionFile | undefined, invalid: string | undefined): string {
  if (invalid !== undefined) return `The curve cannot be read: ${invalid}`;
  if (file === undefined) return 'No curve yet: open the editor to pick a preset or ask Claude.';
  const peak = file.points.reduce((best, point) => (point.v > best.v ? point : best));
  return `${sourceText(file)} · ${plural(file.points.length, 'point')} · peak ${String(Math.round(peak.v * 100))} % at ${clock(peak.t)}`;
}

/** Drawing size of the mini curve (the SVG scales it to the column's width). */
export const MINI_CURVE: Omit<TensionGeometry, 'durationS'> = { width: 320, height: 48, pad: 4 };

/** SVG path of the mini curve over the film's length ('' without points or length). */
export function miniCurvePath(points: readonly TensionPoint[], durationS: number): string {
  if (!(durationS > 0)) return '';
  return curvePath(points, { ...MINI_CURVE, durationS });
}

const OPENING_MAX = 140;

/** The current opening's first sentence, shortened; or why there is none. */
export function openingLine(opening: string | null | undefined): string {
  if (opening === undefined) return 'Reading the script…';
  const text = opening?.trim().replace(/\s+/g, ' ') ?? '';
  if (text === '') return 'No script yet: the opening appears once the script is written.';
  const sentence = /^.+?[.!?…](?=\s|$)/u.exec(text)?.[0] ?? text;
  return sentence.length <= OPENING_MAX
    ? `“${sentence}”`
    : `“${sentence.slice(0, OPENING_MAX - 1).trimEnd()}…”`;
}

export interface DirectionRow {
  readonly id: number;
  readonly shotId: string;
  readonly command: string;
  readonly confirmation: string;
  readonly undone: boolean;
}

/** The session's directions, newest first. */
export function directionRows(session: DirectionSession): DirectionRow[] {
  return [...session.entries].reverse().map((entry) => ({
    id: entry.id,
    shotId: entry.shotId,
    command: entry.command,
    confirmation: entry.confirmation,
    undone: entry.undone,
  }));
}

/** "2 directions this session · 3 shots have directions". */
export function directionsSummary(session: DirectionSession, directedShots: number): string {
  const count = session.entries.length;
  const done =
    count === 0 ? 'No directions this session' : `${plural(count, 'direction')} this session`;
  const shots =
    directedShots === 0
      ? 'no shot has directions'
      : `${plural(directedShots, 'shot')} ${directedShots === 1 ? 'has' : 'have'} directions`;
  return `${done} · ${shots}`;
}

export function canUndoDirection(session: DirectionSession): boolean {
  return undoTarget(session) !== undefined;
}

export function canRedoDirection(session: DirectionSession): boolean {
  return redoTarget(session) !== undefined;
}
