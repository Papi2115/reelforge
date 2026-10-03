/**
 * Shot variants in main (PLAN.md#11.3): the sets of the open project as cards for the Variants
 * view (the current scene first, from the scenes report), the cost estimate from the usage ledger,
 * the stage requests of the variant operations, and the preview manifest with a card's scene in
 * place of the shot's scene (the player then hot reloads only that shot).
 */
import { readFile } from 'node:fs/promises';
import { promptModel } from '@reelforge/prompts';
import {
  scenesReportSchema,
  usageFileSchema,
  type ShotBuildRecord,
  type ShotVariantSet,
  type UsageFile,
} from '@reelforge/shared';
import {
  FILES,
  estimateVariants,
  inProject,
  readVariantSets,
  type StageRequest,
  type StageSettings,
} from '@reelforge/stages';
import type { ProjectManifestResult } from '../../shared/snapshot-contract.js';
import type {
  VariantCard,
  VariantEstimateView,
  VariantKey,
  VariantOpRequest,
  VariantsState,
} from '../../shared/variants-contract.js';
import { buildProjectManifest } from '../project-manifest.js';
import { cardScene } from './variant-clips.js';

/** Lines of a card: critic notes first, then QA findings (at most 4). */
export function recordNotes(record: ShotBuildRecord | undefined): string[] {
  if (record === undefined) return [];
  const critic = record.critic.map((verdict) =>
    verdict.verdict === 'ok'
      ? `Critic: ${verdict.note}`
      : `Critic (${verdict.verdict}): ${verdict.note}`,
  );
  const findings = record.findings.map((finding) => finding.message);
  return [...new Set([...critic, ...findings])].filter((line) => line.trim() !== '').slice(0, 4);
}

function currentCard(record: ShotBuildRecord | undefined): VariantCard {
  return {
    key: 'current',
    title: 'Current scene',
    direction: null,
    status: 'current',
    qa: record?.status ?? null,
    notes: recordNotes(record),
    reason: null,
  };
}

export function setView(
  set: ShotVariantSet,
  current: ShotBuildRecord | undefined,
): VariantsState['sets'][number] {
  const cards: VariantCard[] = set.variants.map((variant) => ({
    key: `v${String(variant.index)}` as VariantKey,
    title: `Variant ${String(variant.index)}`,
    direction: variant.direction.label,
    status: variant.status,
    qa: variant.status === 'ready' ? (variant.record?.status ?? null) : null,
    notes: recordNotes(variant.record),
    reason: variant.reason ?? null,
  }));
  return { shotId: set.shotId, note: set.note ?? null, cards: [currentCard(current), ...cards] };
}

async function readJson<T>(
  file: string,
  parse: (raw: unknown) => T | undefined,
): Promise<T | undefined> {
  try {
    return parse(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return undefined; // not written yet / unreadable: treated as absent
  }
}

export async function readVariantsState(dir: string | undefined): Promise<VariantsState> {
  if (dir === undefined) return { projectDir: null, sets: [] };
  const sets = await readVariantSets(dir);
  if (!sets.ok) throw new Error(sets.error.message);
  const report = await readJson(inProject(dir, FILES.scenesReport), (raw) => {
    const parsed = scenesReportSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  });
  const records = new Map((report?.shots ?? []).map((entry) => [entry.shotId, entry]));
  return {
    projectDir: dir,
    sets: sets.value.sets.map((set) => setView(set, records.get(set.shotId))),
  };
}

export async function variantEstimate(
  dir: string | undefined,
  count: number,
  settings: StageSettings,
  claudeConcurrency: number,
): Promise<VariantEstimateView> {
  const usage: UsageFile | undefined =
    dir === undefined
      ? undefined
      : await readJson(inProject(dir, '.reelforge/usage.json'), (raw) => {
          const parsed = usageFileSchema.safeParse(raw);
          return parsed.success ? parsed.data : undefined;
        });
  const model = promptModel('scene-build', { economy: settings.economy, models: settings.models });
  const estimate = estimateVariants({
    count,
    concurrency: Math.min(settings.scenes.concurrency, claudeConcurrency),
    model,
    usage,
  });
  return { text: estimate.text, turns: estimate.turns, model: estimate.model };
}

/** The Scenes built request of a variant operation on one shot. */
export function variantRequest(shotId: string, op: VariantOpRequest): StageRequest {
  return { stage: 'scenes', action: 'variants', shots: [shotId], variants: op };
}

/** The project's manifest with the card's scene as the shot's scene. */
export async function variantManifest(
  dir: string | undefined,
  shotId: string,
  key: VariantKey,
): Promise<ProjectManifestResult> {
  if (dir === undefined) return { status: 'unavailable', reason: 'no project is open' };
  const built = await buildProjectManifest(dir);
  if (built.status !== 'ready' || key === 'current') return built;
  const shot = built.manifest.shots.find((entry) => entry.id === shotId);
  if (shot === undefined) return { status: 'unavailable', reason: `unknown shot ${shotId}` };
  const file = cardScene({ id: shotId, scene: shot.scene.file }, key);
  let source: string;
  try {
    source = await readFile(inProject(dir, file), 'utf8');
  } catch {
    return { status: 'unavailable', reason: `${file} is missing (the variant was removed)` };
  }
  return {
    status: 'ready',
    manifest: {
      ...built.manifest,
      shots: built.manifest.shots.map((entry) =>
        entry.id === shotId ? { ...entry, scene: { file, source } } : entry,
      ),
    },
  };
}
