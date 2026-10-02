/**
 * The guided tour of the workspace (PLAN.md#10.3): six coach marks on the real panels (found by
 * their accessible names) and the placement of the card next to its target. Pure.
 */

export interface TourStep {
  readonly id: string;
  /** CSS selector of the highlighted element. */
  readonly target: string;
  readonly title: string;
  readonly body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'pipeline',
    target: 'section[aria-label="Pipeline"]',
    title: 'The pipeline',
    body: 'Your video is made in stages, top to bottom. Select a stage for Open, Run and Redo; the "Next:" line above always says what to do now.',
  },
  {
    id: 'preview',
    target: 'section[aria-label="Preview"]',
    title: 'Preview',
    body: 'Press Play (or Space) to watch the video with its voice. It is the same renderer as the export, so what you see is what you get.',
  },
  {
    id: 'shots',
    target: 'section[aria-label="Shots"]',
    title: 'Shots',
    body: 'Every shot of the storyboard with its text and time. Click one to jump to it; Rebuild or Fix a shot that does not look right.',
  },
  {
    id: 'timeline',
    target: 'section[aria-label="Timeline"]',
    title: 'Timeline',
    body: 'Shots, narration, sound cues and audio over time. Drag to scrub, drop sounds on it and fine-tune cues.',
  },
  {
    id: 'chat',
    target: 'section[aria-label="Claude"]',
    title: 'Chat with Claude',
    body: 'Describe a change in plain words ("make the title bigger in this shot"). Claude edits the scene and checks its own frames.',
  },
  {
    id: 'export',
    target: '[data-stage-row="export"]',
    title: 'Export',
    body: 'When it looks right, run Sound design mixed, then Video exported: you get an MP4 ready for YouTube.',
  },
];

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export type CardSide = 'right' | 'left' | 'below' | 'above' | 'center';

export interface CardPlacement {
  readonly left: number;
  readonly top: number;
  readonly side: CardSide;
}

const MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Where the card goes: beside the target where it fits (right, left, below, above), else centred.
 * Always inside the viewport (MARGIN px from its edges).
 */
export function placeTourCard(
  target: Rect | null,
  viewport: Size,
  card: Size,
  gap = 12,
): CardPlacement {
  const maxLeft = viewport.width - card.width - MARGIN;
  const maxTop = viewport.height - card.height - MARGIN;
  if (target === null) {
    return {
      left: clamp((viewport.width - card.width) / 2, MARGIN, maxLeft),
      top: clamp((viewport.height - card.height) / 2, MARGIN, maxTop),
      side: 'center',
    };
  }
  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const alignedTop = clamp(target.top, MARGIN, maxTop);
  const alignedLeft = clamp(target.left, MARGIN, maxLeft);
  if (right + gap + card.width + MARGIN <= viewport.width) {
    return { left: right + gap, top: alignedTop, side: 'right' };
  }
  if (target.left - gap - card.width >= MARGIN) {
    return { left: target.left - gap - card.width, top: alignedTop, side: 'left' };
  }
  if (bottom + gap + card.height + MARGIN <= viewport.height) {
    return { left: alignedLeft, top: bottom + gap, side: 'below' };
  }
  if (target.top - gap - card.height >= MARGIN) {
    return { left: alignedLeft, top: target.top - gap - card.height, side: 'above' };
  }
  return placeTourCard(null, viewport, card, gap);
}
