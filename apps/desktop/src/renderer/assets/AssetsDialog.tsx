/**
 * "Assets" (PLAN.md#12.10), opened from the pipeline's Assets row: the "Asset package" review of
 * research mode ask (thumbnails, sanitised title, source, author, licence badge, a checkbox each;
 * Approve selected / Reject all; only the app can approve) and the project's downloaded assets
 * with ⚠ for unverified licences. Keyboard: native checkboxes and buttons, Escape closes.
 */
import { useEffect, useId, useRef, useState, type JSX } from 'react';
import type { AssetView, ProposalView } from '../../shared/assets-contract.js';
import { projectMediaUrl } from '../../shared/player-contract.js';
import {
  approvedKeys,
  approveLabel,
  assetsSummary,
  initialSelection,
  licenceBadge,
  sizeText,
  sourceLabel,
  toggled,
} from './assets-view.js';
import type { AssetsController } from './use-assets.js';

function LicenceChip({ licence }: { readonly licence: AssetView['licence'] }): JSX.Element {
  const badge = licenceBadge(licence);
  return (
    <span className={`asset-licence asset-licence-${badge.tone}`} title={badge.title}>
      {badge.text}
    </span>
  );
}

function PackageReview(props: {
  readonly proposal: ProposalView;
  readonly onReview: (approve: readonly string[]) => void;
  readonly busy: boolean;
}): JSX.Element {
  const { proposal } = props;
  const [selection, setSelection] = useState(() => initialSelection(proposal));
  const headingId = useId();
  const keys = approvedKeys(proposal, selection);
  return (
    <section className="asset-package" aria-labelledby={headingId}>
      <h3 className="section-title" id={headingId}>
        Asset package {proposal.number}: choose what Claude may use
      </h3>
      <p className="muted">
        Ticked items are downloaded into the project; the rest are rejected and their shots use kit
        visuals. Titles and authors come from the source sites.
      </p>
      <ul className="asset-grid" aria-label={`Asset package ${String(proposal.number)}`}>
        {proposal.items.map((item) => {
          const size = sizeText(item.width, item.height);
          return (
            <li key={item.key} className="asset-card">
              <label className="asset-card-label">
                <input
                  type="checkbox"
                  checked={selection.has(item.key)}
                  onChange={() => {
                    setSelection((current) => toggled(current, item.key));
                  }}
                  aria-label={`Use ${item.title}`}
                />
                {item.thumbnail === null ? (
                  <span className="asset-thumb asset-thumb-missing">no preview</span>
                ) : (
                  <img
                    className="asset-thumb"
                    src={projectMediaUrl(item.thumbnail, proposal.number)}
                    alt=""
                  />
                )}
                <span className="asset-title">{item.title}</span>
              </label>
              <span className="asset-meta muted">
                {sourceLabel(item.source)} · {item.author}
                {size === null ? '' : ` · ${size}`} · {item.kind}
              </span>
              <LicenceChip licence={item.licence} />
            </li>
          );
        })}
      </ul>
      <div className="asset-actions">
        <button
          type="button"
          className="primary"
          disabled={props.busy || keys.length === 0}
          onClick={() => {
            props.onReview(keys);
          }}
        >
          {approveLabel(keys.length)}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={props.busy}
          onClick={() => {
            props.onReview([]);
          }}
        >
          Reject all
        </button>
      </div>
    </section>
  );
}

function AssetList({ assets }: { readonly assets: readonly AssetView[] }): JSX.Element {
  if (assets.length === 0) return <p className="muted">No assets downloaded yet.</p>;
  return (
    <ul className="asset-list" aria-label="Downloaded assets">
      {assets.map((asset) => (
        <li
          key={asset.id}
          className={`asset-row${asset.licence.verified ? '' : ' asset-row-unverified'}`}
        >
          {asset.image === null ? (
            <span className="asset-thumb-small asset-thumb-missing">{asset.kind}</span>
          ) : (
            <img className="asset-thumb-small" src={projectMediaUrl(asset.image, 0)} alt="" />
          )}
          <span className="asset-row-text">
            <span className="asset-title">
              {asset.licence.verified ? '' : '⚠ '}
              {asset.title}
            </span>
            <span className="asset-meta muted">
              <span className="mono">{asset.id}</span> · {sourceLabel(asset.source)} ·{' '}
              {asset.author}
              {asset.approved ? ' · approved by you' : ''}
            </span>
          </span>
          <LicenceChip licence={asset.licence} />
        </li>
      ))}
    </ul>
  );
}

export interface AssetsDialogProps {
  readonly assets: AssetsController;
  readonly onClose: () => void;
}

export function AssetsDialog({ assets, onClose }: AssetsDialogProps): JSX.Element {
  const { state } = assets;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const pending = state?.status === 'ok' ? state.pending[0] : undefined;
  const downloaded = state?.status === 'ok' ? state.assets.length : 0;
  // "Downloading…" ends when the downloaded assets show up in the list.
  useEffect(() => {
    setNotice(null);
  }, [downloaded]);

  const review = (number: number, approve: readonly string[]): void => {
    setBusy(true);
    setNotice(null);
    void assets.review(number, approve).then((result) => {
      setBusy(false);
      setNotice(result.message);
    });
  };

  return (
    <div className="modal-backdrop">
      <div
        className="settings-dialog assets-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Assets"
        onKeyDown={(event) => {
          // Keys stay in the dialog (Space ticks a checkbox, not play/pause); Escape still closes.
          if (event.key !== 'Escape') event.stopPropagation();
        }}
      >
        <header className="settings-header">
          <div className="project-settings-heading">
            <h2 className="modal-title">Assets</h2>
            <span className="muted project-settings-subtitle">
              {state === undefined ? 'Loading…' : assetsSummary(state)}
            </span>
          </div>
          <button ref={closeRef} type="button" className="small-button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="assets-body">
          {pending !== undefined && (
            <PackageReview
              key={pending.number}
              proposal={pending}
              busy={busy}
              onReview={(approve) => {
                review(pending.number, approve);
              }}
            />
          )}
          {notice !== null && (
            <p className="export-note" role="status">
              {notice}
            </p>
          )}
          {state?.status === 'ok' && (
            <section aria-label="In this project">
              <h3 className="section-title">In this project</h3>
              <AssetList assets={state.assets} />
              {state.problem !== null && <p className="panel-error">{state.problem}</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
