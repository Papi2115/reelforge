/**
 * Programmatic text QA (PLAN.md §4.4): samples a shot's cards over time and reports cards that
 * overlap each other while both are on screen, or that leave the safe area; annotations add target
 * and anchor checks (annotations/check.ts). Messages are written for the scene author (an LLM):
 * card ids, time range, how far off, and how to fix it.
 */
import { checkAnnotations } from '../annotations/check.js';
import type { PixelRect, TextCard } from './types.js';

export interface CardFrame {
  readonly t: number;
  readonly cards: readonly TextCard[];
}

export interface ShotCardTimeline {
  readonly shotId: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea: PixelRect;
  readonly duration: number;
  /** Seconds between samples. */
  readonly step: number;
  readonly frames: readonly CardFrame[];
}

export const CARD_RULES = [
  'card-overlap',
  'card-outside-safe-area',
  'annotation-target-offscreen',
  'annotation-target-hidden',
  'annotation-off-anchor',
  'annotation-anchor',
] as const;
export type CardRule = (typeof CARD_RULES)[number];

/** `info`: not a problem, a record for reports (an annotation landing on its anchor). */
export type CardSeverity = 'error' | 'warning' | 'info';

export interface CardDiagnostic {
  readonly rule: CardRule;
  readonly severity: CardSeverity;
  readonly shotId: string;
  readonly cards: readonly string[];
  /** Local time range (s) of the problem: [t0, t1). */
  readonly t0: number;
  readonly t1: number;
  readonly message: string;
  readonly fix: string;
  /** Annotation anchor rules: the phrase, when the annotation appears and when it is spoken (local s). */
  readonly anchor?:
    { readonly phrase: string; readonly at: number; readonly spokenT: number } | undefined;
}

/** What `collectCardTimeline` needs from a built shot. */
export interface CardSource {
  readonly info: {
    readonly id: string;
    readonly duration: number;
    readonly width: number;
    readonly height: number;
    readonly fps: number;
  };
  readonly safeArea: PixelRect;
  update(localTime: number): void;
  cards(): readonly TextCard[];
}

/** Rounds to microseconds so sample times like 29 * 0.1 print and compare as 2.9. */
function roundTime(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Evaluates the shot every `step` seconds (default one frame) and records the visible cards. */
export function collectCardTimeline(shot: CardSource, step = 1 / shot.info.fps): ShotCardTimeline {
  const { id, duration, width, height } = shot.info;
  const frames: CardFrame[] = [];
  const count = Math.max(1, Math.ceil(duration / step - 1e-9));
  for (let index = 0; index < count; index += 1) {
    const t = roundTime(index * step);
    shot.update(t);
    frames.push({ t, cards: shot.cards().filter((card) => card.visible) });
  }
  return { shotId: id, width, height, safeArea: shot.safeArea, duration, step, frames };
}

function intersection(first: PixelRect, second: PixelRect): PixelRect | undefined {
  const x = Math.max(first.x, second.x);
  const y = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.w, second.x + second.w);
  const bottom = Math.min(first.y + first.h, second.y + second.h);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : undefined;
}

