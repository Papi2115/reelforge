/**
 * Assets (PLAN.md#12.10, ADR-012): between Storyboard and Scenes built, only when the project's
 * research mode is not `off` and the storyboard has `assetNeeds`. One Claude turn (assets prompt,
 * storyboard permissions: `reelforge` only) looks for the needs per the mode:
 * - `ask`: proposes one package (`reelforge assets propose`) and the stage ends waiting for the
 *   user's review (`awaitingReview`); after the review the app runs `fetch-approved`, which
 *   downloads the approved items here through the guarded asset layer (Claude never approves);
 * - `allowlist`: fetches from the chosen sources, verified licences only (enforced by the guard);
 * - `full-auto`: fetches broadly; unverified licences are flagged in the warnings.
 * Needs nobody found or the user rejected simply fall back to kit visuals.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  approvedUnfetched,
  defaultAssetRuntime,
  describeUnknown,
  fetchAsset,
  parseCandidateKey,
  pendingProposals,
  readCatalogue,
} from '@reelforge/cli/assets';
import {
  DEFAULT_MAX_ASSET_NEEDS,
  projectResearchMode,
  storyboardAssetNeeds,
  storyboardFileSchema,
  type AssetRecord,
  type AssetsFile,
  type ProjectFile,
  type ShotAssetNeed,
} from '@reelforge/shared';
import { requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { saveDownloadsToLibrary, withLibrarySave } from './assets-library.js';
import { render } from './repair.js';

/** `- s04 · apollo-launch (image): the launch · search: "apollo 11" · shown as: photo on a CRT` */
export function assetNeedLine({ shotId, need }: ShotAssetNeed): string {
  const parts = [`- ${shotId} · ${need.id} (${need.kind}): ${need.description}`];
  if (need.query !== undefined) parts.push(`search: "${need.query}"`);
  if (need.role !== undefined) parts.push(`shown as: ${need.role}`);
  return parts.join(' · ');
}

/** Template variables of the assets prompt for a mode (never called for `off`). */
export function assetsPromptVars(
  project: ProjectFile,
  needs: readonly ShotAssetNeed[],
): Record<string, string | number | boolean> {
  const mode = projectResearchMode(project);
  const base = {
    mode,
    needs: needs.slice(0, DEFAULT_MAX_ASSET_NEEDS).map(assetNeedLine).join('\n'),
    maxItems: DEFAULT_MAX_ASSET_NEEDS,
  };
  if (mode === 'ask') return { ...base, ask: true };
  if (mode === 'allowlist') {
    const sources = project.researchSources ?? [];
    return {
      ...base,
      allowlist: true,
      sources: sources.length === 0 ? 'none' : sources.join(', '),
    };
  }
  return { ...base, fullAuto: true };
}

function summary(
  message: string,
  changed: boolean,
  warnings: readonly string[],
  metrics: StageSummary['metrics'],
): StageSummary {
  return {
    message,
    outputs: changed ? [FILES.assets] : [],
    changed,
    warnings,
    metrics,
  };
}

