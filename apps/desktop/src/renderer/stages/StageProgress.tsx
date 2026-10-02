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

export function StageProgress({ title, run, onStop }: StageProgressProps): JSX.Element {
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
      ? 'Queued: starts when the running stage finishes.'
      : paused !== null
        ? paused.until === null
          ? 'Paused by the Claude usage limit.'
          : `Paused by the Claude usage limit until ${new Date(paused.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : (run.label ?? 'Starting…');

  return (
    <section className="stage-run" aria-label={`${title} progress`}>
      <div className="stage-run-header">
        <div className="stage-run-text">
          <h3 className="stage-run-title">{title}</h3>
          <p className="stage-run-step" aria-live="polite">
            {state}
            {run !== null && (
              <span className="mono muted">
                {run.percent === null ? '' : ` · ${String(Math.round(run.percent))} %`} ·{' '}
                {elapsedText(run.startedAt, now)}
              </span>
            )}
          </p>
        </div>
        <button type="button" className="small-button" onClick={onStop}>
          <StopIcon /> Stop
        </button>
      </div>
      {run?.percent !== null && run?.percent !== undefined && (
        <div className="stage-progress" aria-hidden="true">
          <span style={{ width: `${String(run.percent)}%` }} />
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
