/**
 * Voiceover (PLAN.md#7.2): the current recording, Import a file / Record in the app / Replace
 * (the previous take is archived and later stages are marked out of date; scenes keep their
 * anchors and follow the new timing), and the VO <-> script discrepancy report: the length
 * against the word-count estimate now, the alignment and its mismatch regions (click to seek)
 * after Words timed.
 */
import { useState, type JSX } from 'react';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import type { StageReports } from '../../shared/voiceover-contract.js';
import { StageProgress } from './StageProgress.js';
import { Recorder } from './Recorder.js';
import { useRecorder } from './use-recorder.js';
import type { StagesControls } from './use-stages.js';
import { MismatchList } from './WordsPanel.js';
import { alignmentView, clock, voFit } from './vo-view.js';

export interface VoiceoverPanelProps {
  readonly stages: StagesControls;
  readonly reports: StageReports | undefined;
  readonly onSeek: (t: number) => void;
  readonly onClose: () => void;
}

function Current({ reports }: { readonly reports: StageReports | undefined }): JSX.Element {
  const record = reports?.voiceover ?? null;
  if (record === null) return <p className="muted">No recording yet.</p>;
  const imported = new Date(record.importedAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <p className="vo-current">
      <strong>{record.sourceName}</strong>
      {record.durationS !== null && <span className="mono"> · {clock(record.durationS)}</span>}
      <span className="muted"> · imported {imported}</span>
      {record.previous !== null && (
        <span className="muted"> · previous take kept as {record.previous.file}</span>
      )}
    </p>
  );
}

function FitReport(props: {
  readonly reports: StageReports | undefined;
  readonly onSeek: (t: number) => void;
}): JSX.Element {
  const fit = voFit(props.reports?.voReport ?? null);
  const alignment = alignmentView(props.reports?.words ?? null);
  return (
    <section className="vo-report" aria-label="Voice-over and script">
      <h3 className="section-title">Voice-over vs script</h3>
      <p className={`fit-line fit-${fit.tone}`}>{fit.headline}</p>
      {fit.details.length > 0 && (
        <ul className="fit-details">
          {fit.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className={`fit-line fit-${alignment.tone}`}>{alignment.headline}</p>
      <MismatchList rows={alignment.mismatches} onSeek={props.onSeek} />
    </section>
  );
}

export function VoiceoverPanel(props: VoiceoverPanelProps): JSX.Element {
  const recorder = useRecorder();
  const [notice, setNotice] = useState<string | null>(null);
  const state = props.stages.state;
  const running = state?.running?.stage === 'voiceover' ? state.running : null;
  const queued = state?.queue.includes('voiceover') === true;
  const has = props.reports?.voiceover != null;

  const report = (result: StageCommandResult): void => {
    setNotice(result.status === 'error' ? (result.message ?? 'That did not work.') : null);
  };

  return (
    <section className="doc-panel" aria-label="Voiceover">
      <div className="doc-header">
        <h2 className="doc-title">Voiceover</h2>
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div className="doc-body vo-body">
        <Current reports={props.reports} />
        <div className="vo-actions" role="group" aria-label="Voice-over actions">
          <button
            type="button"
            className="small-button"
            disabled={recorder.phase !== 'idle' || running !== null || queued}
            title="wav, mp3, m4a, ogg or flac"
            onClick={() => {
              void window.reelforge.importVoiceover().then(report);
            }}
          >
            {has ? 'Replace with a file…' : 'Import a file…'}
          </button>
          <button
            type="button"
            className="small-button primary"
            disabled={recorder.phase !== 'idle' || running !== null || queued}
            onClick={() => {
              void recorder.open();
            }}
          >
            {has ? 'Record a new take…' : 'Record…'}
          </button>
        </div>
        {has && (
          <p className="muted vo-hint">
            Replacing keeps the old take as <code>audio/vo.original.prev.*</code> and marks the
            later stages out of date. Run Words timed again: scenes keep their anchors and follow
            the new timing.
          </p>
        )}
        {notice !== null && (
          <p className="panel-error" role="alert">
            {notice}
          </p>
        )}
        {recorder.phase !== 'idle' && (
          <Recorder
            recorder={recorder}
            onSaved={() => {
              setNotice(null);
            }}
          />
        )}
        {(running !== null || queued) && (
          <StageProgress
            title="Importing the voice-over"
            run={running}
            onStop={() => {
              props.stages.stop('voiceover');
            }}
          />
        )}
        <FitReport reports={props.reports} onSeek={props.onSeek} />
      </div>
    </section>
  );
}
