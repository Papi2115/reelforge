/**
 * Words timed viewer (PLAN.md#6.8 Open): every word of timing/words.json with its spoken time;
 * words the alignment only guessed (fuzzy) or could not find (missing) are marked. Clicking a word
 * moves the preview there.
 */
import type { JSX } from 'react';
import type { WordsFile } from '@reelforge/shared';
import type { FileState } from '../../shared/snapshot-contract.js';
import { formatTime } from '../layout/timeline-scale.js';

export interface WordsPanelProps {
  readonly words: FileState<WordsFile> | undefined;
  readonly onSeek: (t: number) => void;
  readonly onClose: () => void;
}

function Body({ words, onSeek }: Omit<WordsPanelProps, 'onClose'>): JSX.Element {
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
        <Body words={props.words} onSeek={props.onSeek} />
      </div>
    </section>
  );
}
