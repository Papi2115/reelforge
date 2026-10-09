/**
 * The frame of the New project wizard (PLAN.md#13.16): the title, the four step dots (a done step
 * can be clicked), the step's content in a form (Enter = Next), why Next waits, and Back / Next
 * ("Create project…" on the last step). Esc goes back to the projects.
 */
import type { JSX, ReactNode, SyntheticEvent } from 'react';
import {
  nextWizardStep,
  stepIndex,
  WIZARD_STEP_TITLES,
  WIZARD_STEPS,
  type WizardStep,
} from './wizard-view.js';

export interface WizardFrameProps {
  readonly step: WizardStep;
  readonly onStep: (step: WizardStep) => void;
  readonly canReach: (step: WizardStep) => boolean;
  /** Why Next waits (shown under the fields); undefined = ready. */
  readonly problem: string | undefined;
  readonly error: string | undefined;
  readonly busy: boolean;
  readonly onSubmit: (event: SyntheticEvent) => void;
  readonly onCancel: () => void;
  readonly children: ReactNode;
}

export function WizardFrame(props: WizardFrameProps): JSX.Element {
  const { step } = props;
  const back = nextWizardStep(step, -1);
  const last = nextWizardStep(step, 1) === undefined;
  return (
    <section
      className="wizard"
      aria-label="New project"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || props.busy) return;
        event.preventDefault();
        props.onCancel();
      }}
    >
      <header className="wizard-header">
        <h1 className="home-title">New project</h1>
        <ol className="wizard-steps" aria-label="Steps">
          {WIZARD_STEPS.map((entry) => {
            const index = stepIndex(entry);
            const state = index < stepIndex(step) ? 'done' : entry === step ? 'current' : 'next';
            return (
              <li key={entry} className={`wizard-step step-${state}`}>
                <button
                  type="button"
                  aria-current={entry === step ? 'step' : undefined}
                  disabled={props.busy || entry === step || !props.canReach(entry)}
                  onClick={() => {
                    props.onStep(entry);
                  }}
                >
                  <span className="wizard-step-dot" aria-hidden="true">
                    {index + 1}
                  </span>
                  {WIZARD_STEP_TITLES[entry]}
                </button>
              </li>
            );
          })}
        </ol>
      </header>
      <form className="wizard-body" onSubmit={props.onSubmit} noValidate>
        <h2 className="wizard-step-title section-title">
          Step {stepIndex(step) + 1} of {WIZARD_STEPS.length}: {WIZARD_STEP_TITLES[step]}
        </h2>
        {props.children}
        {props.problem !== undefined && (
          <p className="muted wizard-problem" role="status">
            {props.problem}
          </p>
        )}
        {props.error !== undefined && (
          <p className="home-error" role="alert">
            {props.error}
          </p>
        )}
        <footer className="wizard-footer">
          <button
            type="button"
            disabled={props.busy}
            onClick={() => {
              if (back === undefined) props.onCancel();
              else props.onStep(back);
            }}
          >
            {back === undefined ? 'Back to projects' : 'Back'}
          </button>
          <span className="header-spacer" />
          <button
            type="submit"
            className="primary"
            disabled={props.busy || props.problem !== undefined}
          >
            {last ? 'Create project…' : 'Next'}
          </button>
        </footer>
      </form>
    </section>
  );
}
