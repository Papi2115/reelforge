/**
 * The export dialog's asset section (PLAN.md#12.10): a ⚠ warning listing the assets with an
 * unverified licence (like the final review's pre-flight list, the export is not blocked) and
 * the "Credits" text for the video description with a Copy button (the publish kit, 12.17,
 * builds on it). Nothing when the project has no downloaded assets.
 */
import type { JSX } from 'react';
import { CopyButton } from '../export/YoutubeExtras.js';
import { exportAssetsView, sourceLabel } from './assets-view.js';
import { useAssets } from './use-assets.js';

export function ExportAssets({ dir }: { readonly dir: string }): JSX.Element | null {
  const { state } = useAssets(dir, '');
  const view = exportAssetsView(state);
  if (view === null) return null;
  return (
    <section className="export-assets" aria-label="Assets and credits">
      {view.warning !== null && (
        <div className="export-preflight" role="alert">
          <p className="export-preflight-title qa-warning">{view.warning}</p>
          <ul className="preflight-list" aria-label="Unverified assets">
            {view.unverified.map((asset) => (
              <li key={asset.id} className="preflight-item">
                <span className="qa-warning">⚠</span>
                <span className="mono">{asset.id}</span>
                <span className="preflight-text">
                  {asset.title} · {sourceLabel(asset.source)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.credits !== null && (
        <div className="export-credits">
          <div className="export-row">
            <span className="export-label">{view.creditsTitle}</span>
            <CopyButton text={view.credits.markdown} label="credits" />
          </div>
          <pre className="export-credits-text" aria-label="Credits">
            {view.credits.markdown}
          </pre>
        </div>
      )}
    </section>
  );
}
