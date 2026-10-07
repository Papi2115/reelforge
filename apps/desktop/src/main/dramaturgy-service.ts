/**
 * The Dramaturgy section (PLAN.md#12.25–12.27, ADR-020): reads the dramaturgy report and computes
 * the reveal-moment proposals (pure `proposeMoments` over tension.json, timed words and the
 * anchors of the last sync report) merged with the decisions in moments.json. Accept / Reject /
 * back to proposed write moments.json (zod, atomic) and commit `Moments: …`; a locked shot's
 * moment cannot be accepted. Decisions run one at a time. Slow motion and palette flashes show in
 * the preview right away (the manifest reads moments.json); silence hits at the next mix.
 */
import path from 'node:path';
import { isWorldStyle } from '@reelforge/kit';
import { writeJsonAtomic } from '@reelforge/project';
import {
  DRAMATURGY_REPORT_FILE,
  dramaturgyReportSchema,
  lockedShotIds,
  mergeMoments,
  MOMENTS_FILE,
  MOMENTS_FILE_VERSION,
  momentsFileSchema,
  PAGE_CAMERA_HINTS,
  projectFileSchema,
  projectOpenLoops,
  projectPatternInterrupts,
  projectRevealMoments,
  projectTensionMap,
  proposeMoments,
  shotLocksFileSchema,
  storyboardFileSchema,
  syncReportSchema,
  TENSION_FILE,
  tensionFileSchema,
  wordsFileSchema,
  type Moment,
  type MomentAnchor,
  type MomentKind,
  type SyncReport,
} from '@reelforge/shared';
import type {
  DramaturgyState,
  MomentDecideRequest,
  MomentDecideResult,
  MomentView,
} from '../shared/dramaturgy-contract.js';
import { SNAPSHOT_FILES } from '../shared/snapshot-contract.js';
import { describeError, type Logger } from './logger.js';
import { readProjectJson } from './project-files.js';

/** Commit trailer `ReelForge-Step` of moment decisions. */
export const MOMENTS_STEP = 'moments';
const SYNC_REPORT_FILE = '.reelforge/sync-report.json';

export interface DramaturgyServiceOptions {
  readonly projectDir: () => string | undefined;
  /** Commits `paths` of the open project; resolves true when a commit was made. */
  readonly commit: (message: string, paths: readonly string[]) => Promise<boolean>;
  readonly now: () => Date;
  readonly log: Logger;
}

/** The visual hits of the scenes (sync report `anchor` and scene `sfx` events), film time. */
export function syncAnchors(report: SyncReport | undefined): MomentAnchor[] {
  return (report?.shots ?? []).flatMap((shot) =>
    shot.events
      .filter((event) => event.kind === 'anchor' || event.kind === 'sfx')
      .map((event) => ({ shotId: shot.shotId, t: event.t })),
  );
}

const KIND_WORDS: Readonly<Record<MomentKind, string>> = {
  'silence-hit': 'silence hit',
  'palette-shift': 'palette flash',
  'slow-motion': 'slow motion',
};

const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
};

/**
 * Camera ideas of reveal moments: a world project (Sketchbook…) gets its page hints (its camera
 * never orbits), every other style the default 3D hints (undefined).
 */
export function momentCameraHints(
  style: string | undefined,
): Readonly<Record<MomentKind, string>> | undefined {
  return isWorldStyle(style) ? PAGE_CAMERA_HINTS : undefined;
}

/** Commit subject, e.g. `Moments: accepted slow motion at 0:51 (s02_glass)`. */
export function describeDecision(
  moment: Moment,
  decision: MomentDecideRequest['decision'],
): string {
  const verb = decision === 'proposed' ? 'undid the decision on' : decision;
  return `Moments: ${verb} ${KIND_WORDS[moment.kind]} at ${clock(moment.at)} (${moment.shotId})`;
}

/** The stored decisions after one more (a `proposed` decision removes the stored entry). */
export function decidedMoments(
  stored: readonly Moment[],
  moment: Moment,
  decision: MomentDecideRequest['decision'],
  now: Date,
): Moment[] {
  const others = stored.filter((entry) => entry.id !== moment.id);
  if (decision === 'proposed') return others;
  return [...others, { ...moment, status: decision, decidedAt: now.toISOString() }].sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id),
  );
}

interface Loaded {
  readonly state: Extract<DramaturgyState, { status: 'ok' }>;
  readonly stored: readonly Moment[];
}

