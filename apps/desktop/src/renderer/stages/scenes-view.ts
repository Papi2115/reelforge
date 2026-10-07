/**
 * View model of Scenes built in the UI (PLAN.md#7.4-7.7): the ✓/⚠/✗ badge of every shot (the
 * scenes report, overlaid with the live run: building / left for later; scenes on disk without a
 * report read "Not checked", never "Not built"), the panel's totals, its findings for the
 * popover and the "Fix with Claude…" prefill, the build progress line (shot n/m, current step),
 * the project-props and project-roles banner (built / could not build) and the sync report rows (deltas in ms
 * against ±150 ms). Pure.
 */
import {
  SHOT_STATUS_SYMBOLS,
  type PropsReport,
  type QaFinding,
  type RolesReport,
  type ScenesReport,
  type ShotBuildRecord,
  type StoryboardShot,
  type SyncReport,
} from '@reelforge/shared';
import { plural } from '../../shared/plural.js';
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
  /** Project props (kit-ext) built for this shot. */
  readonly builtProps: readonly string[];
  readonly notes: readonly string[];
}

const TONE_LABELS: Readonly<Record<BadgeTone, string>> = {
  ok: 'Built, QA clean',
  warning: 'Built with warnings',
  failed: 'Failed QA',
  running: 'Building…',
  pending: 'Waiting to be built',
};

/** Finding sources in plain words (docs/ui-copy.md); the others keep their short id. */
const FINDING_SOURCE_LABELS: Partial<Record<QaFinding['source'], string>> = {
  slop: 'Looks generic',
};

/** The label a finding starts with: "Looks generic" for the anti-slop guards, else its source. */
export function findingLabel(source: QaFinding['source']): string {
  return FINDING_SOURCE_LABELS[source] ?? source;
}

/** One finding line: "lint @1.2 s: …", "Looks generic: invented text …". */
export function findingText(finding: QaFinding): string {
  const at = finding.t === undefined ? '' : ` @${finding.t.toFixed(1)} s`;
  return `${findingLabel(finding.source)}${at}: ${finding.message}`;
}

