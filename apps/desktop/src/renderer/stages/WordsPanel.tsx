/**
 * Words timed viewer (PLAN.md#6.8 Open, #7.2): the alignment quality (share of the script heard,
 * the whisper model) with "Retry with a bigger model", the mismatch regions (script vs heard) and
 * every word of timing/words.json with its spoken time; words the alignment only guessed (fuzzy)
 * or could not find (missing) are marked. Clicking a word or a region moves the preview there.
 */
import { useState, type JSX } from 'react';
import type { WordsFile, WordsReport } from '@reelforge/shared';
import type { FileState } from '../../shared/snapshot-contract.js';
import { formatTime } from '../layout/timeline-scale.js';
import {
  alignmentView,
  biggerWhisperModel,
  cpuTranscriptionHint,
  type MismatchRow,
} from './vo-view.js';

export interface WordsPanelProps {
  readonly words: FileState<WordsFile> | undefined;
  readonly report: WordsReport | null;
  /** Words timed runs or waits. */
  readonly busy: boolean;
  readonly onSeek: (t: number) => void;
  readonly onClose: () => void;
}

export function MismatchList(props: {
  readonly rows: readonly MismatchRow[];
  readonly onSeek: (t: number) => void;
}): JSX.Element | null {
  if (props.rows.length === 0) return null;
  return (
    <table className="mismatch-table">
      <caption className="muted">Where the recording differs from the script</caption>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Script</th>
          <th scope="col">Heard</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.key}>
            <td>
              <button
                type="button"
                className="link-button mono"
                title="Play from here"
                onClick={() => {
                  props.onSeek(row.t);
                }}
              >
                {row.time}
              </button>
            </td>
            <td>{row.script}</td>
            <td>{row.heard}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Quality(props: {
  readonly report: WordsReport | null;
  readonly busy: boolean;
  readonly onSeek: (t: number) => void;
}): JSX.Element {
  const [notice, setNotice] = useState<string | null>(null);
  const view = alignmentView(props.report);
  const chosen = props.report?.attempts[props.report.chosen]?.model ?? null;
  const bigger = biggerWhisperModel(chosen);
  const cpuHint = cpuTranscriptionHint(props.report);
  return (
    <section className="words-quality" aria-label="Alignment quality">
      <p className={`fit-line fit-${view.tone}`}>
        {view.headline}
        {view.model !== null && <span className="muted mono"> · {view.model}</span>}
      </p>
      {cpuHint !== null && (
        <p className="words-gpu-hint" role="note">
          {cpuHint}
        </p>
      )}
      {props.report !== null && (
        <div className="vo-actions">
          <button
            type="button"
            className="small-button"
            aria-disabled={bigger === null || props.busy}
            title={
              bigger === null
                ? 'Already on the largest whisper model.'
                : props.busy
                  ? 'Words timed is running or queued.'
                  : `Time the words again with the ${bigger} model (slower, more accurate)`
            }
            onClick={() => {
              if (bigger === null || props.busy) return;
              setNotice(null);
              void window.reelforge.retryWords(bigger).then((result) => {
                if (result.status === 'error') setNotice(result.message ?? 'Not started.');
              });
            }}
          >
            Retry with a bigger model{bigger === null ? '' : ` (${bigger})`}
          </button>
        </div>
      )}
      {notice !== null && (
        <p className="panel-error" role="alert">
          {notice}
        </p>
      )}
      <MismatchList rows={view.mismatches} onSeek={props.onSeek} />
    </section>
  );
}

function Body({ words, onSeek }: Pick<WordsPanelProps, 'words' | 'onSeek'>): JSX.Element {
  if (words === undefined) return <p className="panel-empty">Reading the project…</p>;
  if (words.status === 'missing') {
    return <p className="panel-empty">No timing/words.json yet: run Words timed.</p>;
  }
  if (words.status === 'error') {
    return (
      <p className="panel-empty panel-error" role="alert">
        {words.error.message}
      </p>
    );
  }
  const list = words.data.words;
  const unsure = list.filter((word) => word.status === 'fuzzy' || word.status === 'missing');
  return (
    <>
      <p className="muted words-summary">
        {list.length} words
        {list.length > 0 && ` · ${formatTime(list.at(-1)?.tEnd ?? 0)}`}
        {unsure.length > 0 && ` · ${String(unsure.length)} not heard clearly (marked)`}
      </p>
      <ol className="words-list">
        {list.map((word, index) => (
          <li key={`${String(index)}:${String(word.t)}`}>
            <button
              type="button"
              className={`word-item word-${word.status ?? 'exact'}`}
              title={`${formatTime(word.t)}–${formatTime(word.tEnd)}${word.status === undefined ? '' : ` · ${word.status}`}`}
              onClick={() => {
                onSeek(word.t);
              }}
            >
              <span className="mono muted">{formatTime(word.t)}</span> {word.text}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

export function WordsPanel(props: WordsPanelProps): JSX.Element {
  return (
    <section className="doc-panel" aria-label="Words timed">
      <div className="doc-header">
        <h2 className="doc-title">Words timed</h2>
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div className="doc-body">
        <Quality report={props.report} busy={props.busy} onSeek={props.onSeek} />
        <Body words={props.words} onSeek={props.onSeek} />
      </div>
    </section>
  );
}
