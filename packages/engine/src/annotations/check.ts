/**
 * Annotation QA on a sampled card timeline (PLAN.md#11.8): targets that leave the frame or hide
 * behind geometry while their annotation is shown, and annotations that miss their spoken phrase
 * (±150 ms). Warnings: the shot renders, but the mark points at nothing or comes at the wrong time.
 */
import type { CardDiagnostic, ShotCardTimeline } from '../text/check-cards.js';

/** An annotation within this distance of its spoken phrase lands on it (as the sync report). */
export const ANNOTATION_SYNC_TOLERANCE_S = 0.15;
/** Problems shorter than this (s) are ignored (a target grazing the frame edge for a frame). */
const MIN_PROBLEM_S = 0.1;

interface Span {
  first: number;
  last: number;
  label: string;
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function seconds(value: number): string {
  return value.toFixed(2);
}

type TargetIssue = 'offscreen' | 'hidden';

function collectSpans(timeline: ShotCardTimeline, issue: TargetIssue): Map<string, Span[]> {
  const spans = new Map<string, Span[]>();
  timeline.frames.forEach((frame, index) => {
    for (const card of frame.cards) {
      for (const probe of card.annotation?.targets ?? []) {
        const bad =
          issue === 'offscreen' ? !probe.onScreen : probe.onScreen && probe.occluded === true;
        if (!bad) continue;
        const key = `${card.id}\u0000${probe.role}`;
        const list = spans.get(key) ?? [];
        const open = list.at(-1);
        if (open && open.last === index - 1) open.last = index;
        else list.push({ first: index, last: index, label: probe.label });
        spans.set(key, list);
      }
    }
  });
  return spans;
}

function targetDiagnostics(timeline: ShotCardTimeline, issue: TargetIssue): CardDiagnostic[] {
  const { frames, step, shotId } = timeline;
  const diagnostics: CardDiagnostic[] = [];
  for (const [key, list] of collectSpans(timeline, issue)) {
    const [id = '', role = 'target'] = key.split('\u0000');
    for (const span of list) {
      const t0 = frames[span.first]?.t ?? 0;
      const t1 = Math.min(timeline.duration, round((frames[span.last]?.t ?? 0) + step));
      if (t1 - t0 < MIN_PROBLEM_S - 1e-9) continue;
      const where =
        issue === 'offscreen'
          ? 'is outside the frame (or behind the camera)'
          : 'is hidden behind other geometry';
      diagnostics.push({
        rule: issue === 'offscreen' ? 'annotation-target-offscreen' : 'annotation-target-hidden',
        severity: 'warning',
        shotId,
        cards: [id],
        t0,
        t1,
        message: `annotation "${id}" points (${role}) at ${span.label}, which ${where} during t=${seconds(t0)}–${seconds(t1)} s of shot ${shotId}`,
        fix:
          issue === 'offscreen'
            ? 'Keep the target in view while the annotation is shown (aim or pull back the camera, shorten at–until) or point at something on screen.'
            : 'Move the camera or the object so nothing covers the target, use an anchor on the visible side, or give pins occlude: true so they hide while it is covered.',
      });
    }
  }
  return diagnostics;
}

/**
 * One diagnostic per annotation with a `phrase`: `annotation-anchor` (info, on time; for the sync
 * report) or `annotation-off-anchor` (warning) when it misses the spoken phrase.
 */
function anchorDiagnostics(timeline: ShotCardTimeline): CardDiagnostic[] {
  const seen = new Set<string>();
  const diagnostics: CardDiagnostic[] = [];
  for (const frame of timeline.frames) {
    for (const card of frame.cards) {
      const anchor = card.annotation?.anchor;
      if (!anchor || seen.has(card.id)) continue;
      seen.add(card.id);
      const deltaMs = Math.round((card.at - anchor.spokenT) * 1000);
      const onTime = Math.abs(card.at - anchor.spokenT) <= ANNOTATION_SYNC_TOLERANCE_S + 1e-9;
      const timing = { phrase: anchor.phrase, at: card.at, spokenT: anchor.spokenT };
      const shot = timeline.shotId;
      diagnostics.push(
        onTime
          ? {
              rule: 'annotation-anchor',
              severity: 'info',
              shotId: shot,
              cards: [card.id],
              t0: card.at,
              t1: card.at,
              message: `annotation "${card.id}" at t=${seconds(card.at)} s lands on "${anchor.phrase}" (${String(deltaMs)} ms)`,
              fix: '',
              anchor: timing,
            }
          : {
              rule: 'annotation-off-anchor',
              severity: 'warning',
              shotId: shot,
              cards: [card.id],
              t0: card.at,
              t1: card.at,
              message: `annotation "${card.id}" appears at t=${seconds(card.at)} s but its phrase "${anchor.phrase}" is spoken at ${seconds(anchor.spokenT)} s (${deltaMs > 0 ? '+' : ''}${String(deltaMs)} ms; allowed ±${String(ANNOTATION_SYNC_TOLERANCE_S * 1000)} ms) in shot ${shot}`,
              fix: 'Drop the explicit at (the phrase option sets it) or set at to ctx.anchor(phrase).t.',
              anchor: timing,
            },
      );
    }
  }
  return diagnostics;
}

export function checkAnnotations(timeline: ShotCardTimeline): CardDiagnostic[] {
  return [
    ...targetDiagnostics(timeline, 'offscreen'),
    ...targetDiagnostics(timeline, 'hidden'),
    ...anchorDiagnostics(timeline),
  ];
}
