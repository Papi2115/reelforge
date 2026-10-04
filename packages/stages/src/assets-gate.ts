/**
 * Where the Assets stage stands (PLAN.md#12.10): it exists only when the project's research mode
 * is not `off`, runs when the storyboard asks for photos/footage (`assetNeeds`), and in mode `ask`
 * waits for the user's review of the proposal package. Scenes built waits for it. Pure over the
 * snapshot, except `readResearchSnapshot` (local files only, never the network).
 */
import { readFile } from 'node:fs/promises';
import { pendingProposals } from '@reelforge/cli/assets';
import {
  projectResearchMode,
  storyboardAssetNeeds,
  storyboardFileSchema,
  type ProjectFile,
  type ResearchMode,
  type StageState,
} from '@reelforge/shared';
import { FILES, inProject } from './paths.js';

export interface ResearchSnapshot {
  /** `off` also for a missing or invalid project.json. */
  readonly mode: ResearchMode;
  /** Asset needs in storyboard.json (0 when there is none or it is unreadable). */
  readonly needs: number;
  /** Proposal packages waiting for the user's review (ask mode). */
  readonly pendingReviews: number;
}

export const RESEARCH_OFF: ResearchSnapshot = { mode: 'off', needs: 0, pendingReviews: 0 };

type ProjectLoad =
  | { readonly status: 'ok'; readonly value: ProjectFile }
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly message: string };

async function countNeeds(projectDir: string): Promise<number> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(inProject(projectDir, FILES.storyboard), 'utf8'),
    );
    const parsed = storyboardFileSchema.safeParse(raw);
    return parsed.success ? storyboardAssetNeeds(parsed.data.shots).length : 0;
  } catch {
    return 0; // no or unreadable storyboard.json: nothing is asked for (the gating says why)
  }
}

async function countPending(projectDir: string): Promise<number> {
  try {
    return (await pendingProposals(projectDir)).length;
  } catch {
    return 0; // a damaged proposal file cannot be reviewed; the Assets panel reports it
  }
}

/** Reads nothing when research is off (old projects keep their exact behaviour). */
export async function readResearchSnapshot(
  projectDir: string,
  project: ProjectLoad,
): Promise<ResearchSnapshot> {
  if (project.status !== 'ok') return RESEARCH_OFF;
  const mode = projectResearchMode(project.value);
  if (mode === 'off') return RESEARCH_OFF;
  const [needs, pendingReviews] = await Promise.all([
    countNeeds(projectDir),
    countPending(projectDir),
  ]);
  return { mode, needs, pendingReviews };
}

/**
 * `off`: research off (the stage does not exist) · `not-needed`: the storyboard asks for nothing ·
 * `to-run`: needs not looked for yet (or out of date / failed) · `running` · `review`: a package
 * waits for the user · `done`.
 */
export type AssetsStep = 'off' | 'not-needed' | 'to-run' | 'running' | 'review' | 'done';

export interface AssetsGateInput {
  readonly research: ResearchSnapshot;
  readonly stages: Readonly<Record<string, StageState>>;
}

export function assetsStep(snapshot: AssetsGateInput): AssetsStep {
  const { research } = snapshot;
  if (research.mode === 'off') return 'off';
  const state = snapshot.stages['assets'];
  if (state?.status === 'running' || state?.status === 'paused') return 'running';
  if (research.pendingReviews > 0) return 'review';
  if (research.needs === 0) return 'not-needed';
  return state?.status === 'done' && state.stale !== true ? 'done' : 'to-run';
}

export const ASSETS_REVIEW_REASON =
  'An asset package is waiting for your review: open Assets and approve or reject it.';

/** Why Scenes built cannot start yet because of the Assets stage (empty when it can). */
export function assetsReasons(snapshot: AssetsGateInput): string[] {
  switch (assetsStep(snapshot)) {
    case 'running':
      return ['Assets is still running.'];
    case 'review':
      return [ASSETS_REVIEW_REASON];
    case 'to-run':
      return [
        'Assets: run it first to find the photos and footage the storyboard asks for (or set Research assets to Off in Project settings).',
      ];
    default:
      return [];
  }
}

/** Why the Assets stage itself cannot run (besides the common gating). */
export function assetsStageReasons(snapshot: AssetsGateInput): string[] {
  switch (assetsStep(snapshot)) {
    case 'off':
      return ['Asset research is off for this project (Project settings → Research assets).'];
    case 'not-needed':
      return ['The storyboard asks for no photos or footage.'];
    case 'review':
      return [ASSETS_REVIEW_REASON];
    default:
      return [];
  }
}
