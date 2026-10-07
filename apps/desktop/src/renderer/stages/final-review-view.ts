/**
 * View model of the final review (PLAN.md#11.5): its one-line summary ("Review done: 13 ✓, 3 ⚠"),
 * the live line while it runs ("Reviewing… 7/16") and the export pre-flight — the ⚠/✗ shots with
 * what is left, a seek target each, and whether something blocks the export (a scene that cannot
 * render at all). A shot rebuilt after the review shows its newer scenes-report result. Pure.
 */
import {
  SHOT_STATUS_SYMBOLS,
  type FinalReview,
  type QaFinding,
  type ScenesReport,
  type ShotBuildStatus,
  type StoryboardShot,
} from '@reelforge/shared';
import type { StageRunView } from '../../shared/stages-contract.js';
import { findingLabel } from './scenes-view.js';

/** Findings that mean the scene does not render at all (the export would fail). */
const UNRENDERABLE = new Set<QaFinding['source']>(['scene', 'runtime']);

export function finalReviewSummary(review: FinalReview | null): string | null {
  if (review === null) return null;
  const { counts } = review;
  const statuses = (['ok', 'warning', 'failed'] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => `${String(counts[status])} ${SHOT_STATUS_SYMBOLS[status]}`)
    .join(', ');
  const fixed = counts.fixed > 0 ? ` · fixed ${String(counts.fixed)}` : '';
  const locked = counts.locked > 0 ? ` · ${String(counts.locked)} locked` : '';
  return `Review done: ${statuses === '' ? 'no shots' : statuses}${fixed}${locked}`;
}

/** The running final review's progress line, else null. */
export function finalReviewProgress(running: StageRunView | null): string | null {
  if (running?.stage !== 'scenes' || running.action !== 'final-review') return null;
  return running.label ?? 'Reviewing…';
}

export interface PreflightItem {
  readonly shotId: string;
  readonly status: Exclude<ShotBuildStatus, 'ok'>;
  readonly symbol: string;
  readonly locked: boolean;
  /** Where to seek (the shot's start). */
  readonly t: number;
  /** What is left, one line. */
  readonly text: string;
  /** The scene cannot render at all. */
  readonly blocking: boolean;
}

export interface Preflight {
  readonly items: readonly PreflightItem[];
  /** The export cannot run until these render (null = it can). */
  readonly blocker: string | null;
  /** "Review done: …", or why there is no review to rely on. */
  readonly summary: string;
}

interface ShotResult {
  readonly status: ShotBuildStatus;
  readonly findings: readonly QaFinding[];
  readonly locked: boolean;
  readonly outOfSync: boolean;
}

function shotResults(
  review: FinalReview | null,
  scenes: ScenesReport | null,
): Map<string, ShotResult> {
  const results = new Map<string, ShotResult>();
  const reviewedAt = review === null ? '' : review.finishedAt;
  for (const entry of review?.shots ?? []) results.set(entry.shotId, entry);
  for (const record of scenes?.shots ?? []) {
    // A shot built or fixed after the review: its newer result counts.
    if (record.updatedAt > reviewedAt) {
      const previous = results.get(record.shotId);
      results.set(record.shotId, {
        status: record.status,
        findings: record.findings,
        locked: previous?.locked ?? false,
        outOfSync: previous?.outOfSync ?? false,
      });
    }
  }
  return results;
}

function itemText(result: ShotResult): string {
  const first = result.findings[0];
  const more = result.findings.length > 1 ? ` (+${String(result.findings.length - 1)} more)` : '';
  if (first !== undefined) return `${findingLabel(first.source)}: ${first.message}${more}`;
  return result.outOfSync ? 'locked, may be out of sync with the voice-over' : 'needs a look';
}

/**
 * `built`: shots whose scene file is on disk (scenes-view.ts builtShotIds), so a project with
 * scenes but no scenes report reads "not checked", not "not built".
 */
export function exportPreflight(
  review: FinalReview | null,
  scenes: ScenesReport | null,
  shots: readonly StoryboardShot[],
  built: ReadonlySet<string> = new Set(),
): Preflight {
  const results = shotResults(review, scenes);
  const items = shots.flatMap((shot): PreflightItem[] => {
    const result = results.get(shot.id);
    if (result === undefined || (result.status === 'ok' && !result.outOfSync)) return [];
    const status = result.status === 'ok' ? 'warning' : result.status;
    return [
      {
        shotId: shot.id,
        status,
        symbol: SHOT_STATUS_SYMBOLS[status],
        locked: result.locked,
        t: shot.t0,
        text: itemText(result),
        blocking:
          result.status === 'failed' &&
          result.findings.some((finding) => finding.fatal && UNRENDERABLE.has(finding.source)),
      },
    ];
  });
  const blocked = items.filter((item) => item.blocking).map((item) => item.shotId);
  return {
    items,
    blocker:
      blocked.length === 0
        ? null
        : `${blocked.join(', ')} cannot render: rebuild or fix ${blocked.length === 1 ? 'it' : 'them'} first.`,
    summary:
      finalReviewSummary(review) ??
      (scenes === null && built.size === 0
        ? 'Scenes are not built yet.'
        : 'Not checked yet: press Run final review.'),
  };
}
