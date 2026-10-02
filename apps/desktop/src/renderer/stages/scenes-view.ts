/**
 * View model of Scenes built in the UI (PLAN.md#7.4-7.7): the ✓/⚠/✗ badge of every shot (the
 * scenes report, overlaid with the live run: building / left for later), its findings for the
 * popover and the "Fix with Claude…" prefill, the build progress line (shot n/m, current step),
 * the missing-props banner and the sync report rows (deltas in ms against ±150 ms). Pure.
 */
import {
  SHOT_STATUS_SYMBOLS,
  type MissingPropsFile,
  type ScenesReport,
  type ShotBuildRecord,
  type SyncReport,
} from '@reelforge/shared';
import type { StageRunView } from '../../shared/stages-contract.js';

export type BadgeTone = 'ok' | 'warning' | 'failed' | 'running' | 'pending';

export interface ShotBadge {
  readonly tone: BadgeTone;
  readonly symbol: string;
  /** Short status for the tooltip / screen readers. */
  readonly label: string;
  readonly findings: readonly string[];
  readonly critic: readonly string[];
  readonly missingProps: readonly string[];
  readonly notes: readonly string[];
}

const TONE_LABELS: Readonly<Record<BadgeTone, string>> = {
  ok: 'Built, QA clean',
  warning: 'Built with warnings',
  failed: 'Failed QA',
  running: 'Building…',
  pending: 'Waiting to be built',
};

function recordBadge(record: ShotBuildRecord): ShotBadge {
  return {
    tone: record.status,
    symbol: SHOT_STATUS_SYMBOLS[record.status],
    label: TONE_LABELS[record.status],
    findings: record.findings.map(
      (finding) =>
        `${finding.source}${finding.t === undefined ? '' : ` @${finding.t.toFixed(1)} s`}: ${finding.message}`,
    ),
    critic: record.critic
      .filter((verdict) => verdict.verdict !== 'ok' || verdict.note !== '')
      .map((verdict) => `${verdict.verdict}: ${verdict.note}`),
    missingProps: record.missingProps,
    notes: record.notes,
  };
}

function liveBadge(tone: 'running' | 'pending'): ShotBadge {
  return {
    tone,
    symbol: tone === 'running' ? '…' : '·',
    label: TONE_LABELS[tone],
    findings: [],
    critic: [],
    missingProps: [],
    notes: [],
  };
}

/** Badge per shot id: the report, with shots of the running scene build on top. */
export function shotBadges(
  report: ScenesReport | null,
  running: StageRunView | null,
): ReadonlyMap<string, ShotBadge> {
  const badges = new Map<string, ShotBadge>(
    (report?.shots ?? []).map((record) => [record.shotId, recordBadge(record)]),
  );
  if (running?.stage !== 'scenes') return badges;
  for (const [id, state] of Object.entries(running.shots)) {
    if (state === 'running') badges.set(id, liveBadge('running'));
    else if (state === 'requeued') badges.set(id, liveBadge('pending'));
  }
  return badges;
}

/** "Fix with Claude…" text for the chat (scope Shot). */
export function fixPrompt(shotId: string, badge: ShotBadge | undefined): string {
  const lines = [...(badge?.findings ?? []), ...(badge?.critic ?? [])];
  if (lines.length === 0) return `Shot ${shotId} needs a fix: `;
  return `Fix shot ${shotId}. QA found:\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

/** `Building shot 3/8 · s03: QA build round 1`, or null when no scene build runs. */
export function buildProgress(running: StageRunView | null, totalShots: number): string | null {
  if (running?.stage !== 'scenes') return null;
  const total = running.targets?.length ?? totalShots;
  const states = Object.values(running.shots);
  const finished = states.filter((state) => state !== 'running' && state !== 'requeued').length;
  const current = Math.min(total, finished + (states.includes('running') ? 1 : 0));
  const what = running.action === null ? 'Building' : 'Reviewing';
  const step = running.label === null ? '' : ` · ${running.label}`;
  return `${what} shot ${String(Math.max(current, 1))}/${String(total)}${step}`;
}

/** Props the kit lacks (scenes report + the app's log), sorted. */
export function missingProps(
  report: ScenesReport | null,
  log: MissingPropsFile | null,
): readonly string[] {
  const names = new Set<string>();
  for (const record of report?.shots ?? []) for (const name of record.missingProps) names.add(name);
  for (const entry of log?.entries ?? []) names.add(entry.name);
  return [...names].sort();
}

export function missingPropsBanner(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  return `Kit is missing: ${names.join(', ')} — these shots use a fallback. (Extending the kit is done by the developer.)`;
}

export interface SyncRow {
  readonly key: string;
  readonly shotId: string;
  /** Global time to seek to (the event, else the shot start). */
  readonly t: number;
  readonly what: string;
  readonly delta: string;
  readonly tone: 'ok' | 'off' | 'free';
  readonly verdict: string;
}

function signedMs(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${String(Math.abs(Math.round(value)))} ms`;
}

/** One row per event (or per shot without events / that failed to load). */
export function syncRows(report: SyncReport | null): readonly SyncRow[] {
  if (report === null) return [];
  const tolerance = `±${String(report.toleranceMs)} ms`;
  return report.shots.flatMap((shot): SyncRow[] => {
    if (shot.error !== undefined || shot.events.length === 0) {
      return [
        {
          key: shot.shotId,
          shotId: shot.shotId,
          t: shot.t0,
          what: shot.error ?? 'no anchored events',
          delta: '—',
          tone: shot.error === undefined ? 'free' : 'off',
          verdict: shot.error === undefined ? 'nothing to check' : 'not loaded',
        },
      ];
    }
    return shot.events.map((event, index) => {
      const tone = event.verdict === 'ok' ? 'ok' : event.verdict === 'free' ? 'free' : 'off';
      const verdict =
        event.verdict === 'ok'
          ? `within ${tolerance}`
          : event.verdict === 'off'
            ? `off (over ${tolerance})`
            : event.verdict === 'free'
              ? 'no spoken word near'
              : 'outside the shot';
      return {
        key: `${shot.shotId}:${String(index)}`,
        shotId: shot.shotId,
        t: event.t,
        what: `${event.kind} “${event.label}”${event.phrase === null || event.phrase === event.label ? '' : ` → “${event.phrase}”`}`,
        delta: event.deltaMs === null ? '—' : signedMs(event.deltaMs),
        tone,
        verdict,
      };
    });
  });
}

/** Shots with sync problems (for "Fix sync issues"). */
export function syncProblemShots(report: SyncReport | null): readonly string[] {
  return (report?.shots ?? []).filter((shot) => shot.problems > 0).map((shot) => shot.shotId);
}