async function catalogue(ctx: StageContext): Promise<Result<AssetsFile, StageError>> {
  try {
    return ok(await readCatalogue(ctx.projectDir));
  } catch (error) {
    return err(stageError('io', describeUnknown(error)));
  }
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** What an automatic run (allowlist / full-auto) added, with the unverified ones flagged. */
function fetchedSummary(project: ProjectFile, added: readonly AssetRecord[]): StageSummary {
  const unverified = added.filter((record) => !record.licence.verified);
  const allowed = new Set<string>(project.researchSources ?? []);
  const outside =
    projectResearchMode(project) === 'allowlist'
      ? added.filter((record) => !allowed.has(record.source))
      : [];
  const warnings = [
    ...unverified.map(
      (record) =>
        `⚠ ${record.id}: licence unverified (${record.source}); check it before publishing`,
    ),
    ...outside.map((record) => `${record.id}: not from a selected source (${record.source})`),
  ];
  const message =
    added.length === 0
      ? 'Nothing fetched: the shots use kit visuals'
      : `Fetched ${plural(added.length, 'asset')}${unverified.length > 0 ? ` (${String(unverified.length)} ⚠ unverified licence)` : ''}`;
  return summary(message, added.length > 0, warnings, {
    fetched: added.length,
    unverified: unverified.length,
    awaitingReview: false,
  });
}

async function research(
  ctx: StageContext,
  project: ProjectFile,
  needs: readonly ShotAssetNeed[],
): Promise<Result<StageSummary, StageError>> {
  const mode = projectResearchMode(project);
  const before = await catalogue(ctx);
  if (!before.ok) return before;
  const prompt = render('assets', assetsPromptVars(project, needs));
  if (!prompt.ok) return prompt;
  ctx.step(`Looking for ${plural(needs.length, 'photo/footage need')}`, 10);
  const turn = await ctx.claude({
    prompt: 'assets',
    text: prompt.value,
    purpose: 'main',
    newSession: true,
    detached: true,
    label: 'assets',
  });
  if (!turn.ok) return turn;
  if (mode === 'ask') {
    const pending = await pendingProposals(ctx.projectDir).catch((error: unknown) => {
      ctx.warn(`asset packages: ${describeUnknown(error)}`);
      return [];
    });
    const candidates = pending.reduce((sum, proposal) => sum + proposal.items.length, 0);
    if (candidates === 0) {
      return ok(
        summary('No candidates proposed: the shots use kit visuals', false, [], {
          candidates: 0,
          awaitingReview: false,
        }),
      );
    }
    return ok(
      summary(`Asset package ready: ${plural(candidates, 'candidate')} to review`, false, [], {
        candidates,
        awaitingReview: true,
      }),
    );
  }
  const after = await catalogue(ctx);
  if (!after.ok) return after;
  const known = new Set(before.value.assets.map((record) => record.id));
  const added = after.value.assets.filter((record) => !known.has(record.id));
  const saved = await saveDownloadsToLibrary(ctx, added);
  return ok(withLibrarySave(fetchedSummary(project, added), saved));
}

/** Downloads the approved items of reviewed packages (ask mode) through the guarded layer. */
async function fetchApproved(ctx: StageContext): Promise<Result<StageSummary, StageError>> {
  const keys = await approvedUnfetched(ctx.projectDir).catch((error: unknown) => {
    ctx.warn(`asset packages: ${describeUnknown(error)}`);
    return [];
  });
  const runtime = ctx.assets ?? defaultAssetRuntime();
  const fetched: string[] = [];
  const failures: string[] = [];
  for (const [index, key] of keys.entries()) {
    if (ctx.signal.aborted) return err(stageError('cancelled', 'cancelled'));
    ctx.step(`Downloading ${key}`, Math.round((index / keys.length) * 100));
    const parsed = parseCandidateKey(key);
    if (parsed === undefined) {
      failures.push(`${key}: not a candidate key`);
      continue;
    }
    try {
      const outcome = await fetchAsset(ctx.projectDir, runtime, {
        source: parsed.source,
        id: parsed.id,
        url: undefined,
        as: undefined,
        kind: undefined,
      });
      fetched.push(outcome.record.id);
    } catch (error) {
      failures.push(`${key}: ${describeUnknown(error)} (the shot uses kit visuals)`);
    }
  }
  const message =
    keys.length === 0
      ? 'Nothing approved to download: the shots use kit visuals'
      : `Downloaded ${plural(fetched.length, 'approved asset')}${failures.length > 0 ? `, ${String(failures.length)} failed` : ''}`;
  const after = await catalogue(ctx);
  const records = after.ok
    ? after.value.assets.filter((record) => fetched.includes(record.id))
    : [];
  const saved = await saveDownloadsToLibrary(ctx, records);
  return ok(
    withLibrarySave(
      summary(message, fetched.length > 0, failures, {
        fetched: fetched.length,
        failed: failures.length,
        awaitingReview: false,
      }),
      saved,
    ),
  );
}

async function run(
  ctx: StageContext,
  request: { readonly action?: 'research' | 'fetch-approved' },
): Promise<Result<StageSummary, StageError>> {
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return err(stageError('not-ready', 'project.json is invalid'));
  if (projectResearchMode(project.value) === 'off') {
    return err(stageError('not-ready', 'asset research is off for this project'));
  }
  if (request.action === 'fetch-approved') return fetchApproved(ctx);
  const storyboard = await requireProjectJson(
    ctx.projectDir,
    FILES.storyboard,
    storyboardFileSchema,
  );
  if (!storyboard.ok) return storyboard;
  const needs = storyboardAssetNeeds(storyboard.value.shots);
  if (needs.length === 0) {
    return ok(summary('The storyboard asks for no photos or footage', false, [], {}));
  }
  return research(ctx, project.value, needs);
}

export const assetsStage: StageDefinition<'assets'> = {
  id: 'assets',
  inputs: [FILES.storyboard, 'project.json (researchMode, researchSources)'],
  outputs: [FILES.assets, '.reelforge/assets/ (files, proposal packages)'],
  run,
};
