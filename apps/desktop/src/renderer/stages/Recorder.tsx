/**
 * The in-app recording booth (PLAN.md#7.2): microphone picker, level meter, 3-2-1 countdown,
 * Record / Pause / Resume / Stop / Redo / Use this take, and the script as a teleprompter beside
 * the meter (it scrolls along at the 150 wpm estimate while recording).
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { meterFill } from '../../shared/wav-encode.js';
import { errorMessage, rendererLog } from '../log.js';
import type { RecorderControls } from './use-recorder.js';
import { clock } from './vo-view.js';

const log = rendererLog('recorder');
const WORDS_PER_SECOND = 150 / 60;

function useScriptText(): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    window.reelforge.getScript().then(
      (document) => {
        if (active) setText(document.script);
      },
      (error: unknown) => {
        log.warn(`script not read: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return text;
}

function Teleprompter({
  text,
  elapsedS,
  follow,
}: {
  readonly text: string | null;
  readonly elapsedS: number;
  readonly follow: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const words = text?.split(/\s+/).filter((word) => word !== '').length ?? 0;
  useEffect(() => {
    const box = ref.current;
    if (!follow || box === null || words === 0) return;
    const share = Math.min(1, (elapsedS * WORDS_PER_SECOND) / words);
    box.scrollTop = share * Math.max(0, box.scrollHeight - box.clientHeight);
  }, [elapsedS, follow, words]);
  return (
    <div className="teleprompter" ref={ref} tabIndex={0} aria-label="Script to read">
      {text === null ? <p className="muted">No script yet.</p> : <p>{text}</p>}
    </div>
  );
}

function Meter({ level }: { readonly level: number }): JSX.Element {
  const fill = meterFill(level);
  const db = level <= 0 ? '-∞' : (20 * Math.log10(level)).toFixed(0);
  return (
    <div
      className="level-meter"
      role="meter"
      aria-label="Microphone level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      aria-valuetext={`${db} dBFS`}
    >
      <span className={fill > 0.95 ? 'clip' : ''} style={{ width: `${String(fill * 100)}%` }} />
    </div>
  );
}

export interface RecorderProps {
  readonly recorder: RecorderControls;
  readonly onSaved: (message: string | null) => void;
}

export function Recorder({ recorder, onSaved }: RecorderProps): JSX.Element {
  const script = useScriptText();
  const { phase } = recorder;
  const live = phase === 'recording' || phase === 'paused';
  const status =
    phase === 'countdown'
      ? `Recording in ${String(recorder.countdown ?? 0)}…`
      : phase === 'recording'
        ? `Recording ${clock(recorder.elapsedS)}`
        : phase === 'paused'
          ? `Paused at ${clock(recorder.elapsedS)}`
          : phase === 'review'
            ? `Take: ${clock(recorder.elapsedS)}`
            : phase === 'saving'
              ? 'Saving the take…'
              : 'Ready: check the level, then Record.';
  return (
    <section className="recorder" aria-label="Record a voice-over">
      <div className="recorder-controls">
        <label className="field">
          <span>Microphone</span>
          <select
            value={recorder.deviceId ?? ''}
            disabled={phase !== 'ready'}
            onChange={(event) => {
              void recorder.open(event.target.value);
            }}
          >
            {recorder.devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
        <Meter level={recorder.level} />
        <p className={`recorder-status${live ? ' live' : ''}`} aria-live="polite">
          {status}
        </p>
        <div className="recorder-buttons" role="group" aria-label="Recording">
          {phase === 'ready' && (
            <button type="button" className="small-button primary" onClick={recorder.record}>
              Record
            </button>
          )}
          {phase === 'recording' && (
            <button type="button" className="small-button" onClick={recorder.pause}>
              Pause
            </button>
          )}
          {phase === 'paused' && (
            <button type="button" className="small-button" onClick={recorder.resume}>
              Resume
            </button>
          )}
          {live && (
            <button type="button" className="small-button primary" onClick={recorder.stop}>
              Stop
            </button>
          )}
          {phase === 'review' && (
            <>
              <button
                type="button"
                className="small-button primary"
                onClick={() => {
                  void recorder.save().then((result) => {
                    if (result.status !== 'error') onSaved(null);
                  });
                }}
              >
                Use this take
              </button>
              <button type="button" className="small-button" onClick={recorder.redo}>
                Redo
              </button>
            </>
          )}
          <button
            type="button"
            className="small-button"
            disabled={phase === 'saving'}
            onClick={recorder.close}
          >
            Cancel
          </button>
        </div>
        {recorder.error !== null && (
          <p className="panel-error" role="alert">
            {recorder.error}
          </p>
        )}
      </div>
      <Teleprompter text={script} elapsedS={recorder.elapsedS} follow={live} />
    </section>
  );
}