interface Overflow {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function overflow(box: PixelRect, area: PixelRect): Overflow {
  return {
    left: Math.max(0, area.x - box.x),
    right: Math.max(0, box.x + box.w - (area.x + area.w)),
    top: Math.max(0, area.y - box.y),
    bottom: Math.max(0, box.y + box.h - (area.y + area.h)),
  };
}

const SIDES = ['left', 'right', 'top', 'bottom'] as const;

function maxOverflow(first: Overflow, second: Overflow): Overflow {
  return {
    left: Math.max(first.left, second.left),
    right: Math.max(first.right, second.right),
    top: Math.max(first.top, second.top),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

function isOutside(value: Overflow): boolean {
  return SIDES.some((side) => value[side] > 0);
}

function seconds(value: number): string {
  return value.toFixed(2);
}

function rect(value: PixelRect): string {
  return `x ${String(value.x)}–${String(value.x + value.w)}, y ${String(value.y)}–${String(value.y + value.h)}`;
}

interface Run<T> {
  first: number;
  last: number;
  detail: T;
}

/** Groups per-frame findings by key into runs of consecutive frames. */
function collectRuns<T>(
  frames: readonly CardFrame[],
  find: (frame: CardFrame) => ReadonlyMap<string, T>,
  merge: (previous: T, next: T) => T,
): { key: string; run: Run<T> }[] {
  const open = new Map<string, Run<T>>();
  const done: { key: string; run: Run<T> }[] = [];
  frames.forEach((frame, index) => {
    const found = find(frame);
    for (const [key, run] of open) {
      if (found.has(key)) continue;
      done.push({ key, run });
      open.delete(key);
    }
    for (const [key, detail] of found) {
      const run = open.get(key);
      if (run) {
        run.last = index;
        run.detail = merge(run.detail, detail);
      } else {
        open.set(key, { first: index, last: index, detail });
      }
    }
  });
  for (const [key, run] of open) done.push({ key, run });
  return done;
}

interface OverlapDetail {
  readonly ids: readonly [string, string];
  readonly area: PixelRect;
  readonly annotation: boolean;
}

function overlapsIn(frame: CardFrame): Map<string, OverlapDetail> {
  const found = new Map<string, OverlapDetail>();
  const cards = frame.cards.filter((card) => card.box.w > 0 && card.box.h > 0);
  cards.forEach((first, index) => {
    for (const second of cards.slice(index + 1)) {
      const area = intersection(first.box, second.box);
      if (!area) continue;
      const ids = [first.id, second.id].sort() as [string, string];
      const annotation = first.kind === 'annotation' || second.kind === 'annotation';
      found.set(JSON.stringify(ids), { ids, area, annotation });
    }
  });
  return found;
}

function biggerArea(previous: OverlapDetail, next: OverlapDetail): OverlapDetail {
  return next.area.w * next.area.h > previous.area.w * previous.area.h ? next : previous;
}

export function checkCards(timeline: ShotCardTimeline): CardDiagnostic[] {
  const { frames, shotId, safeArea, width, height } = timeline;
  const range = (run: Run<unknown>): { t0: number; t1: number } => ({
    t0: frames[run.first]?.t ?? 0,
    t1: Math.min(timeline.duration, roundTime((frames[run.last]?.t ?? 0) + timeline.step)),
  });
  const diagnostics: CardDiagnostic[] = [];

  for (const { run } of collectRuns(frames, overlapsIn, biggerArea)) {
    const { t0, t1 } = range(run);
    const [first, second] = run.detail.ids;
    const { area } = run.detail;
    diagnostics.push({
      rule: 'card-overlap',
      severity: 'error',
      shotId,
      cards: run.detail.ids,
      t0,
      t1,
      message: `cards "${first}" and "${second}" overlap by ${String(area.w)}x${String(area.h)} px (${rect(area)}) during t=${seconds(t0)}–${seconds(t1)} s of shot ${shotId}`,
      fix: run.detail.annotation
        ? 'Move one of them (annotation pos / side / nudge, or the text card pos), make their at–until windows not overlap, or drop one: one label at a time reads best.'
        : 'Move one card (pos / side / valign), make their at–until windows not overlap, or shrink one (scale / maxWidth) so both stay readable.',
    });
  }

  const outside = (frame: CardFrame): Map<string, Overflow> =>
    new Map(
      frame.cards
        .filter((card) => card.box.w > 0 && card.box.h > 0)
        .map((card) => [card.id, overflow(card.box, safeArea)] as const)
        .filter(([, value]) => isOutside(value)),
    );
  const frameRect = { x: 0, y: 0, w: width, h: height };
  for (const { key, run } of collectRuns(frames, outside, maxOverflow)) {
    const { t0, t1 } = range(run);
    const sides = SIDES.filter((side) => run.detail[side] > 0)
      .map((side) => `${String(run.detail[side])} px past the ${side} edge`)
      .join(', ');
    const lastBox = frames[run.last]?.cards.find((card) => card.id === key)?.box;
    const clipped = lastBox !== undefined && isOutside(overflow(lastBox, frameRect));
    diagnostics.push({
      rule: 'card-outside-safe-area',
      severity: 'error',
      shotId,
      cards: [key],
      t0,
      t1,
      message: `card "${key}" extends outside the safe area (${rect(safeArea)} of ${String(width)}x${String(height)}) during t=${seconds(t0)}–${seconds(t1)} s of shot ${shotId}: ${sides}${clipped ? '; part of it is cut off by the frame edge' : ''}`,
      fix: 'Move it inward (pos inside the safe area; align so the text grows away from the edge), lower its scale, or set maxWidth so it wraps.',
    });
  }

  diagnostics.push(...checkAnnotations(timeline));
  return diagnostics.sort(
    (first, second) => first.t0 - second.t0 || first.rule.localeCompare(second.rule),
  );
}

/** Diagnostics that are problems (errors and warnings, not `info` records). */
export function cardProblems(diagnostics: readonly CardDiagnostic[]): CardDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity !== 'info');
}

/** One line per problem (`[rule] message. Fix: ...`), for logs and LLM prompts; info is skipped. */
export function formatCardDiagnostics(diagnostics: readonly CardDiagnostic[]): string {
  return cardProblems(diagnostics)
    .map((diagnostic) => `[${diagnostic.rule}] ${diagnostic.message}. Fix: ${diagnostic.fix}`)
    .join('\n');
}
