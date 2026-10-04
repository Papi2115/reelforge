/**
 * Asset research of the open project in the app (PLAN.md#12.10): what the Assets dialog and the
 * export dialog show (research mode, downloaded assets with ⚠ for unverified licences, packages
 * waiting for review, the "Credits" text of `reelforge assets credits`) and the review of a
 * package. The review is the only approval there is: the app writes it with the asset layer's
 * `approveProposalItems` under `.reelforge/` (the runtime Claude cannot edit there and no CLI
 * command approves), then queues the download of the approved items. Electron-free.
 */
import {
  approveProposalItems,
  cleanAuthor,
  creditsMarkdown,
  describeUnknown,
  listProposals,
  readCatalogue,
  readLibrary,
  readResearchSettings,
  sanitizeText,
  sanitizeUrl,
  TEXT_LIMITS,
  usedAssetIds,
} from '@reelforge/cli/assets';
import {
  candidateKey,
  type AssetLicence,
  type AssetProposal,
  type AssetRecord,
  type AssetsFile,
} from '@reelforge/shared';
import type {
  AssetLicenceView,
  AssetsReviewRequest,
  AssetsReviewResult,
  AssetsState,
  AssetView,
  CreditsView,
  ProposalView,
} from '../../shared/assets-contract.js';
import type { Logger } from '../logger.js';

const THUMBNAILS_DIR = '.reelforge/assets/thumbnails/';
const ASSETS_DIR = '.reelforge/assets/';

/** A project-relative file under `folder` without `..` (else null: never shown). */
function servedFile(file: string | null, folder: string): string | null {
  if (file === null || !file.startsWith(folder)) return null;
  return file.split('/').some((part) => part === '..' || part === '') ? null : file;
}

function licenceView(licence: AssetLicence): AssetLicenceView {
  return {
    id: sanitizeText(licence.id, TEXT_LIMITS.licence) || 'unknown',
    url: licence.url === null ? null : sanitizeUrl(licence.url),
    verified: licence.verified,
  };
}

/** assets.json may be edited by hand or by Claude: every text is cleaned again. */
export function assetView(record: AssetRecord, inLibrary = false): AssetView {
  return {
    id: record.id,
    kind: record.kind,
    title: sanitizeText(record.title, TEXT_LIMITS.title) || record.id,
    author: cleanAuthor(record.author, 'unknown'),
    source: record.source,
    sourceUrl: sanitizeUrl(record.sourceUrl),
    licence: licenceView(record.licence),
    approved: record.approved,
    image: record.kind === 'image' ? servedFile(record.file, ASSETS_DIR) : null,
    own: record.source === 'own',
    description: sanitizeText(record.description ?? '', TEXT_LIMITS.description),
    width: record.width,
    height: record.height,
    fromLibrary: record.fromLibrary === true,
    inLibrary,
  };
}

/** sha256 of every library entry (empty without a library or when it cannot be read). */
async function librarySha(dir: string | undefined): Promise<ReadonlySet<string>> {
  if (dir === undefined) return new Set();
  try {
    return new Set((await readLibrary(dir)).library.entries.map((entry) => entry.sha256));
  } catch {
    return new Set(); // an unreadable library: the Library dialog reports it
  }
}

export function proposalView(proposal: AssetProposal): ProposalView {
  return {
    number: proposal.number,
    createdAt: proposal.createdAt,
    items: proposal.items.map(({ candidate, thumbnail }) => ({
      key: candidateKey(candidate),
      kind: candidate.kind,
      title: sanitizeText(candidate.title, TEXT_LIMITS.title) || candidate.id,
      author: cleanAuthor(candidate.author, 'unknown'),
      source: candidate.source,
      sourceUrl: sanitizeUrl(candidate.sourceUrl),
      licence: licenceView(candidate.licence),
      width: candidate.width,
      height: candidate.height,
      thumbnail: servedFile(thumbnail, THUMBNAILS_DIR),
    })),
  };
}

