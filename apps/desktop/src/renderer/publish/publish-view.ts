/**
 * What the export dialog's Publish kit section shows (PLAN.md#12.17): labels and notes of the
 * four texts, the unverified-licence banner and the outcome of Save. Pure, tested.
 */
import type {
  PublishFileNameView,
  PublishKitView,
  PublishSaveResult,
} from '../../shared/publish-contract.js';
import { chaptersSkippedReason } from '../export/export-view.js';

export const PUBLISH_FILE_LABELS: Readonly<Record<PublishFileNameView, string>> = {
  'description.txt': 'Description',
  'chapters.txt': 'Chapters',
  'tags.txt': 'Tags',
  'credits.txt': 'Credits',
};

/** The banner over the texts while a used asset's licence is unverified (null: none). */
export function unverifiedBanner(kit: PublishKitView): string | null {
  const count = kit.unverified.length;
  if (count === 0) return null;
  const names = kit.unverified.map((title) => `"${title}"`).join(', ');
  return `⚠ ${String(count)} asset${count === 1 ? ' has' : 's have'} an unverified licence (${names}). The description and credits carry a WARNING block: confirm ${count === 1 ? 'the licence' : 'each licence'} or replace ${count === 1 ? 'the asset' : 'them'} before publishing.`;
}

/** One line under the heading: chapters, where the text came from, credited assets. */
export function kitSummary(kit: PublishKitView): string {
  const chapters =
    kit.chapterProblem === null
      ? `${String(kit.chapterCount)} chapter${kit.chapterCount === 1 ? '' : 's'}`
      : 'no chapters';
  const source =
    kit.metaSource === 'claude'
      ? 'description and tags by Claude'
      : kit.metaSource === 'template'
        ? 'description and tags from the template'
        : 'description from the script';
  const assets =
    kit.creditedAssets === 0
      ? 'no external assets'
      : `${String(kit.creditedAssets)} asset${kit.creditedAssets === 1 ? '' : 's'} credited`;
  return `${chapters} · ${source} · ${assets}`;
}

/** Why chapters.txt has no chapters, in the export form's plain words (null when it has them). */
export function chaptersNote(kit: PublishKitView): string | null {
  return kit.chapterProblem === null
    ? null
    : `Chapters skipped: ${chaptersSkippedReason(kit.chapterProblem)}.`;
}

/** Status line after Save to publish/. */
export function saveNote(result: PublishSaveResult): string {
  if (result.status === 'error') return `Not saved: ${result.message}`;
  const count = result.files.length;
  const where = `${String(count)} file${count === 1 ? '' : 's'} saved to publish/`;
  return result.committed ? `${where} and committed.` : `${where} (not committed: see the log).`;
}

/** Rows of a preview box: the text's lines, between 2 and 12. */
export function previewRows(text: string): number {
  return Math.min(12, Math.max(2, text.trimEnd().split('\n').length));
}
