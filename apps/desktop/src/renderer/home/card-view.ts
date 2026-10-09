/**
 * Words and small facts of one Home card (PLAN.md#13.16): the step strip's labels and sentence,
 * the card's state, "Edited 2 h ago", the film's length, the placeholder picture (initials on the
 * style's colour). Pure: no React, no IPC; `now` is passed in.
 */
import type {
  HomeProject,
  HomeStep,
  HomeStepState,
  HomeStepStatus,
} from '../../shared/home-contract.js';
import { styleLabel } from '../../shared/style-choices.js';

export const STEP_LABELS: Readonly<Record<HomeStep, string>> = {
  script: 'Script',
  voice: 'Voice',
  clean: 'Clean',
  words: 'Words',
  storyboard: 'Storyboard',
  scenes: 'Scenes',
  sound: 'Sound',
  export: 'Export',
};

export const STEP_STATE_WORDS: Readonly<Record<HomeStepState, string>> = {
  todo: 'not started',
  done: 'done',
  busy: 'working',
  'needs-you': 'needs you',
  problem: 'stopped with a problem',
};

/** One state for the whole card (filters, the badge, the sentence). */
export type CardState = 'missing' | 'needs-you' | 'working' | 'done' | 'in-progress' | 'new';

export function cardState(project: HomeProject): CardState {
  if (!project.exists) return 'missing';
  const states = project.steps.map((entry) => entry.state);
  if (states.some((state) => state === 'needs-you' || state === 'problem')) return 'needs-you';
  if (states.includes('busy')) return 'working';
  if (project.steps.find((entry) => entry.step === 'export')?.state === 'done') return 'done';
  return states.includes('done') ? 'in-progress' : 'new';
}

export function stepsDone(steps: readonly HomeStepStatus[]): number {
  return steps.filter((entry) => entry.state === 'done').length;
}

/** "Script done · Voice needs you" for one dot's tooltip. */
export function stepTitle(entry: HomeStepStatus): string {
  return `${STEP_LABELS[entry.step]}: ${STEP_STATE_WORDS[entry.state]}`;
}

/** The first step that waits for the user, else the first one not done (null when all are). */
export function nextStep(steps: readonly HomeStepStatus[]): HomeStepStatus | null {
  return (
    steps.find((entry) => entry.state === 'needs-you' || entry.state === 'problem') ??
    steps.find((entry) => entry.state === 'busy') ??
    steps.find((entry) => entry.state !== 'done') ??
    null
  );
}

/** The card's one-line status under the strip. */
export function cardSentence(project: HomeProject): string {
  if (!project.exists) return 'The folder is gone (moved or deleted).';
  if (project.problem !== null) return 'The project file is damaged: open it to repair it.';
  const next = nextStep(project.steps);
  const done = stepsDone(project.steps);
  if (next === null) return 'Video exported ✓';
  const label = STEP_LABELS[next.step];
  switch (next.state) {
    case 'needs-you':
      return done === 0 && next.step === 'script'
        ? 'New: describe the video, then write the script.'
        : `${label} needs you.`;
    case 'problem':
      return `${label} stopped with a problem.`;
    case 'busy':
      return `Working on ${label.toLowerCase()}…`;
    case 'todo':
    case 'done':
      return `${String(done)} of ${String(project.steps.length)} steps done · next: ${label}`;
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", "12 Oct", "12 Oct 2025". */
export function relativeTime(iso: string | null, now: number): string | null {
  if (iso === null) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const age = Math.max(0, now - time);
  if (age < MINUTE) return 'just now';
  if (age < HOUR) return `${String(Math.floor(age / MINUTE))} min ago`;
  if (age < DAY) return `${String(Math.floor(age / HOUR))} h ago`;
  if (age < 2 * DAY) return 'yesterday';
  if (age < 7 * DAY) return `${String(Math.floor(age / DAY))} days ago`;
  const date = new Date(time);
  const day = `${String(date.getDate())} ${MONTHS[date.getMonth()] ?? ''}`;
  return date.getFullYear() === new Date(now).getFullYear()
    ? day
    : `${day} ${String(date.getFullYear())}`;
}

/** "0:42", "8:05", "1:02:03"; null when unknown. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${String(minutes).padStart(2, '0')}:${rest}`
    : `${String(minutes)}:${rest}`;
}

/** Up to two capital letters of the title's first words ("How a calculator…" → "HC"). */
export function titleInitials(title: string): string {
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word !== '');
  const letters = words
    .filter((word, index) => index === 0 || word.length > 2)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase());
  return letters.join('') || '?';
}

/** The placeholder's colours per style: what the films of that style look like. */
const STYLE_TINTS: Readonly<Record<string, readonly [string, string]>> = {
  'voxel-pixel-crisp640': ['#241a4a', '#ff5fa2'],
  'noir-voxel': ['#141418', '#e0443c'],
  'soft-480': ['#3a2a44', '#f2a48c'],
  sketchbook: ['#efe6d2', '#e07a2e'],
  comic: ['#22344f', '#f2c14e'],
  'game-b2': ['#1c1610', '#d9a441'],
  'game-b1': ['#10282c', '#f08a3c'],
};
const DEFAULT_TINT: readonly [string, string] = ['#1d1f28', '#ff8a3d'];

/** Background and accent of the placeholder picture. */
export function styleTint(styleId: string | null): { readonly back: string; readonly ink: string } {
  const [back, ink] = (styleId === null ? undefined : STYLE_TINTS[styleId]) ?? DEFAULT_TINT;
  return { back, ink };
}

/** The style badge: the style's name ("Sketchbook"); null for a project without one. */
export function styleBadge(styleId: string | null): string | null {
  return styleId === null ? null : styleLabel(styleId);
}
