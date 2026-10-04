/**
 * View models of asset research in the app (PLAN.md#12.10): the "Asset package" review (which
 * items start ticked, the button labels), licence badges with ⚠ for unverified licences, the
 * asset list and the export dialog's warning + credits preview. Pure.
 */
import type { ResearchMode } from '@reelforge/shared';
import type {
  AssetLicenceView,
  AssetsState,
  AssetView,
  CreditsView,
  ProposalView,
} from '../../shared/assets-contract.js';
import { RESEARCH_SOURCE_CHOICES } from '../project/research-settings-view.js';

export interface LicenceBadge {
  readonly text: string;
  readonly tone: 'ok' | 'warning';
  readonly title: string;
}

export function licenceBadge(licence: AssetLicenceView): LicenceBadge {
  return licence.verified
    ? {
        text: licence.id,
        tone: 'ok',
        title: `Open licence (${licence.id}), verified at the source`,
      }
    : {
        text: `⚠ ${licence.id === 'unverified' ? 'unverified' : `${licence.id} (unverified)`}`,
        tone: 'warning',
        title: 'Licence not verified: check it before publishing',
      };
}

/** `wikimedia` -> `Wikimedia Commons`; `web` -> a direct link (full auto); `own` -> your file. */
export function sourceLabel(source: string): string {
  if (source === 'web') return 'Web (direct link)';
  if (source === 'own') return 'Your file';
  return RESEARCH_SOURCE_CHOICES.find((choice) => choice.id === source)?.label ?? source;
}

export const RESEARCH_MODE_LABELS: Readonly<Record<ResearchMode, string>> = {
  ask: 'Ask me for each package',
  allowlist: 'Automatic from selected sources',
  'full-auto': 'Full auto ⚠',
  off: 'Off (no network)',
};

/** Keys ticked when a package opens: the candidates with a verified licence. */
export function initialSelection(proposal: ProposalView): ReadonlySet<string> {
  return new Set(proposal.items.filter((item) => item.licence.verified).map((item) => item.key));
}

export function toggled(selection: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Keys of the package in its order (a stale selection never sends unknown keys). */
export function approvedKeys(proposal: ProposalView, selection: ReadonlySet<string>): string[] {
  return proposal.items.map((item) => item.key).filter((key) => selection.has(key));
}

export function approveLabel(count: number): string {
  return count === 0 ? 'Approve selected' : `Approve selected (${String(count)})`;
}

export function sizeText(width: number | null, height: number | null): string | null {
  return width === null || height === null ? null : `${String(width)}×${String(height)}`;
}

/** Downloaded assets with an unverified licence (⚠); the user's own files never are. */
export function unverifiedAssets(assets: readonly AssetView[]): AssetView[] {
  return assets.filter((asset) => !asset.own && !asset.licence.verified);
}

/** The user's own files and everything else (downloads, library copies of downloads). */
export function splitAssets(assets: readonly AssetView[]): {
  readonly own: readonly AssetView[];
  readonly downloaded: readonly AssetView[];
} {
  return {
    own: assets.filter((asset) => asset.own),
    downloaded: assets.filter((asset) => !asset.own),
  };
}

/** File types "Add my assets" takes (main checks the content again). */
export const OWN_ASSET_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'] as const;

/** Paths of dropped files with an image/video extension, and how many were skipped. */
export function droppedMedia(paths: readonly string[]): {
  readonly accepted: readonly string[];
  readonly skipped: number;
} {
  const accepted = paths.filter((file) => {
    const extension = /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? '';
    return file !== '' && (OWN_ASSET_EXTENSIONS as readonly string[]).includes(extension);
  });
  return { accepted, skipped: paths.length - accepted.length };
}

/** The text under an own file: kind, size and where it also lives. */
export function ownAssetMeta(asset: AssetView): string {
  const size = sizeText(asset.width, asset.height);
  const parts = [asset.kind === 'image' ? 'Image' : 'Video'];
  if (size !== null) parts.push(size);
  if (asset.fromLibrary) parts.push('from your library');
  return parts.join(' · ');
}

export interface ExportAssetsView {
  /** ⚠ title line, null when every licence is verified. */
  readonly warning: string | null;
  readonly unverified: readonly AssetView[];
  readonly credits: CreditsView | null;
  readonly creditsTitle: string;
}

/** The export dialog's asset section (nothing to show without assets). */
export function exportAssetsView(state: AssetsState | undefined): ExportAssetsView | null {
  // The user's own files need no credit and no warning.
  if (state?.status !== 'ok' || state.assets.every((asset) => asset.own)) return null;
  const unverified = unverifiedAssets(state.assets);
  const count = unverified.length;
  return {
    warning:
      count === 0
        ? null
        : `⚠ ${String(count)} asset${count === 1 ? ' has' : 's have'} an unverified licence: check ${count === 1 ? 'it' : 'them'} before publishing (the export is not blocked).`,
    unverified,
    credits: state.credits,
    creditsTitle:
      state.credits.scope === 'used'
        ? 'Credits for the video description'
        : 'Credits for the video description (no scene uses an asset yet: every downloaded asset)',
  };
}

/** The Assets row of the pipeline opens the dialog; what its heading line says. */
export function assetsSummary(state: AssetsState): string {
  if (state.status === 'error') return state.message;
  const parts = [`Research: ${RESEARCH_MODE_LABELS[state.mode]}`];
  if (state.mode === 'allowlist') {
    parts.push(`sources: ${state.sources.map(sourceLabel).join(', ') || 'none'}`);
  }
  const { own, downloaded } = splitAssets(state.assets);
  if (own.length > 0) parts.push(`${String(own.length)} your file${own.length === 1 ? '' : 's'}`);
  parts.push(`${String(downloaded.length)} downloaded`);
  const flagged = unverifiedAssets(state.assets).length;
  if (flagged > 0) parts.push(`${String(flagged)} ⚠ unverified`);
  return parts.join(' · ');
}
