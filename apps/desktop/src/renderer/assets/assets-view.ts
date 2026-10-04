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

/** `wikimedia` -> `Wikimedia Commons`; `web` -> a direct link (full auto). */
export function sourceLabel(source: string): string {
  if (source === 'web') return 'Web (direct link)';
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

/** Downloaded assets with an unverified licence (⚠). */
export function unverifiedAssets(assets: readonly AssetView[]): AssetView[] {
  return assets.filter((asset) => !asset.licence.verified);
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
  if (state?.status !== 'ok' || state.assets.length === 0) return null;
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
  parts.push(`${String(state.assets.length)} downloaded`);
  const flagged = unverifiedAssets(state.assets).length;
  if (flagged > 0) parts.push(`${String(flagged)} ⚠ unverified`);
  return parts.join(' · ');
}
