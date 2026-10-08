/**
 * Per-asset legibility QA of a film's world assets (PLAN.md#13.15; real runs Game B2 2 / Game
 * B1 2 / Comic 2: the critic saw whole sheets shrunk to dots and passed everything). Every asset
 * is rendered alone (plus its kind's empty page), cropped where it differs and shown at film size
 * (its 1080p size, at most 128 px tall), 6 crops per image with neutral codes. One Haiku turn
 * names what it sees in each crop without being told the names; the stage compares that with the
 * asset's own words (cast.json name and kind, the definition's description/generator/kind):
 * unreadable, not what it should be or off-style is a finding for the fix turn.
 */
import {
  assetBounds,
  composeCropSheet,
  CROPS_PER_IMAGE,
  cropTileCode,
  filmSizeCrop,
  WORLD_ASSET_SHEET_SHOT_ID,
  worldAssetCropSheet,
  worldAssetSoloPages,
  worldAssetSoloScene,
  type CropTile,
  type WorldAssetSheetPage,
} from '@reelforge/cli/service';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { WorldAssetSet } from '@reelforge/engine';
import { encodePng, type RgbaImage } from '@reelforge/engine/raster';
import { validateWorldAssetCriticReply } from '@reelforge/prompts';
import { writeAtomic } from '@reelforge/project';
import { writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import { renderShot } from '../scenes/render.js';
import { render } from '../stages/repair.js';
import { stageError, type StageError } from '../types.js';
import { criticWorldPromptVars } from '../worlds.js';
import { legibilityFinding, type AssetFacts } from './names.js';
import type { WorldAssetsJob } from './qa.js';

export interface LegibilityQa {
  readonly findings: readonly string[];
  readonly notes: readonly string[];
  /** Project-relative crop images the critic read. */
  readonly images: readonly string[];
}

interface Crop {
  readonly facts: AssetFacts;
  readonly image: RgbaImage;
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Renders one solo/empty page: the frame, or why it did not render. */
async function renderPage(
  job: WorldAssetsJob,
  page: WorldAssetSheetPage,
): Promise<Result<{ frame?: RgbaImage; failure?: string }, StageError>> {
  const scene = worldAssetSoloScene(page.page);
  const written = await writeProjectText(job.ctx.projectDir, scene, page.source);
  if (!written.ok) return written;
  const rendered = await renderShot(
    job.frames,
    {
      projectDir: job.ctx.projectDir,
      shotId: WORLD_ASSET_SHEET_SHOT_ID,
      times: [page.time],
      cards: false,
      standalone: { scene, duration: page.duration },
    },
    job.ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const result = rendered.value;
  if (!result.ok) return ok({ failure: result.error });
  const frame = result.frames[0]?.image;
  return ok(frame === undefined ? { failure: 'no frame' } : { frame });
}

/** Each asset alone, cropped at film size; render failures and empty drawings are findings. */
async function cropAssets(
  job: WorldAssetsJob,
  set: WorldAssetSet,
  facts: readonly AssetFacts[],
): Promise<Result<{ crops: Crop[]; findings: string[] }, StageError>> {
  const crops: Crop[] = [];
  const findings: string[] = [];
  for (const kind of worldAssetSoloPages(set)) {
    const empty = await renderPage(job, kind.empty);
    if (!empty.ok) return empty;
    for (const solo of kind.solos) {
      const id = solo.ids[0] ?? '';
      const asset = facts.find((entry) => entry.id === id) ?? {
        id,
        section: kind.kind,
        traits: [],
      };
      const drawn = await renderPage(job, solo);
      if (!drawn.ok) return drawn;
      const { frame, failure } = drawn.value;
      if (frame === undefined) {
        findings.push(`${id} (${kind.kind}) does not render alone: ${failure ?? 'no frame'}`);
        continue;
      }
      const bounds = assetBounds(frame, empty.value.frame);
      if (bounds === undefined) {
        findings.push(`${id} (${kind.kind}) draws nothing visible when drawn alone`);
        continue;
      }
      crops.push({ facts: asset, image: filmSizeCrop(frame, bounds) });
    }
  }
  return ok({ crops, findings });
}

/** Writes the crop images (6 per image); returns their project-relative paths. */
async function writeCropSheets(
  projectDir: string,
  crops: readonly Crop[],
): Promise<Result<string[], StageError>> {
  const images: string[] = [];
  for (let start = 0; start < crops.length; start += CROPS_PER_IMAGE) {
    const tiles: CropTile[] = crops
      .slice(start, start + CROPS_PER_IMAGE)
      .map((crop, offset) => ({ code: cropTileCode(start + offset), image: crop.image }));
    const file = worldAssetCropSheet(start / CROPS_PER_IMAGE);
    try {
      await writeAtomic(inProject(projectDir, file), encodePng(composeCropSheet(tiles)));
    } catch (error) {
      return err(stageError('io', `cannot write ${file}: ${describe(error)}`));
    }
    images.push(file);
  }
  return ok(images);
}

/** `crops-A.png: A1, A2, …; crops-B.png: B1, …` */
function tileList(images: readonly string[], count: number): string {
  return images
    .map((image, index) => {
      const codes: string[] = [];
      for (
        let k = index * CROPS_PER_IMAGE;
        k < Math.min(count, (index + 1) * CROPS_PER_IMAGE);
        k += 1
      )
        codes.push(cropTileCode(k));
      return `${image}: ${codes.join(', ')}`;
    })
    .join('; ');
}

/** The blind critic on the crops: one turn for the whole set. */
async function nameEachThing(
  job: WorldAssetsJob,
  crops: readonly Crop[],
  images: readonly string[],
): Promise<Result<{ findings: string[]; notes: string[] }, StageError>> {
  const style = criticWorldPromptVars(job.world)['worldCriticStyle'];
  const prompt = render('world-asset-critic', {
    worldLabel: job.world.label,
    imagePaths: images.join(', '),
    tiles: tileList(images, crops.length),
    ...(style === undefined ? {} : { worldCriticStyle: style }),
  });
  if (!prompt.ok) return prompt;
  const turn = await job.ctx.claude({
    prompt: 'world-asset-critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: 'critic world assets',
    commit: false,
    detached: true,
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ findings: [], notes: [`the world-assets critic failed: ${turn.error.message}`] });
  }
  const codes = crops.map((_, index) => cropTileCode(index));
  const reply = validateWorldAssetCriticReply(turn.value.reply, { expectedTiles: codes });
  if (reply.value === undefined) {
    return ok({ findings: [], notes: ["the world-assets critic's reply was not valid JSON"] });
  }
  const findings: string[] = [];
  const unnamed: string[] = [];
  crops.forEach((crop, index) => {
    const code = codes[index] ?? '';
    const verdict = reply.value?.assets.find((entry) => entry.tile === code);
    if (verdict === undefined) {
      unnamed.push(code);
      return;
    }
    const where = `${images[Math.floor(index / CROPS_PER_IMAGE)] ?? ''} tile ${code}`;
    const finding = legibilityFinding(crop.facts, where, verdict);
    if (finding !== undefined) findings.push(finding);
  });
  const notes =
    unnamed.length === 0 ? [] : [`the world-assets critic skipped tiles ${unnamed.join(', ')}`];
  return ok({ findings, notes });
}

/** Per-asset legibility of the set (render findings first; the critic only when asked for). */
export async function legibilityQa(
  job: WorldAssetsJob,
  set: WorldAssetSet,
  facts: readonly AssetFacts[],
): Promise<Result<LegibilityQa, StageError>> {
  const cropped = await cropAssets(job, set, facts);
  if (!cropped.ok) return cropped;
  const { crops, findings } = cropped.value;
  const images = await writeCropSheets(job.ctx.projectDir, crops);
  if (!images.ok) return images;
  if (crops.length === 0 || !job.settings.critic || !job.ctx.hasClaude)
    return ok({ findings, notes: [], images: images.value });
  const named = await nameEachThing(job, crops, images.value);
  if (!named.ok) return named;
  return ok({
    findings: [...findings, ...named.value.findings],
    notes: named.value.notes,
    images: images.value,
  });
}
