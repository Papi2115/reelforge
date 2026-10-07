/**
 * "Look assets" in Scenes built (PLAN.md#13.15), world films only: the status of the world-assets
 * step, its findings, "Design look assets" / "Redo look assets" (the scenes action `world-assets`)
 * and the designed things by name (look-assets-view.ts).
 */
import type { JSX } from 'react';
import type { StageRunView } from '../../shared/stages-contract.js';
import type { LookAssets } from '../../shared/voiceover-contract.js';
import { lookAssetsView, type LookAssetsTone } from './look-assets-view.js';

/** The status line borrows the fit report's left border (panels.css `.fit-line`). */
const FIT_TONE: Readonly<Record<LookAssetsTone, string>> = {
  none: 'none',
  running: 'none',
  ok: 'ok',
  warning: 'warn',
  failed: 'bad',
};

export function LookAssetsSection(props: {
  readonly look: LookAssets;
  readonly running: StageRunView | null;
  readonly busy: boolean;
  readonly hasShots: boolean;
  readonly onDesign: () => void;
}): JSX.Element {
  const view = lookAssetsView(props.look, props);
  return (
    <section className="look-assets" aria-label="Look assets">
      <div className="look-assets-head">
        <h3 className="section-title">Look assets</h3>
        <button
          type="button"
          className="small-button"
          aria-disabled={view.button.disabled}
          title={view.button.title}
          onClick={() => {
            if (!view.button.disabled) props.onDesign();
          }}
        >
          {view.button.label}
        </button>
      </div>
      <p className={`fit-line fit-${FIT_TONE[view.tone]}`} data-testid="look-assets-status">
        {view.status}
      </p>
      {view.note !== null && <p className="muted">{view.note}</p>}
      {view.findings.length > 0 && (
        <ul className="fit-details" aria-label="Look asset findings">
          {view.findings.map((finding, index) => (
            <li key={`${String(index)}:${finding}`}>{finding}</li>
          ))}
        </ul>
      )}
      {view.rows.length > 0 && (
        <ul className="look-asset-list" aria-label="Designed look assets">
          {view.rows.map((row) => (
            <li key={row.key}>
              <span>{row.name}</span> <span className="muted mono">{row.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
