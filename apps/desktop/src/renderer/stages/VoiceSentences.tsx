/**
 * Sentences of the generated voice-over (PLAN.md#13.14): play one (its span of the voice-over in
 * use) and "Redo this sentence" — the paragraph holding it is spoken again after a confirm (it
 * costs characters); the result names the shots under it.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { projectMediaUrl } from '../../shared/player-contract.js';
import type { VoiceSentence } from '../../shared/voice-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import type { VoiceControls } from './use-voice.js';
import { retakeSummary, sentenceRows } from './voice-view.js';

const log = rendererLog('voice');

/** Plays `[start, end)` of a project audio file; one span at a time. */
function useSpanPlayer(file: string | null): {
  readonly playing: string | null;
  readonly toggle: (id: string, start: number, end: number) => void;
} {
  const audio = useRef<HTMLAudioElement | null>(null);
  const plays = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );
  const toggle = (id: string, start: number, end: number): void => {
    audio.current?.pause();
    if (playing === id || file === null) {
      setPlaying(null);
      return;
    }
    plays.current += 1;
    const element = new Audio(projectMediaUrl(file, plays.current));
    const stop = (): void => {
      element.pause();
      setPlaying((current) => (current === id ? null : current));
    };
    element.addEventListener('timeupdate', () => {
      if (element.currentTime >= end) stop();
    });
    element.addEventListener('ended', stop);
    element.currentTime = start;
    audio.current = element;
    setPlaying(id);
    element.play().catch((error: unknown) => {
      log.warn(`sentence ${id} did not play: ${errorMessage(error)}`);
      setPlaying(null);
    });
  };
  return { playing, toggle };
}

export interface VoiceSentencesProps {
  readonly sentences: readonly VoiceSentence[];
  readonly audioFile: string | null;
  readonly voice: VoiceControls;
  readonly busy: boolean;
}

export function VoiceSentences(props: VoiceSentencesProps): JSX.Element | null {
  const player = useSpanPlayer(props.audioFile);
  const [asking, setAsking] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  if (props.sentences.length === 0) return null;
  const redo = (id: string): void => {
    setAsking(null);
    setResult(null);
    void props.voice.retake(id).then((outcome) => {
      if (outcome.status === 'ok') setResult({ tone: 'ok', text: retakeSummary(outcome) });
      else setResult({ tone: outcome.status === 'error' ? 'error' : 'ok', text: outcome.message });
    });
  };
  return (
    <section className="voice-sentences" aria-label="Generated sentences">
      <h3 className="section-title">Generated sentences</h3>
      {result !== null && (
        <p
          className={result.tone === 'error' ? 'panel-error' : 'fit-line fit-ok'}
          role={result.tone === 'error' ? 'alert' : 'status'}
        >
          {result.text}
        </p>
      )}
      <ol className="voice-sentence-list">
        {sentenceRows(props.sentences).map((row) => {
          const { span } = row;
          return (
            <li key={row.id} className="voice-sentence">
              <button
                type="button"
                className="small-button icon-button"
                aria-label={player.playing === row.id ? `Stop ${row.id}` : `Play ${row.id}`}
                disabled={span === null}
                onClick={() => {
                  if (span !== null) player.toggle(row.id, span.start, span.end);
                }}
              >
                {player.playing === row.id ? '■' : '▶'}
              </button>
              <span className="mono muted voice-sentence-time">{row.time}</span>
              <span className="voice-sentence-text">
                {row.text}
                {row.takes !== null && <span className="muted"> · {row.takes}</span>}
              </span>
              {asking === row.id ? (
                <span className="voice-redo-confirm" role="group" aria-label={`Redo ${row.id}`}>
                  <span className="muted">{row.redoHint}</span>
                  <button
                    type="button"
                    className="small-button primary"
                    onClick={() => {
                      redo(row.id);
                    }}
                  >
                    Redo
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => {
                      setAsking(null);
                    }}
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="small-button"
                  title={row.redoHint}
                  disabled={props.busy}
                  onClick={() => {
                    setAsking(row.id);
                  }}
                >
                  Redo this sentence
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
