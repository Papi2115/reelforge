/**
 * The eight steps of a project as square dots (PLAN.md#13.16): Script … Export, coloured like the
 * step status model (done, working, needs you, problem, not started). One name for the whole
 * strip ("3 of 8 steps done"); each dot's tooltip names its step.
 */
import type { JSX } from 'react';
import type { HomeStepStatus } from '../../shared/home-contract.js';
import { STEP_LABELS, STEP_STATE_WORDS, stepsDone, stepTitle } from './card-view.js';

export function ProgressStrip({
  steps,
  labels = false,
  states = false,
}: {
  readonly steps: readonly HomeStepStatus[];
  /** Show the step names under the dots (the overview); cards keep only the dots. */
  readonly labels?: boolean;
  /** Also show each step's state in words under its name (the overview's phase panel). */
  readonly states?: boolean;
}): JSX.Element {
  const name = `${String(stepsDone(steps))} of ${String(steps.length)} steps done`;
  return (
    <ol className={`progress-strip${labels ? ' with-labels' : ''}`} aria-label={name} title={name}>
      {steps.map((entry) => (
        <li
          key={entry.step}
          className={`progress-step state-${entry.state}`}
          title={stepTitle(entry)}
        >
          <span className="progress-dot" aria-hidden="true" />
          <span className={labels ? 'progress-label' : 'visually-hidden'}>
            {labels ? STEP_LABELS[entry.step] : stepTitle(entry)}
          </span>
          {labels && states && (
            <span className="progress-state muted">{STEP_STATE_WORDS[entry.state]}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