/** Credits of the assets the film uses; every asset while no scene uses one yet (12.11). */
export async function creditsView(
  dir: string,
  records: readonly AssetRecord[],
): Promise<CreditsView> {
  const used = await usedAssetIds(
    dir,
    records.map((record) => record.id),
  );
  const usedRecords = records.filter((record) => used.has(record.id));
  const scope = usedRecords.length > 0 ? 'used' : 'all';
  const listed = scope === 'used' ? usedRecords : records;
  return { markdown: creditsMarkdown(listed), scope, count: listed.length };
}

export interface AssetsServiceOptions {
  /** Folder of the open project (undefined: none open). */
  readonly projectDir: () => string | undefined;
  /** Queues the download of approved items (Assets stage, `fetch-approved`). */
  readonly fetchApproved: () => Promise<{
    readonly status: 'ok' | 'queued' | 'cancelled' | 'error';
    readonly message: string | null;
  }>;
  /** A package was reviewed: the pipeline state changed. */
  readonly changed: () => void;
  readonly now?: () => Date;
  readonly log: Logger;
  /** The global asset library folder (PLAN.md#12.19), for the "in library" marks. */
  readonly libraryDir?: string;
}

type Settled<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

async function settle<T>(read: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await read };
  } catch (error) {
    return { ok: false, message: describeUnknown(error) };
  }
}

export class AssetsService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: AssetsServiceOptions) {}

  async state(): Promise<AssetsState> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    const settings = await settle(readResearchSettings(dir));
    if (!settings.ok) return { status: 'error', message: settings.message };
    const [catalogue, proposals] = await Promise.all([
      settle(readCatalogue(dir)),
      settle(listProposals(dir)),
    ]);
    const records: AssetsFile['assets'] = catalogue.ok ? catalogue.value.assets : [];
    const inLibrary = await librarySha(this.options.libraryDir);
    const problems = [catalogue, proposals].flatMap((read) => (read.ok ? [] : [read.message]));
    return {
      status: 'ok',
      mode: settings.value.mode,
      sources: [...settings.value.sources],
      assets: records.map((record) => assetView(record, inLibrary.has(record.sha256))),
      pending: (proposals.ok ? proposals.value : [])
        .filter((proposal) => proposal.reviewedAt === undefined)
        .map(proposalView),
      credits: await creditsView(dir, records),
      problem: problems.length === 0 ? null : problems.join(' '),
    };
  }

  /** One review at a time. */
  review(request: AssetsReviewRequest): Promise<AssetsReviewResult> {
    const run = this.queue.then(() => this.runReview(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runReview(request: AssetsReviewRequest): Promise<AssetsReviewResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return { status: 'error', message: 'No project is open.' };
    const proposals = await settle(listProposals(dir));
    if (!proposals.ok) return { status: 'error', message: proposals.message };
    const proposal = proposals.value.find((candidate) => candidate.number === request.number);
    if (proposal === undefined) {
      return {
        status: 'error',
        message: `Asset package ${String(request.number)} does not exist.`,
      };
    }
    if (proposal.reviewedAt !== undefined) {
      return { status: 'error', message: 'This package was already reviewed.' };
    }
    const keys = new Set(proposal.items.map((item) => candidateKey(item.candidate)));
    const approve = [...new Set(request.approve)];
    if (approve.some((key) => !keys.has(key))) {
      return { status: 'error', message: 'Only items of this package can be approved.' };
    }
    const reviewedAt = (this.options.now?.() ?? new Date()).toISOString();
    const written = await settle(approveProposalItems(dir, proposal.number, approve, reviewedAt));
    if (!written.ok) return { status: 'error', message: written.message };
    this.options.log.info(
      `asset package ${String(proposal.number)}: approved ${String(approve.length)} of ${String(keys.size)}`,
    );
    this.options.changed();
    if (approve.length === 0) {
      return { status: 'ok', message: 'Package rejected: the shots use kit visuals.' };
    }
    const queued = await this.options.fetchApproved();
    if (queued.status === 'error') return { status: 'error', message: queued.message };
    return {
      status: 'queued',
      message: `Downloading ${String(approve.length)} approved asset${approve.length === 1 ? '' : 's'}…`,
    };
  }
}