export class DramaturgyService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: DramaturgyServiceOptions) {}

  async state(): Promise<DramaturgyState> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    return 'message' in loaded ? { status: 'error', message: loaded.message } : loaded.state;
  }

  decide(request: MomentDecideRequest): Promise<MomentDecideResult> {
    const run = this.queue.then(() => this.run(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(request: MomentDecideRequest): Promise<MomentDecideResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'no project is open' };
    const loaded = await this.load(dir);
    if ('message' in loaded) return { status: 'error', message: loaded.message };
    const view = loaded.state.moments.find((entry) => entry.moment.id === request.id);
    if (view === undefined) return { status: 'error', message: `no moment ${request.id}` };
    if (request.decision === 'accepted' && view.locked) {
      return {
        status: 'error',
        message: `${view.moment.shotId} is locked: unlock the shot to accept this moment`,
      };
    }
    if (view.moment.status === request.decision) {
      return { status: 'ok', moments: loaded.state.moments, committed: false };
    }
    const moments = decidedMoments(
      loaded.stored,
      view.moment,
      request.decision,
      this.options.now(),
    );
    try {
      await writeJsonAtomic(path.join(dir, MOMENTS_FILE), {
        version: MOMENTS_FILE_VERSION,
        moments,
      });
    } catch (error) {
      this.options.log.error(`cannot write ${MOMENTS_FILE}: ${describeError(error)}`);
      return { status: 'error', message: `cannot write ${MOMENTS_FILE}: ${describeError(error)}` };
    }
    const message = describeDecision(view.moment, request.decision);
    const committed = await this.options.commit(message, [MOMENTS_FILE]);
    this.options.log.info(`${message}${committed ? '' : ' (not committed)'}`);
    const after = await this.load(dir);
    return 'message' in after
      ? { status: 'error', message: after.message }
      : { status: 'ok', moments: after.state.moments, committed };
  }

  private async load(dir: string): Promise<Loaded | { readonly message: string }> {
    const [project, storyboard, words, tension, sync, locks, stored, report] = await Promise.all([
      readProjectJson(dir, SNAPSHOT_FILES.project, projectFileSchema),
      readProjectJson(dir, SNAPSHOT_FILES.storyboard, storyboardFileSchema),
      readProjectJson(dir, SNAPSHOT_FILES.words, wordsFileSchema),
      readProjectJson(dir, TENSION_FILE, tensionFileSchema),
      readProjectJson(dir, SYNC_REPORT_FILE, syncReportSchema),
      readProjectJson(dir, SNAPSHOT_FILES.locks, shotLocksFileSchema),
      readProjectJson(dir, MOMENTS_FILE, momentsFileSchema),
      readProjectJson(dir, DRAMATURGY_REPORT_FILE, dramaturgyReportSchema),
    ]);
    if (project.status !== 'ok') {
      return {
        message: project.status === 'error' ? project.error.message : 'project.json is missing',
      };
    }
    if (stored.status === 'error') return { message: stored.error.message };
    const storedMoments = stored.status === 'ok' ? stored.data.moments : [];
    const locked = locks.status === 'ok' ? lockedShotIds(locks.data) : new Set<string>();
    const switches = {
      patternInterrupts: projectPatternInterrupts(project.data),
      openLoops: projectOpenLoops(project.data),
      revealMoments: projectRevealMoments(project.data),
    };
    let momentsNote: string | null = null;
    let proposals: Moment[] = [];
    if (switches.revealMoments !== 'auto') {
      momentsNote = 'Wow moments are off for this project (Project settings → Direction).';
    } else if (projectTensionMap(project.data) !== 'auto' || tension.status !== 'ok') {
      momentsNote =
        'Wow moments follow the tension curve: turn the tension map on and draw or propose a curve.';
    } else if (storyboard.status !== 'ok' || words.status !== 'ok') {
      momentsNote = 'Wow moments need the storyboard and the timed words.';
    } else {
      const cameraHints = momentCameraHints(project.data.style);
      proposals = proposeMoments({
        shots: storyboard.data.shots,
        tension: tension.data.points,
        words: words.data.words,
        anchors: syncAnchors(sync.status === 'ok' ? sync.data : undefined),
        ...(cameraHints === undefined ? {} : { cameraHints }),
      });
      if (proposals.length === 0 && noDecisions(storedMoments)) {
        momentsNote = 'No tension peak is high enough for a wow moment (0.6 or more).';
      }
    }
    const merged = switches.revealMoments === 'auto' ? mergeMoments(proposals, storedMoments) : [];
    const moments: MomentView[] = merged.map((moment) => ({
      moment,
      locked: locked.has(moment.shotId),
    }));
    return {
      state: {
        status: 'ok',
        switches,
        report: report.status === 'ok' ? report.data : null,
        moments,
        momentsNote,
      },
      stored: storedMoments,
    };
  }
}

function noDecisions(stored: readonly Moment[]): boolean {
  return stored.every((moment) => moment.status === 'proposed');
}