function recordBadge(record: ShotBuildRecord): ShotBadge {
  return {
    tone: record.status,
    symbol: SHOT_STATUS_SYMBOLS[record.status],
    label: TONE_LABELS[record.status],
    findings: record.findings.map(findingText),
    critic: record.critic
      .filter((verdict) => verdict.verdict !== 'ok' || verdict.note !== '')
      .map((verdict) => `${verdict.verdict}: ${verdict.note}`),
    missingProps: record.missingProps,
    builtProps: record.builtProps ?? [],
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
    builtProps: [],
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

/**
 * Shots whose scene file is in the project listing (forward slashes), whatever the reports say:
 * a project can carry built scenes without a scenes report (the example, a copied folder).
 */
export function builtShotIds(
  shots: readonly StoryboardShot[],
  files: readonly string[],
): ReadonlySet<string> {
  const listed = new Set(files);
  return new Set(
    shots.filter((shot) => listed.has(shot.scene.replaceAll('\\', '/'))).map((shot) => shot.id),
  );
}

/** Status of a shot without a badge: its scene exists but nothing checked it, or it is not built. */
export function missingBadgeLabel(shotId: string, built: ReadonlySet<string>): string {
  return built.has(shotId) ? 'Not checked' : 'Not built yet';
}

export type ScenesTotals =
  | { readonly kind: 'none' }
  /** Scenes on disk, no check result for any of them: "7 scenes built · not checked yet". */
  | { readonly kind: 'unchecked'; readonly text: string }
  | {
      readonly kind: 'checked';
      readonly ok: number;
      readonly warning: number;
      readonly failed: number;
      /** Shots with a check result. */
      readonly checked: number;
      /** Built shots (scene file on disk) without a check result. */
      readonly unchecked: number;
    };

/** The Scenes panel's totals from the scenes report and the scene files on disk. */
export function scenesTotals(
  report: ScenesReport | null,
  built: ReadonlySet<string>,
): ScenesTotals {
  const records = report?.shots ?? [];
  const checkedIds = new Set(records.map((record) => record.shotId));
  const unchecked = [...built].filter((id) => !checkedIds.has(id)).length;
  if (records.length === 0) {
    return unchecked === 0
      ? { kind: 'none' }
      : { kind: 'unchecked', text: `${plural(unchecked, 'scene')} built · not checked yet` };
  }
  const count = (status: ShotBuildRecord['status']): number =>
    records.filter((record) => record.status === status).length;
  return {
    kind: 'checked',
    ok: count('ok'),
    warning: count('warning'),
    failed: count('failed'),
    checked: records.length,
    unchecked,
  };
}

/** "Fix with Claude…" text for the chat (scope Shot). */
export function fixPrompt(shotId: string, badge: ShotBadge | undefined): string {
  const lines = [...(badge?.findings ?? []), ...(badge?.critic ?? [])];
  if (lines.length === 0) return `Shot ${shotId} needs a fix: `;
  return `Fix shot ${shotId}. QA found:\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

/** A runner step label in plain words ("Claude: critic s03" -> "Claude checks the frames"). */
export function stepText(label: string | null): string {
  if (label === null) return 'starting';
  if (/^Claude: scene-build\b/.test(label)) return 'Claude writes the scene';
  if (/^Claude: critic\b/.test(label)) return 'Claude checks the frames';
  const qa = /QA \S+ round (\d+)/.exec(label);
  if (qa) return `checking frames (round ${qa[1] ?? '1'})`;
  if (label.startsWith('Claude: ')) return label;
  // "s03: building the scene" -> "building the scene" (the shot is in the title).
  return label.replace(/^[A-Za-z0-9_-]+: /, '');
}

export interface BuildProgressView {
  /** "Shot 3 of 8" (the final review: "Final review"). */
  readonly title: string;
  /** What happens now, in plain words. */
  readonly step: string;
  /** Building / reviewing / final review / designing (look assets). */
  readonly what: string;
  /** Finished share of the run's shots, 0..100. */
  readonly percent: number;
}

/** Progress of a running scene build or review, or null when none runs. */
export function buildProgressView(
  running: StageRunView | null,
  totalShots: number,
): BuildProgressView | null {
  if (running?.stage !== 'scenes') return null;
  // The final review counts its shots in its own step label ("Reviewing… 7/16").
  if (running.action === 'final-review') {
    return {
      title: 'Final review',
      step: running.label ?? 'starting',
      what: 'Final review',
      percent: running.percent ?? 0,
    };
  }
  // A world film's look assets (PLAN.md#13.15): one set for the film, no shots to count.
  if (running.action === 'world-assets') {
    return {
      title: 'Designing look assets',
      step: stepText(running.label),
      what: 'Designing',
      percent: running.percent ?? 0,
    };
  }
  const total = Math.max(running.targets?.length ?? totalShots, 1);
  const states = Object.values(running.shots);
  const finished = states.filter((state) => state !== 'running' && state !== 'requeued').length;
  const current = Math.max(1, Math.min(total, finished + (states.includes('running') ? 1 : 0)));
  return {
    title: `Shot ${String(current)} of ${String(total)}`,
    step: stepText(running.label),
    what: running.action === null ? 'Building' : 'Reviewing',
    percent: Math.min(100, (100 * finished) / total),
  };
}

/** `Building · shot 3 of 8 · checking frames`, or null when no scene build runs. */
export function buildProgress(running: StageRunView | null, totalShots: number): string | null {
  const view = buildProgressView(running, totalShots);
  if (view === null) return null;
  if (view.what === 'Final review' || view.what === 'Designing') {
    return `${view.title} · ${view.step}`;
  }
  return `${view.what} · ${view.title.toLowerCase()} · ${view.step}`;
}

export interface PropsSummary {
  /** Project props that passed QA (kit-ext/props). */
  readonly built: readonly string[];
  /** Props that could not be built (failed QA or budget) or are still missing in a shot. */
  readonly failed: readonly string[];
}

/** Built and missing props of the project (props report + scenes report), sorted. */
export function propsSummary(report: ScenesReport | null, props: PropsReport | null): PropsSummary {
  const built = new Set<string>();
  const failed = new Set<string>();
  for (const entry of props?.props ?? [])
    (entry.status === 'built' ? built : failed).add(entry.name);
  for (const record of report?.shots ?? []) {
    for (const name of record.missingProps) if (!built.has(name)) failed.add(name);
  }
  return { built: [...built].sort(), failed: [...failed].sort() };
}

function newCount(count: number, noun: string): string {
  return `${String(count)} new ${noun}${count === 1 ? '' : 's'}`;
}

/** "Built 2 new props: fridge, printer · Could not build: shed — its shots use a fallback." */
export function propsBanner(summary: PropsSummary): string | null {
  const parts: string[] = [];
  if (summary.built.length > 0) {
    parts.push(`Built ${newCount(summary.built.length, 'prop')}: ${summary.built.join(', ')}`);
  }
  if (summary.failed.length > 0) {
    parts.push(
      `Could not build: ${summary.failed.join(', ')} — ${summary.failed.length === 1 ? 'its shots use' : 'their shots use'} a fallback`,
    );
  }
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * "Built 2 new roles: firefighter, chef (⚠ chef) · Could not build: pilot — its shots use a cast
 * member" (PLAN.md#12.20, roles-report.json), or null without any role.
 */
export function rolesBanner(report: RolesReport | null): string | null {
  const roles = [...(report?.roles ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const built = roles.filter((role) => role.status !== 'failed').map((role) => role.id);
  const warned = roles.filter((role) => role.status === 'warning').map((role) => role.id);
  const failed = roles.filter((role) => role.status === 'failed').map((role) => role.id);
  const parts: string[] = [];
  if (built.length > 0) {
    const warning = warned.length === 0 ? '' : ` (⚠ ${warned.join(', ')})`;
    parts.push(`Built ${newCount(built.length, 'role')}: ${built.join(', ')}${warning}`);
  }
  if (failed.length > 0) {
    parts.push(
      `Could not build: ${failed.join(', ')} — ${failed.length === 1 ? 'its shots use' : 'their shots use'} a cast member`,
    );
  }
  return parts.length === 0 ? null : parts.join(' · ');
}

/** The banners that have something to say, in one line (null when none has). */
export function joinBanners(...banners: readonly (string | null)[]): string | null {
  const shown = banners.filter((banner): banner is string => banner !== null);
  return shown.length === 0 ? null : shown.join(' · ');
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
