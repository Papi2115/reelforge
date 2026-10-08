/**
 * whisper.cpp setup widgets (Settings → Tools, first-run "Prepare tools", the Words timed notice):
 * the install progress line (bytes, speed, time left, Cancel; failures with their actionable
 * message and details), the download confirmation, the "Whisper engine" card and the models.
 */
import { useState, type JSX } from 'react';
import type { SettingsWhisperModel } from '@reelforge/shared';
import type { WhisperProgress } from '../../shared/whisper-contract.js';
import { ConfirmDialog } from '../project/ConfirmDialog.js';
import type { WhisperSetupController } from './use-whisper-setup.js';
import {
  backendLabel,
  engineCardView,
  formatBytes,
  modelRows,
  progressView,
} from './whisper-setup-state.js';

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  configured: 'chosen by you',
  env: 'from REELFORGE_WHISPER',
  'app-data': 'installed by ReelForge',
  path: 'on PATH',
  'common-dir': 'found on this PC',
};

export function InstallProgress(props: {
  readonly progress: WhisperProgress;
  readonly onCancel: () => void;
}): JSX.Element | null {
  const [details, setDetails] = useState(false);
  const { progress } = props;
  const view = progressView(progress);
  if (progress.phase === 'failed') {
    return (
      <div className="install-failed">
        <p className="connect-error" role="alert">
          {progress.message ?? 'The download failed.'}
        </p>
        {progress.detail !== null && (
          <button
            type="button"
            className="link-button"
            aria-expanded={details}
            onClick={() => {
              setDetails((open) => !open);
            }}
          >
            {details ? 'Hide details' : 'Show details'}
          </button>
        )}
        {details && <p className="mono muted install-detail">{progress.detail}</p>}
      </div>
    );
  }
  if (progress.phase === 'cancelled') return <p className="muted">Download cancelled.</p>;
  if (!view.running) return null;
  return (
    <div className="install-progress" aria-live="polite">
      <p className="install-label">{view.label}</p>
      <div
        className="stage-progress"
        role="progressbar"
        aria-label="whisper.cpp download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={view.percent}
      >
        <span style={{ width: `${String(view.percent)}%` }} />
      </div>
      <p className="install-detail-line mono muted">
        {view.detail}
        <button type="button" className="small-button" onClick={props.onCancel}>
          Cancel
        </button>
      </p>
    </div>
  );
}

/** "Download 574 MB?" for downloads above 200 MB. */
export function DownloadConfirm({
  setup,
}: {
  readonly setup: WhisperSetupController;
}): JSX.Element | null {
  const { pending } = setup;
  if (pending === undefined) return null;
  return (
    <ConfirmDialog
      title={pending.title}
      confirmLabel="Download the files"
      confirmClass="primary"
      busy={false}
      onConfirm={setup.confirm}
      onCancel={setup.dismiss}
    >
      <p>
        whisper.cpp files are downloaded once from their official sources (GitHub, Hugging Face) and
        checked against published SHA-256 hashes.
      </p>
    </ConfirmDialog>
  );
}

export interface EngineCardProps {
  readonly setup: WhisperSetupController;
  readonly busy: boolean;
  readonly onBrowse: () => void;
  readonly onReset: () => void;
}

