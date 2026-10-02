/**
 * Sync check (PLAN.md §3.3, #7.7): does every event of a shot land on its spoken word within
 * ±150 ms? Events: the scene's anchors (its visual hits; their time is checked against the words
 * file through the fuzzy resolver), the scene's `sfx.at` cues and the `cues.json` sfx of the shot,
 * each measured against the nearest anchor of the shot. Pure, so it is unit-tested directly.
 */
import type { ResolvedAnchor } from '@reelforge/engine';
import type { AnchorIndex } from '@reelforge/pipeline';
import type { QaFinding, ShotSync, SyncEvent, SyncVerdict } from '@reelforge/shared';
import { finding } from './checks.js';

/** An event within this distance of its spoken word lands on it. */
export const SYNC_TOLERANCE_S = 0.15;
/** A cue further than this from every anchor is a free cue (not meant to land on a word). */
export const SYNC_NEAR_S = 0.5;

export interface ShotRange {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
}

export interface TimedCue {
  /** Global time (s). */
  readonly t: number;
  readonly name: string;
}

export interface ShotSyncInput {
  readonly shot: ShotRange;
  /** Anchors the scene resolved (global time); other shots' anchors are ignored. */
  readonly anchors: readonly ResolvedAnchor[];
  /** The scene's own `sfx.at` cues (global time). */
  readonly sceneCues: readonly TimedCue[];
  /** `cues.json` sfx inside the shot (global time). */
  readonly projectCues?: readonly TimedCue[];
  /** Fuzzy resolver over `timing/words.json` (absent: anchors are taken as resolved). */
  readonly words?: AnchorIndex | undefined;
}

const ms = (seconds: number): number => Math.round(seconds * 1000);

function verdictOf(deltaS: number): SyncVerdict {
  return Math.abs(deltaS) <= SYNC_TOLERANCE_S + 1e-9 ? 'ok' : 'off';
}

function anchorEvent(input: ShotSyncInput, anchor: ResolvedAnchor): SyncEvent {
  const { shot } = input;
  const resolved = input.words?.resolve(anchor.phrase, anchor.nth);
  const spokenT = resolved?.ok === true ? resolved.value.t : anchor.t;
  const delta = anchor.t - spokenT;
  const inside = anchor.t >= shot.t0 && anchor.t < shot.t1;
  return {
    kind: 'anchor',
    label: anchor.nth > 1 ? `${anchor.phrase} #${String(anchor.nth)}` : anchor.phrase,
    t: anchor.t,
    spokenT,
    phrase: anchor.phrase,
    deltaMs: ms(delta),
    verdict: inside ? verdictOf(delta) : 'outside-shot',
  };
}

function cueEvent(
  shot: ShotRange,
  anchors: readonly ResolvedAnchor[],
  cue: TimedCue,
  kind: 'sfx' | 'cue',
): SyncEvent {
  let nearest: ResolvedAnchor | undefined;
  for (const anchor of anchors) {
    if (nearest === undefined || Math.abs(cue.t - anchor.t) < Math.abs(cue.t - nearest.t)) {
      nearest = anchor;
    }
  }
  const inside = cue.t >= shot.t0 && cue.t <= shot.t1;
  const near = nearest !== undefined && Math.abs(cue.t - nearest.t) <= SYNC_NEAR_S;
  const matched = near ? nearest : undefined;
  const delta = matched === undefined ? undefined : cue.t - matched.t;
  return {
    kind,
    label: cue.name,
    t: cue.t,
    spokenT: matched?.t ?? null,
    phrase: matched?.phrase ?? null,
    deltaMs: delta === undefined ? null : ms(delta),
    verdict: !inside ? 'outside-shot' : delta === undefined ? 'free' : verdictOf(delta),
  };
}

export function shotSyncEvents(input: ShotSyncInput): SyncEvent[] {
  const anchors = input.anchors.filter((anchor) => anchor.shotId === input.shot.id);
  return [
    ...anchors.map((anchor) => anchorEvent(input, anchor)),
    ...input.sceneCues.map((cue) => cueEvent(input.shot, anchors, cue, 'sfx')),
    ...(input.projectCues ?? []).map((cue) => cueEvent(input.shot, anchors, cue, 'cue')),
  ].sort((first, second) => first.t - second.t);
}

export function isSyncProblem(event: SyncEvent): boolean {
  return event.verdict === 'off' || event.verdict === 'outside-shot';
}

export function shotSync(shot: ShotRange, events: readonly SyncEvent[], error?: string): ShotSync {
  const deltas = events.flatMap((event) =>
    event.deltaMs === null ? [] : [Math.abs(event.deltaMs)],
  );
  return {
    shotId: shot.id,
    t0: shot.t0,
    t1: shot.t1,
    events: [...events],
    problems: events.filter(isSyncProblem).length,
    maxDeltaMs: deltas.length === 0 ? null : Math.max(...deltas),
    ...(error === undefined ? {} : { error }),
  };
}

export function describeSyncEvent(event: SyncEvent, shot: ShotRange): string {
  const what =
    event.kind === 'anchor' ? `anchor "${event.label}"` : `${event.kind} "${event.label}"`;
  const at = `at ${event.t.toFixed(2)} s (local ${(event.t - shot.t0).toFixed(2)} s)`;
  switch (event.verdict) {
    case 'ok':
      return `${what} ${at} lands on "${event.phrase ?? ''}" (${String(event.deltaMs)} ms)`;
    case 'free':
      return `${what} ${at} is not near any anchor (free cue)`;
    case 'off':
      return event.kind === 'anchor'
        ? `${what} ${at} is ${String(event.deltaMs)} ms away from where the words file puts "${event.phrase ?? ''}" (${(event.spokenT ?? 0).toFixed(2)} s); anchor the exact spoken phrase`
        : `${what} ${at} misses "${event.phrase ?? ''}" (spoken ${(event.spokenT ?? 0).toFixed(2)} s) by ${String(event.deltaMs)} ms (allowed ±${String(ms(SYNC_TOLERANCE_S))} ms); schedule it at the anchor time: sfx.at(hit.t, …)`;
    case 'outside-shot':
      return `${what} ${at} is outside the shot (${shot.t0.toFixed(2)}–${shot.t1.toFixed(2)} s); anchor a phrase spoken during the shot and keep cues inside it`;
  }
}

export function syncFindings(events: readonly SyncEvent[], shot: ShotRange): QaFinding[] {
  return events
    .filter(isSyncProblem)
    .map((event) =>
      finding('sync', 'error', describeSyncEvent(event, shot), { t: event.t - shot.t0 }),
    );
}
