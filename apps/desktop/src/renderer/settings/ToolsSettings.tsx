/**
 * Settings page for the external tools (PLAN.md#6.7): ffmpeg as found by auto-detection or chosen
 * with "Browse…" (a picker in main), the whisper.cpp engine (install / re-detect / browse / use an
 * existing build) and the whisper models.
 */
import { useEffect, useState, type JSX } from 'react';
import type { FfmpegStatus, ToolId, ToolsStatus } from '../../shared/settings-contract.js';
import { errorMessage } from '../log.js';
import type { PageProps } from './GeneralSettings.js';
import { useWhisperSetup } from './use-whisper-setup.js';
import { DownloadConfirm, WhisperEngineCard, WhisperModelsCard } from './WhisperSetup.js';

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  configured: 'chosen by you',
  env: 'from environment variable',
  path: 'found on PATH',
  'common-dir': 'found in a common install folder',
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

export function ToolsPage(props: PageProps): JSX.Element {
  const [tools, setTools] = useState<ToolsStatus | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const { whisperModel, whisperPath } = props.state.settings.tools;
  const whisper = useWhisperSetup(`${whisperModel}|${whisperPath ?? ''}`);
  /** `whisperChanged`: a whisper path was picked / reset, so its card re-detects afterwards. */
  const run = (action: () => Promise<ToolsStatus | undefined>, whisperChanged = false): void => {
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
        if (whisperChanged) whisper.reload(true);
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
    }, tool === 'whisper');
  };
  const reset = (tool: ToolId): void => {
    run(() => window.reelforge.resetToolPath(tool), tool === 'whisper');
  };
  return (
    <div className="settings-page">
      {tools === undefined ? (
        <p className="muted" role="status">
          Looking for ffmpeg…
        </p>
      ) : (
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
      )}
      <WhisperEngineCard
        setup={whisper}
        busy={busy}
        onBrowse={() => {
          browse('whisper');
        }}
        onReset={() => {
          reset('whisper');
        }}
      />
      {message !== undefined && (
        <p className="connect-error" role="alert">
          {message}
        </p>
      )}
      <WhisperModelsCard
        setup={whisper}
        active={whisperModel}
        onChoose={(model) => {
          props.update({ tools: { whisperModel: model } });
        }}
      />
      <DownloadConfirm setup={whisper} />
    </div>
  );
}
