/**
 * Pipeline sidebar notice when Words timed cannot run without whisper.cpp (see words-setup.ts):
 * "Download and continue" (progress in place, the held stages run afterwards), "Not now", and on
 * failure the actionable message with details, Try again and Open Settings.
 */
import { useState, type JSX } from 'react';
import type { WordsSetupView } from '../stages/words-setup.js';

export interface WordsSetupNoticeProps {
  readonly view: WordsSetupView;
  readonly onDownload: () => void;
  readonly onCancel: () => void;
  readonly onDismiss: () => void;
  readonly onOpenSettings: () => void;
}

export function WordsSetupNotice(props: WordsSetupNoticeProps): JSX.Element | null {
  const [details, setDetails] = useState(false);
  const { view } = props;
  if (view.kind === 'hidden') return null;
  return (
    <div className="words-setup" role="region" aria-label="Transcription engine">
      {view.kind === 'needed' && (
        <>
          <p className="words-setup-text">{view.text}</p>
          <div className="words-setup-actions">
            <button type="button" className="small-button primary" onClick={props.onDownload}>
              {view.buttonLabel}
            </button>
            <button type="button" className="small-button" onClick={props.onDismiss}>
              Not now
            </button>
          </div>
        </>
      )}
      {view.kind === 'installing' && (
        <>
          <p className="words-setup-text">{view.progress.label}</p>
          <div
            className="stage-progress"
            role="progressbar"
            aria-label="Transcription engine download"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={view.progress.percent}
          >
            <span style={{ width: `${String(view.progress.percent)}%` }} />
          </div>
          <p className="words-setup-detail mono muted">{view.progress.detail}</p>
          <div className="words-setup-actions">
            <button type="button" className="small-button" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
      {view.kind === 'failed' && (
        <>
          <p className="panel-error" role="alert">
            {view.message}
          </p>
          {view.detail !== null && (
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
          {details && <p className="words-setup-detail mono muted">{view.detail}</p>}
          <div className="words-setup-actions">
            <button type="button" className="small-button primary" onClick={props.onDownload}>
              Try again
            </button>
            <button type="button" className="small-button" onClick={props.onOpenSettings}>
              Open Settings
            </button>
            <button type="button" className="small-button" onClick={props.onDismiss}>
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