export function WhisperEngineCard({
  setup,
  busy,
  onBrowse,
  onReset,
}: EngineCardProps): JSX.Element {
  const { view } = setup;
  const card = engineCardView(view);
  const engine = view.state?.engine;
  const progress = view.progress;
  const jobHere =
    progress !== undefined && (progress.job.kind === 'engine' || progress.job.kind === 'setup');
  return (
    <section className="tool-card" aria-label="Whisper engine">
      <header className="tool-card-header">
        <span
          className={`connect-dot tone-${card?.installed === true ? 'ok' : 'error'}`}
          aria-hidden="true"
        />
        <h3 className="settings-heading">Whisper engine</h3>
        <span className="tool-card-actions">
          {engine?.configured === true && (
            <button type="button" className="small-button" disabled={busy} onClick={onReset}>
              Use auto-detect
            </button>
          )}
          <button
            type="button"
            className="small-button"
            disabled={busy}
            onClick={() => {
              setup.reload(true);
            }}
          >
            Re-detect
          </button>
          <button type="button" className="small-button" disabled={busy} onClick={onBrowse}>
            Browse…
          </button>
        </span>
      </header>
      {card === undefined || engine === undefined ? (
        <p className="muted" role="status">
          Looking for whisper.cpp…
        </p>
      ) : (
        <>
          <p className="engine-headline" data-installed={card.installed}>
            {card.headline}
          </p>
          {engine.problem !== null && engine.configured && (
            <p className="tool-problem">{engine.problem}</p>
          )}
          {engine.installs.length > 0 && (
            <dl className="tool-facts">
              {engine.installs.map((install) => (
                <div key={install.path} className="tool-fact-row">
                  <dt>{backendLabel(install.backend)}</dt>
                  <dd className="mono" title={install.path}>
                    {install.path}{' '}
                    <span className="muted">
                      ({SOURCE_LABELS[install.source] ?? install.source}, MIT)
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {card.gpuWarning !== null && <p className="tool-problem">{card.gpuWarning}</p>}
          {card.installLabel !== null && (
            <div className="engine-actions">
              <button
                type="button"
                className="primary"
                disabled={card.blocked}
                onClick={() => {
                  setup.request({ kind: 'engine' }, card.installBytes);
                }}
              >
                {card.installLabel}
              </button>
              <span className="muted">
                {engine.installBackends.includes('cuda')
                  ? 'NVIDIA GPU found: the CUDA build plus a CPU fallback.'
                  : 'The CPU build (OpenBLAS).'}
              </span>
            </div>
          )}
          {engine.existing.length > 0 && (
            <ul className="existing-installs">
              {engine.existing.map((found) => (
                <li key={found.path}>
                  <button
                    type="button"
                    className="small-button"
                    disabled={busy || card.blocked}
                    onClick={() => {
                      setup.useExisting(found.path);
                    }}
                  >
                    Use existing installation
                  </button>{' '}
                  found at <span className="mono">{found.path}</span>{' '}
                  <span className="muted">({SOURCE_LABELS[found.source] ?? found.source})</span>
                </li>
              ))}
            </ul>
          )}
          {jobHere && <InstallProgress progress={progress} onCancel={setup.cancel} />}
          <p className="muted">
            Installed into <span className="mono">{engine.root}</span>.
          </p>
        </>
      )}
    </section>
  );
}

export interface ModelsCardProps {
  readonly setup: WhisperSetupController;
  readonly active: SettingsWhisperModel;
  readonly onChoose: (model: SettingsWhisperModel) => void;
}

export function WhisperModelsCard({ setup, active, onChoose }: ModelsCardProps): JSX.Element {
  const { view } = setup;
  const rows = modelRows(view);
  const state = view.state;
  const recommended = rows.find((row) => row.recommended);
  const progress = view.progress;
  const jobHere = progress !== undefined && progress.job.kind === 'model';
  return (
    <section className="tool-card" aria-label="Whisper models">
      <header className="tool-card-header">
        <h3 className="settings-heading">Whisper models</h3>
        {recommended !== undefined && recommended.status === 'missing' && (
          <span className="tool-card-actions">
            <button
              type="button"
              className="small-button primary"
              disabled={!recommended.canDownload}
              onClick={() => {
                setup.request({ kind: 'model', model: recommended.id }, recommended.bytes);
                onChoose(recommended.id);
              }}
            >
              Install recommended model ({formatBytes(recommended.bytes)})
            </button>
          </span>
        )}
      </header>
      <table className="model-table">
        <thead>
          <tr>
            <th scope="col">Use</th>
            <th scope="col">Model</th>
            <th scope="col">Size</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-status={row.status}>
              <td>
                <input
                  type="radio"
                  name="whisper-model"
                  aria-label={`Use ${row.id}`}
                  checked={active === row.id}
                  onChange={() => {
                    onChoose(row.id);
                  }}
                />
              </td>
              <td className="mono">
                {row.id}
                {row.recommended && <span className="muted"> (recommended)</span>}
              </td>
              <td>{row.sizeLabel}</td>
              <td>{row.statusLabel}</td>
              <td className="model-actions">
                {row.canDownload && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      setup.request({ kind: 'model', model: row.id }, row.bytes);
                    }}
                  >
                    Download
                  </button>
                )}
                {row.canCancel && (
                  <button type="button" className="small-button" onClick={setup.cancel}>
                    Cancel
                  </button>
                )}
                {row.canDelete && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      setup.remove(row.id);
                    }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {jobHere && <InstallProgress progress={progress} onCancel={setup.cancel} />}
      {view.error !== undefined && (
        <p className="connect-error" role="alert">
          {view.error}
        </p>
      )}
      <p className="muted">
        Downloads are checked against published SHA-256 hashes. Stored in{' '}
        <span className="mono">{state?.modelsDir ?? '…'}</span>
        {state?.vadInstalled === false
          ? ' · the voice-activity model (1 MB) comes with the first model.'
          : '.'}
      </p>
    </section>
  );
}
