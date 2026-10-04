/**
 * "Assets" (PLAN.md#12.10, #12.12, #12.19), opened from the pipeline's Assets row or the Assets
 * button of the Pipeline panel. Tab "This project": the "Asset package" review of research mode ask
 * (thumbnails, sanitised title, source, author, licence badge, a checkbox each; Approve selected /
 * Reject all; only the app can approve), the user's own files (add, drop, describe, remove) and the
 * downloaded assets with ⚠ for unverified licences, each with "Save to library". Tab "Library": the
 * global asset library. Keyboard: native checkboxes and buttons, Escape closes.
 */
import { useCallback, useEffect, useId, useRef, useState, type JSX } from 'react';
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
  splitAssets,
  toggled,
} from './assets-view.js';
import { LibraryPanel } from './LibraryPanel.js';
import { LibraryToggle, OwnAssets } from './OwnAssets.js';
import type { AssetsController } from './use-assets.js';

type Run = (action: () => Promise<{ message: string | null }>) => void;

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

function AssetList(props: {
  readonly assets: readonly AssetView[];
  readonly controller: AssetsController;
  readonly busy: boolean;
  readonly run: Run;
}): JSX.Element {
  const { assets } = props;
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
              {asset.fromLibrary ? ' · from your library' : ''}
            </span>
          </span>
          <LicenceChip licence={asset.licence} />
          <LibraryToggle
            asset={asset}
            busy={props.busy}
            onToggle={(save) => {
              props.run(() => props.controller.setInLibrary(asset.id, save));
            }}
          />
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
  const { own, downloaded } = splitAssets(state?.status === 'ok' ? state.assets : []);
  // "Downloading…" ends when the downloaded assets show up in the list.
  useEffect(() => {
    setNotice(null);
  }, [downloaded.length]);
  const [tab, setTab] = useState<'project' | 'library'>('project');

  const review = (number: number, approve: readonly string[]): void => {
    setBusy(true);
    setNotice(null);
    void assets.review(number, approve).then((result) => {
      setBusy(false);
      setNotice(result.message);
    });
  };

  /** One action at a time; its message (if any) shows in the status line. */
  const run = useCallback<Run>((action) => {
    setBusy(true);
    setNotice(null);
    void action().then((result) => {
      setBusy(false);
      setNotice(result.message);
    });
  }, []);

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
          <div className="assets-tabs" role="group" aria-label="Show">
            <button
              type="button"
              className="small-button"
              aria-pressed={tab === 'project'}
              onClick={() => {
                setTab('project');
              }}
            >
              This project
            </button>
            <button
              type="button"
              className="small-button"
              aria-pressed={tab === 'library'}
              title="Your asset library: shared by all your projects"
              onClick={() => {
                setTab('library');
              }}
            >
              Library
            </button>
          </div>
          <button ref={closeRef} type="button" className="small-button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="assets-body">
          {notice !== null && notice !== '' && (
            <p className="export-note" role="status">
              {notice}
            </p>
          )}
          {tab === 'library' ? (
            <LibraryPanel onChanged={assets.reload} run={run} />
          ) : (
            <>
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
              {state?.status === 'ok' && (
                <>
                  <OwnAssets
                    assets={own}
                    controller={assets}
                    busy={busy}
                    run={run}
                    onNotice={setNotice}
                  />
                  <section aria-label="Downloaded">
                    <h3 className="section-title">Downloaded</h3>
                    <AssetList assets={downloaded} controller={assets} busy={busy} run={run} />
                    {state.problem !== null && <p className="panel-error">{state.problem}</p>}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
