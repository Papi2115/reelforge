/**
 * Words of the project overview (PLAN.md#13.16 part B, #13.18): the thumbnail's size and gentle
 * notes against YouTube's limits, the "Next step" button and the editor panel it opens, the
 * "Needs you" lines, the film facts and why the Shorts button waits. Pure: no React, no IPC.
 */
import { SHORTS_UNSUPPORTED_MESSAGE } from '@reelforge/shared';
import type { HomeProject, HomeStep, HomeStepStatus } from '../../shared/home-contract.js';
import type {
  FilmFacts,
  OverviewThumbnail,
  ProjectOverview,
} from '../../shared/overview-contract.js';
import type { OpenRequest } from '../queue/use-open-request.js';
import { nextStep, STEP_LABELS } from './card-view.js';

/** YouTube's thumbnail: 1280×720 recommended (16:9, at least 640 wide), at most 2 MB. */
export const YOUTUBE_THUMBNAIL = {
  width: 1280,
  height: 720,
  minWidth: 640,
  maxBytes: 2 * 1024 * 1024,
} as const;

const KB = 1024;
const MB = 1024 * KB;

/** "820 KB", "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < MB) return `${String(Math.max(1, Math.round(bytes / KB)))} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** "1280 × 720 · 1.4 MB · PNG" */
export function thumbnailFacts(thumbnail: OverviewThumbnail): string {
  const type = thumbnail.fileName.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
  return `${String(thumbnail.width)} × ${String(thumbnail.height)} · ${formatBytes(thumbnail.bytes)} · ${type}`;
}

function isWide(width: number, height: number): boolean {
  return height > 0 && Math.abs(width / height - 16 / 9) < 0.02;
}

/** The line under a thumbnail the export made from the opening title card (PLAN.md#14.18). */
export const OPENING_FRAME_NOTE =
  "Thumbnail from the opening frame: the film's title card, saved by the export. Replace it with your own picture any time.";

/** Gentle notes when the thumbnail is off YouTube's limits (empty = all good). */
export function thumbnailNotes(thumbnail: OverviewThumbnail): string[] {
  const { width, height, bytes } = thumbnail;
  const size = `${String(width)} × ${String(height)}`;
  const notes: string[] = [];
  if (bytes > YOUTUBE_THUMBNAIL.maxBytes) {
    notes.push(
      `YouTube takes thumbnails up to 2 MB; this one is ${formatBytes(bytes)}. Save it as a JPEG or smaller.`,
    );
  }
  if (!isWide(width, height)) {
    notes.push(
      `This picture is ${size}, not 16:9: YouTube adds bars or crops it. 1280 × 720 fits best.`,
    );
  } else if (width < YOUTUBE_THUMBNAIL.minWidth) {
    notes.push(`This picture is ${size}: YouTube wants at least 640 wide. 1280 × 720 fits best.`);
  } else if (width !== YOUTUBE_THUMBNAIL.width) {
    notes.push(`This picture is ${size}; YouTube recommends 1280 × 720 (it is scaled to fit).`);
  }
  return notes;
}

/** The editor panel a step opens on (the export dialog has no panel: the editor itself). */
export function stepPanel(step: HomeStep, hasScript: boolean): OpenRequest['panel'] {
  switch (step) {
    case 'script':
      return hasScript ? 'script' : 'brief';
    case 'voice':
    case 'clean':
      return 'voiceover';
    case 'words':
    case 'storyboard':
    case 'scenes':
    case 'sound':
      return step;
    case 'export':
      return 'project';
  }
}

export interface NextStepAction {
  readonly step: HomeStep;
  /** "Open Voice" */
  readonly label: string;
  readonly panel: OpenRequest['panel'];
}

/** The overview's "Next step" button; null when every step is done. */
export function nextStepAction(card: HomeProject): NextStepAction | null {
  const next = nextStep(card.steps);
  if (next === null) return null;
  return {
    step: next.step,
    label: `Open ${STEP_LABELS[next.step]}`,
    panel: stepPanel(next.step, card.hasScript),
  };
}

function needsYouLine(entry: HomeStepStatus, hasScript: boolean): string {
  const label = STEP_LABELS[entry.step];
  if (entry.state === 'problem') return `${label} stopped with a problem: open it to see why.`;
  if (entry.step === 'script') {
    return hasScript
      ? 'Read and approve the script.'
      : 'Describe the video, then write the script.';
  }
  if (entry.step === 'voice') return 'Add the voice: record, import or generate it.';
  return `${label} is out of date or waits for your decision.`;
}

/** What waits for the user, one line per step. */
export function needsYouLines(card: HomeProject): { step: HomeStep; text: string }[] {
  return card.steps
    .filter((entry) => entry.state === 'needs-you' || entry.state === 'problem')
    .map((entry) => ({ step: entry.step, text: needsYouLine(entry, card.hasScript) }));
}

export const VOICE_WORDS: Readonly<Record<FilmFacts['voice'], string>> = {
  none: 'Not added yet',
  recorded: 'Recorded or imported',
  elevenlabs: 'Generated with ElevenLabs',
};

/** "14 shots · 12 scenes built", "No storyboard yet". */
export function scenesFact(facts: FilmFacts): string {
  if (facts.shots === 0) return 'No storyboard yet';
  const shots = `${String(facts.shots)} ${facts.shots === 1 ? 'shot' : 'shots'}`;
  return `${shots} · ${String(facts.scenesBuilt)} ${facts.scenesBuilt === 1 ? 'scene' : 'scenes'} built`;
}

/** "30 s" */
export function shortLength(lengthS: number): string {
  return `${String(lengthS)} s`;
}

export interface ShortsButton {
  readonly enabled: boolean;
  /** Why it waits (shown under it); null when enabled. */
  readonly reason: string | null;
}

/** The film overview's "Create 2 shorts (30 s + 60 s)". */
export function shortsButton(overview: ProjectOverview): ShortsButton {
  if (!overview.shortsSupported) return { enabled: false, reason: SHORTS_UNSUPPORTED_MESSAGE };
  if (!overview.card.hasScript) {
    return { enabled: false, reason: 'Needs a script first: Shorts are written from it.' };
  }
  return { enabled: true, reason: null };
}
