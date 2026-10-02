/**
 * Settings page for the external tools (PLAN.md#6.7): ffmpeg and whisper.cpp as found by
 * auto-detection or chosen with "Browse…" (a picker in main), and the whisper model manager.
 */
import type { SettingsWhisperModel } from '@reelforge/shared';
import { useEffect, useReducer, useState, type JSX } from 'react';
import type {
  FfmpegStatus,
  ToolId,
  ToolsStatus,
  WhisperStatus,
} from '../../shared/settings-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import type { PageProps } from './GeneralSettings.js';
import { EMPTY_WHISPER_VIEW, reduceWhisperModels, whisperRows } from './whisper-models-state.js';

const log = rendererLog('settings-tools');

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  configured: 'chosen by you',
  env: 'from environment variable',
  path: 'found on PATH',
  'common-dir': 'found in a common install folder',
  'app-data': 'installed by ReelForge',
};

function FfmpegSummary({ status }: { readonly status: FfmpegStatus }): JSX.Element {
  if (status.status !== 'found') {
    return <p className="tool-problem">{status.message}</p>;
  }
  return (
    <dl className="tool-facts">
      <dt>Path</dt>
      <dd className="mono" title={status.path}>
        {status.path}
      </dd>
      <dt>Version</dt>
      <dd>
        {status.version}{' '}
        <span className={`license-badge license-${status.license.toLowerCase()}`}>
          {status.license}
          {status.version3 ? ' v3' : ''}
        </span>
      </dd>
      <dt>Source</dt>
      <dd>{SOURCE_LABELS[status.source] ?? status.source}</dd>
      <dt>GPU encoders</dt>
      <dd>
        {status.hardwareEncoders.length === 0
          ? 'none built in'
          : status.hardwareEncoders.join(', ')}
      </dd>
    </dl>
  );
}

