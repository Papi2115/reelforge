/**
 * Asset storage of a project: the tracked catalogue `assets.json` (metadata), the git-ignored
 * bytes in `.reelforge/assets/`, and the proposal packages of the ask mode in
 * `.reelforge/assets/proposals/<n>.json` (the runtime Claude cannot edit `.reelforge/`, so it
 * cannot approve its own proposals; only the app does). All writes are atomic (tmp + rename).
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ASSETS_FILE_VERSION,
  assetProposalSchema,
  assetsFileSchema,
  candidateKey,
  type AssetProposal,
  type AssetRecord,
  type AssetsFile,
} from '@reelforge/shared';
import type { z } from 'zod';
import { ProjectError } from '../errors.js';
import { describeUnknown } from '../errors.js';
import { projectPath, resolveInProject } from '../project/paths.js';

export const ASSET_PATHS = {
  catalogue: 'assets.json',
  files: '.reelforge/assets',
  proposals: '.reelforge/assets/proposals',
  thumbnails: '.reelforge/assets/thumbnails',
} as const;

/** Writes JSON next to the target first, then renames over it. */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${String(process.pid)}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function readValidated<Schema extends z.ZodType>(
  file: string,
  label: string,
  schema: Schema,
): Promise<z.output<Schema> | undefined> {
  if (!existsSync(file)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new ProjectError(
      `${label} is not valid JSON (${describeUnknown(error)})`,
      `restore ${label} from git history or ask the user`,
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ProjectError(
      `${label} does not match its schema: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      `do not edit ${label} by hand; restore it from git history or ask the user`,
    );
  }
  return parsed.data;
}

/** A folder of the asset store, created inside the project (never through a link outside). */
export async function storeDir(root: string, relative: string): Promise<string> {
  const absolute = resolveInProject(root, relative, 'asset store');
  await mkdir(absolute, { recursive: true });
  return resolveInProject(root, relative, 'asset store');
}

export async function readCatalogue(root: string): Promise<AssetsFile> {
  const file = projectPath(root, ASSET_PATHS.catalogue);
  const data = await readValidated(file, ASSET_PATHS.catalogue, assetsFileSchema);
  return data ?? { version: ASSETS_FILE_VERSION, assets: [] };
}

export async function addToCatalogue(root: string, record: AssetRecord): Promise<void> {
  const catalogue = await readCatalogue(root);
  const assets = [...catalogue.assets.filter((asset) => asset.id !== record.id), record];
  await writeJsonAtomic(projectPath(root, ASSET_PATHS.catalogue), { ...catalogue, assets });
}

function proposalFile(root: string, number: number): string {
  return projectPath(root, `${ASSET_PATHS.proposals}/${String(number)}.json`);
}

export async function listProposals(root: string): Promise<AssetProposal[]> {
  const dir = projectPath(root, ASSET_PATHS.proposals);
  if (!existsSync(dir)) return [];
  const numbers = (await readdir(dir))
    .map((name) => /^(\d+)\.json$/.exec(name)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  const proposals = await Promise.all(
    numbers.map((number) =>
      readValidated(
        proposalFile(root, number),
        `${ASSET_PATHS.proposals}/${String(number)}.json`,
        assetProposalSchema,
      ),
    ),
  );
  return proposals.filter((proposal): proposal is AssetProposal => proposal !== undefined);
}

export async function nextProposalNumber(root: string): Promise<number> {
  const proposals = await listProposals(root);
  return Math.max(0, ...proposals.map((proposal) => proposal.number)) + 1;
}

export async function writeProposal(root: string, proposal: AssetProposal): Promise<string> {
  await storeDir(root, ASSET_PATHS.proposals);
  const file = proposalFile(root, proposal.number);
  await writeJsonAtomic(file, assetProposalSchema.parse(proposal));
  return `${ASSET_PATHS.proposals}/${String(proposal.number)}.json`;
}

/** True when some proposal has the candidate `<source>:<id>` approved by the user. */
export async function isApproved(root: string, key: string): Promise<boolean> {
  const proposals = await listProposals(root);
  return proposals.some((proposal) =>
    proposal.items.some((item) => item.approved && candidateKey(item.candidate) === key),
  );
}

/**
 * Marks candidates of a proposal approved; with `reviewedAt` the package also counts as reviewed
 * (the user decided: the approved keys, everything else rejected). For the app (PLAN.md#12.10) and
 * tests only: no CLI command exposes it, so the runtime Claude can never approve its own proposals.
 */
export async function approveProposalItems(
  root: string,
  number: number,
  keys: readonly string[],
  reviewedAt?: string,
): Promise<void> {
  const proposal = await readValidated(
    proposalFile(root, number),
    `proposal ${String(number)}`,
    assetProposalSchema,
  );
  if (proposal === undefined) throw new Error(`proposal ${String(number)} does not exist`);
  const items = proposal.items.map((item) =>
    keys.includes(candidateKey(item.candidate)) ? { ...item, approved: true } : item,
  );
  await writeJsonAtomic(proposalFile(root, number), {
    ...proposal,
    items,
    ...(reviewedAt === undefined ? {} : { reviewedAt }),
  });
}

/** Packages the user has not reviewed yet (ask mode), oldest first. */
export async function pendingProposals(root: string): Promise<AssetProposal[]> {
  return (await listProposals(root)).filter((proposal) => proposal.reviewedAt === undefined);
}

/** Approved candidates (`<source>:<id>`) of reviewed packages that are not in assets.json yet. */
export async function approvedUnfetched(root: string): Promise<string[]> {
  const [proposals, catalogue] = await Promise.all([listProposals(root), readCatalogue(root)]);
  const fetched = new Set(
    catalogue.assets.flatMap((asset) =>
      asset.sourceItemId === null ? [] : [`${asset.source}:${asset.sourceItemId}`],
    ),
  );
  const keys = proposals
    .filter((proposal) => proposal.reviewedAt !== undefined)
    .flatMap((proposal) => proposal.items.filter((item) => item.approved))
    .map((item) => candidateKey(item.candidate))
    .filter((key) => !fetched.has(key));
  return [...new Set(keys)];
}
