/**
 * Live progress of a running stage (PLAN.md#7.1): the current step with percent and elapsed time,
 * the usage-limit pause, Stop, and Claude's steps in the chat's step-log component.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { StageRunView } from '../../shared/stages-contract.js';
import { Step } from '../chat/ChatTranscript.js';
import { stepRow } from '../chat/step-view.js';
import { StopIcon } from '../layout/icons.js';
import { elapsedText } from './pipeline-view.js';

export interface StageProgressProps {
  readonly title: string;
  /** null while the stage waits in the queue. */
  readonly run: StageRunView | null;
  readonly onStop: () => void;
  /** The current step in plain words (default: the runner's step label). */
  readonly step?: string | undefined;
  /** Progress bar value 0..100 (default: the runner's percent). */
  readonly percent?: number | null;
  /** Label of the Stop button (default "Stop"). */
  readonly stopLabel?: string;
}

function useSecondClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

export function StageProgress(props: StageProgressProps): JSX.Element {
  const { title, run, onStop } = props;
  const now = useSecondClock();
  const listRef = useRef<HTMLOListElement>(null);
  const steps = run?.steps ?? [];
  const lastStep = steps.at(-1);
  const followKey = `${String(steps.length)}:${lastStep?.type === 'text' ? String(lastStep.text.length) : ''}`;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [followKey]);

  const paused = run?.paused ?? null;
  const state =
    run === null
      ? 'Queued: starts when the running step finishes.'
      : paused !== null
        ? paused.until === null
          ? 'Paused by the Claude usage limit.'
          : `Paused by the Claude usage limit until ${new Date(paused.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : (props.step ?? run.label ?? 'Starting…');
  const percent = props.percent === undefined ? (run?.percent ?? null) : props.percent;

  return (
    <section className="stage-run" aria-label={`${title} progress`}>
      <div className="stage-run-header">
        <div className="stage-run-text">
          <h3 className="stage-run-title">{title}</h3>
          <p className="stage-run-step" aria-live="polite">
            {state}
            {run !== null && (
              <span className="mono muted">
                {percent === null ? '' : ` · ${String(Math.round(percent))} %`} ·{' '}
                {elapsedText(run.startedAt, now)}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="small-button stop-button"
          title="Stop now; what is finished so far is kept"
          onClick={onStop}
        >
          <StopIcon /> {props.stopLabel ?? 'Stop'}
        </button>
      </div>
      {run !== null && percent !== null && (
        <div
          className="stage-progress"
          role="progressbar"
          aria-label={`${title} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <span style={{ width: `${String(percent)}%` }} />
        </div>
      )}
      {steps.length === 0 ? (
        <p className="panel-empty">Claude's steps appear here as it works.</p>
      ) : (
        <ol className="step-log stage-run-log" ref={listRef} aria-label="Claude's steps">
          {steps.map((step) => (
            <Step key={step.id} row={stepRow(step)} />
          ))}
        </ol>
      )}
    </section>
  );
}