function WhisperSummary({ status }: { readonly status: WhisperStatus }): JSX.Element {
  if (status.status !== 'found') {
    return (
      <p className="tool-problem">
        {status.configured
          ? status.message
          : 'whisper.cpp was not found. Choose your whisper-cli with Browse… (or set REELFORGE_WHISPER).'}
      </p>
    );
  }
  return (
    <dl className="tool-facts">
      {status.installs.map((install) => (
        <div key={install.path} className="tool-fact-row">
          <dt>{install.backend}</dt>
          <dd className="mono" title={install.path}>
            {install.path}{' '}
            <span className="muted">({SOURCE_LABELS[install.source] ?? install.source}, MIT)</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ToolCard(props: {
  readonly title: string;
  readonly tool: ToolId;
  readonly configured: boolean;
  readonly found: boolean;
  readonly busy: boolean;
  readonly onBrowse: (tool: ToolId) => void;
  readonly onReset: (tool: ToolId) => void;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <section className="tool-card" aria-label={props.title}>
      <header className="tool-card-header">
        <span className={`connect-dot tone-${props.found ? 'ok' : 'error'}`} aria-hidden="true" />
        <h3 className="settings-heading">{props.title}</h3>
        <span className="tool-card-actions">
          {props.configured && (
            <button
              type="button"
              className="small-button"
              disabled={props.busy}
              onClick={() => {
                props.onReset(props.tool);
              }}
            >
              Use auto-detect
            </button>
          )}
          <button
            type="button"
            className="small-button"
            disabled={props.busy}
            onClick={() => {
              props.onBrowse(props.tool);
            }}
          >
            Browse…
          </button>
        </span>
      </header>
      {props.children}
    </section>
  );
}

function WhisperModels({ state, update }: PageProps): JSX.Element {
  const [view, dispatch] = useReducer(reduceWhisperModels, EMPTY_WHISPER_VIEW);
  const reload = (): void => {
    window.reelforge.getWhisperModels().then(
      (list) => {
        dispatch({ type: 'loaded', list });
      },
      (reason: unknown) => {
        log.error(`getWhisperModels failed: ${errorMessage(reason)}`);
      },
    );
  };
  useEffect(() => {
    reload();
    return window.reelforge.onWhisperProgress((progress) => {
      dispatch({ type: 'progress', progress });
      if (progress.phase !== 'downloading') reload();
    });
  }, []);
  const act = (action: () => Promise<unknown>): void => {
    action().then(reload, (reason: unknown) => {
      dispatch({ type: 'error', message: errorMessage(reason) });
    });
  };
  const download = (model: SettingsWhisperModel): void => {
    act(async () => {
      const result = await window.reelforge.downloadWhisperModel(model);
      if (result.status === 'busy') {
        dispatch({ type: 'error', message: `${result.downloading} is still downloading` });
      }
    });
  };
  const remove = (model: SettingsWhisperModel): void => {
    act(async () => {
      const result = await window.reelforge.deleteWhisperModel(model);
      if (result.status === 'error') dispatch({ type: 'error', message: result.message });
    });
  };
  const active = state.settings.tools.whisperModel;
  return (
    <section className="tool-card" aria-label="Whisper models">
      <h3 className="settings-heading">Whisper models</h3>
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
          {whisperRows(view).map((row) => (
            <tr key={row.id} data-status={row.status}>
              <td>
                <input
                  type="radio"
                  name="whisper-model"
                  aria-label={`Use ${row.id}`}
                  checked={active === row.id}
                  onChange={() => {
                    update({ tools: { whisperModel: row.id } });
                  }}
                />
              </td>
              <td className="mono">{row.id}</td>
              <td>{row.sizeLabel}</td>
              <td>
                {row.statusLabel}
                {row.percent !== null && (
                  <progress className="model-progress" max={100} value={row.percent} />
                )}
              </td>
              <td className="model-actions">
                {row.canDownload && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      download(row.id);
                    }}
                  >
                    Download
                  </button>
                )}
                {row.canCancel && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      act(() => window.reelforge.cancelWhisperDownload(row.id));
                    }}
                  >
                    Cancel
                  </button>
                )}
                {row.canDelete && (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      remove(row.id);
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
      {view.error !== undefined && (
        <p className="connect-error" role="alert">
          {view.error}
        </p>
      )}
      <p className="muted">
        Downloads are checked against published SHA-256 hashes. Stored in{' '}
        <span className="mono">{view.list?.modelsDir ?? '…'}</span>
        {view.list?.vadInstalled === false
          ? ' · the voice-activity model comes with the first download.'
          : '.'}
      </p>
    </section>
  );
}

export function ToolsPage(props: PageProps): JSX.Element {
  const [tools, setTools] = useState<ToolsStatus | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const run = (action: () => Promise<ToolsStatus | undefined>): void => {
    setBusy(true);
    setMessage(undefined);
    action()
      .then((next) => {
        if (next !== undefined) setTools(next);
      })
      .catch((reason: unknown) => {
        setMessage(errorMessage(reason));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  useEffect(() => {
    run(() => window.reelforge.getToolsStatus(false));
  }, []);
  const browse = (tool: ToolId): void => {
    run(async () => {
      const result = await window.reelforge.browseToolPath(tool);
      if (result.status === 'invalid') setMessage(result.message);
      return result.status === 'saved' ? result.tools : undefined;
    });
  };
  const reset = (tool: ToolId): void => {
    run(() => window.reelforge.resetToolPath(tool));
  };
  return (
    <div className="settings-page">
      {tools === undefined ? (
        <p className="muted" role="status">
          Looking for ffmpeg and whisper.cpp…
        </p>
      ) : (
        <>
          <ToolCard
            title="ffmpeg"
            tool="ffmpeg"
            configured={
              tools.ffmpeg.status === 'found'
                ? tools.ffmpeg.source === 'configured'
                : tools.ffmpeg.configured
            }
            found={tools.ffmpeg.status === 'found'}
            busy={busy}
            onBrowse={browse}
            onReset={reset}
          >
            <FfmpegSummary status={tools.ffmpeg} />
          </ToolCard>
          <ToolCard
            title="whisper.cpp"
            tool="whisper"
            configured={
              tools.whisper.status === 'found'
                ? tools.whisper.installs.some((install) => install.source === 'configured')
                : tools.whisper.configured
            }
            found={tools.whisper.status === 'found'}
            busy={busy}
            onBrowse={browse}
            onReset={reset}
          >
            <WhisperSummary status={tools.whisper} />
          </ToolCard>
        </>
      )}
      {message !== undefined && (
        <p className="connect-error" role="alert">
          {message}
        </p>
      )}
      <WhisperModels {...props} />
    </div>
  );
}
