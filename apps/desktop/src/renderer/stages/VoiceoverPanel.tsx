/**
 * Voiceover (PLAN.md#7.2): the current recording, Import a file / Record in the app / Replace
 * (the previous take is archived and later stages are marked out of date; scenes keep their
 * anchors and follow the new timing), and the VO <-> script discrepancy report: the length
 * against the word-count estimate now, the alignment and its mismatch regions (click to seek)
 * after Words timed. With a voice and key for the project's channel, "Generate with ElevenLabs"
 * (PLAN.md#13.14) sits next to them, then the generated sentences with play and redo.
 */
import { useState, type JSX } from 'react';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import type { StageReports } from '../../shared/voiceover-contract.js';
import { StageProgress } from './StageProgress.js';
import { Recorder } from './Recorder.js';
import { useRecorder } from './use-recorder.js';
import { useVoice } from './use-voice.js';
import { GenerateButton, GenerateStatus, useGenerateFlow } from './VoiceoverGenerate.js';
import { VoiceSentences } from './VoiceSentences.js';
import type { StagesControls } from './use-stages.js';
import { MismatchList } from './WordsPanel.js';
import { alignmentView, clock, voFit } from './vo-view.js';

export interface VoiceoverPanelProps {
  readonly stages: StagesControls;
  readonly reports: StageReports | undefined;
  /** The recording in the project listing (vo-view.ts voiceoverFile), with or without a record. */
  readonly recordingFile: string | null;
  /** timing/words.json has words. */
  readonly timed: boolean;
  readonly onSeek: (t: number) => void;
  readonly onClose: () => void;
}

function Current(props: {
  readonly reports: StageReports | undefined;
  readonly recordingFile: string | null;
  /** The voice-over in use came from ElevenLabs Generate. */
  readonly generated: boolean;
}): JSX.Element {
  const record = props.reports?.voiceover ?? null;
  if (record === null) {
    if (props.recordingFile !== null) {
      return (
        <p className="vo-current">
          <strong>{props.recordingFile.split('/').at(-1)}</strong>
          <span className="muted"> · in the project</span>
        </p>
      );
    }
    return <p className="muted">No recording yet. Record one here or import a file.</p>;
  }
  const imported = new Date(record.importedAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <p className="vo-current">
      <strong>{props.generated ? 'Generated with ElevenLabs' : record.sourceName}</strong>
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
  readonly hasRecording: boolean;
  readonly timed: boolean;
  readonly onSeek: (t: number) => void;
}): JSX.Element {
  const fit = voFit(props.reports?.voReport ?? null, props.hasRecording);
  const alignment = alignmentView(props.reports?.words ?? null, props.timed);
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
  const has = props.reports?.voiceover != null || props.recordingFile !== null;
  const info = state?.stages.find((stage) => stage.stage === 'voiceover');
  const voice = useVoice(`${info?.status ?? ''}:${info?.updatedAt ?? ''}`);
  const flow = useGenerateFlow(voice);
  const setup = voice.state?.setup;
  const voiceBusy = voice.progress !== null || flow.phase.kind !== 'idle';
  const busy = recorder.phase !== 'idle' || running !== null || queued || voiceBusy;
  const generateReady = setup?.status === 'ready';

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
        <Current
          reports={props.reports}
          recordingFile={props.recordingFile}
          generated={voice.state?.generated === true}
        />
        <div className="vo-actions" role="group" aria-label="Voice-over actions">
          <GenerateButton
            setup={setup}
            generated={voice.state?.generated === true}
            flow={flow}
            busy={busy}
          />
          <button
            type="button"
            className="small-button"
            disabled={busy}
            title="wav, mp3, m4a, ogg or flac"
            onClick={() => {
              void window.reelforge.importVoiceover().then(report);
            }}
          >
            {has ? 'Replace with a file…' : 'Import a file…'}
          </button>
          <button
            type="button"
            className={generateReady ? 'small-button' : 'small-button primary'}
            disabled={busy}
            onClick={() => {
              void recorder.open();
            }}
          >
            {has ? 'Record a new take…' : 'Record…'}
          </button>
        </div>
        <GenerateStatus setup={setup} voice={voice} flow={flow} />
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
        <VoiceSentences
          sentences={voice.state?.sentences ?? []}
          audioFile={voice.state?.audioFile ?? null}
          voice={voice}
          busy={busy}
        />
        <FitReport
          reports={props.reports}
          hasRecording={has}
          timed={props.timed}
          onSeek={props.onSeek}
        />
      </div>
    </section>
  );
}
