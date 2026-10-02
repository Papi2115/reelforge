/**
 * Landing check of anchors (PLAN.md §3.3, ±150 ms): for each anchor a scene resolved in build(),
 * is there an sfx cue on it, is it spoken inside the shot, and does the fuzzy resolver agree.
 * Pure, so it is unit-tested without a browser.
 */
import type { ResolvedAnchor, SfxCue } from '@reelforge/engine';
import type { AnchorIndex } from '@reelforge/pipeline';
import { seconds, signedSeconds, timeRange } from '../format.js';

/** A cue within this distance of an anchor lands on it. */
export const LANDING_TOLERANCE_S = 0.15;
/** A cue this close but not within the tolerance most likely meant to land and missed. */
export const NEAR_MISS_S = 0.5;
/** Engine and fuzzy resolver times further apart than this are reported. */
const RESOLVER_AGREEMENT_S = 0.01;

export type AnchorVerdict = 'lands' | 'misses' | 'no-cue' | 'outside-shot';

export interface AnchorCheck {
  readonly phrase: string;
  readonly nth: number;
  /** Global spoken time. */
  readonly t: number;
  readonly tEnd: number;
  /** Time relative to the shot start. */
  readonly local: number;
  readonly verdict: AnchorVerdict;
  /** Nearest cue of the shot and its offset from the anchor (cue - anchor). */
  readonly cue: { readonly name: string; readonly t: number; readonly offset: number } | null;
  /** Time the fuzzy resolver (pipeline AnchorIndex) gives, when it differs from the engine's. */
  readonly fuzzyT: number | null;
}

export interface CueCheck {
  readonly name: string;
  readonly t: number;
  readonly local: number;
  /** On an anchor (within tolerance), near one, free (no anchor near) or outside the shot. */
  readonly verdict: 'on-anchor' | 'near-anchor' | 'free' | 'outside-shot';
}

export interface ShotRange {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

function nearestCue(anchor: ResolvedAnchor, cues: readonly SfxCue[]): AnchorCheck['cue'] {
  let best: AnchorCheck['cue'] = null;
  for (const cue of cues) {
    const offset = cue.t - anchor.t;
    if (best === null || Math.abs(offset) < Math.abs(best.offset))
      best = { name: cue.name, t: cue.t, offset };
  }
  return best;
}

export function checkAnchors(
  shot: ShotRange,
  anchors: readonly ResolvedAnchor[],
  cues: readonly SfxCue[],
  index: AnchorIndex | undefined,
): AnchorCheck[] {
  return anchors.map((anchor) => {
    const cue = nearestCue(anchor, cues);
    const distance = cue === null ? Infinity : Math.abs(cue.offset);
    const inside = anchor.t >= shot.t0 && anchor.t < shot.t1;
    const verdict: AnchorVerdict = !inside
      ? 'outside-shot'
      : distance <= LANDING_TOLERANCE_S
        ? 'lands'
        : distance <= NEAR_MISS_S
          ? 'misses'
          : 'no-cue';
    const fuzzy = index?.resolve(anchor.phrase, anchor.nth);
    const fuzzyT =
      fuzzy?.ok && Math.abs(fuzzy.value.t - anchor.t) > RESOLVER_AGREEMENT_S ? fuzzy.value.t : null;
    return {
      ...anchor,
      local: anchor.t - shot.t0,
      verdict,
      cue: distance <= NEAR_MISS_S ? cue : null,
      fuzzyT,
    };
  });
}

export function checkCues(
  shot: ShotRange,
  cues: readonly SfxCue[],
  anchors: readonly ResolvedAnchor[],
): CueCheck[] {
  return cues.map((cue) => {
    const distance = Math.min(Infinity, ...anchors.map((anchor) => Math.abs(cue.t - anchor.t)));
    const inside = cue.t >= shot.t0 && cue.t <= shot.t1;
    const verdict: CueCheck['verdict'] = !inside
      ? 'outside-shot'
      : distance <= LANDING_TOLERANCE_S
        ? 'on-anchor'
        : distance <= NEAR_MISS_S
          ? 'near-anchor'
          : 'free';
    return { name: cue.name, t: cue.t, local: cue.t - shot.t0, verdict };
  });
}

/** Anchors that miss their cue or are spoken outside the shot, and cues outside the shot. */
export function countSyncProblems(
  anchors: readonly AnchorCheck[],
  cues: readonly CueCheck[],
): number {
  return (
    anchors.filter((anchor) => anchor.verdict === 'misses' || anchor.verdict === 'outside-shot')
      .length + cues.filter((cue) => cue.verdict === 'outside-shot').length
  );
}

export function formatAnchorCheck(check: AnchorCheck, shot: ShotRange): string {
  const head = `"${check.phrase}"${check.nth > 1 ? ` #${String(check.nth)}` : ''} spoken ${timeRange(check.t, check.tEnd)} (local ${seconds(check.local)})`;
  const fuzzy =
    check.fuzzyT === null ? '' : `; note: the fuzzy resolver puts it at ${seconds(check.fuzzyT)}`;
  switch (check.verdict) {
    case 'lands':
      return `ok      ${head}: sfx "${check.cue?.name ?? ''}" lands ${signedSeconds(check.cue?.offset ?? 0)}${fuzzy}`;
    case 'misses':
      return `MISS    ${head}: nearest sfx "${check.cue?.name ?? ''}" is ${signedSeconds(check.cue?.offset ?? 0)} off (allowed ±${seconds(LANDING_TOLERANCE_S)}); schedule it at the anchor time: sfx.at(hit.t, ...)${fuzzy}`;
    case 'no-cue':
      return `info    ${head}: no sfx cue on it (fine when the event is visual only)${fuzzy}`;
    case 'outside-shot':
      return `OUTSIDE ${head}: spoken outside this shot (${timeRange(shot.t0, shot.t1)}); anchor a phrase spoken during the shot, or move the shot boundaries in storyboard.json${fuzzy}`;
  }
}

export function formatCueCheck(cue: CueCheck, shot: ShotRange): string {
  const head = `sfx "${cue.name}" at ${seconds(cue.t)} (local ${seconds(cue.local)})`;
  switch (cue.verdict) {
    case 'on-anchor':
      return `ok      ${head}: on an anchor`;
    case 'near-anchor':
      return `info    ${head}: near an anchor but not on it`;
    case 'free':
      return `info    ${head}: not on any anchor (free cue)`;
    case 'outside-shot':
      return `OUTSIDE ${head}: outside this shot (${timeRange(shot.t0, shot.t1)}); schedule cues within the shot`;
  }
}
