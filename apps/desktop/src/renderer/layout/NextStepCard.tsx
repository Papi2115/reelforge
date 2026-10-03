/**
 * "Next step" card (PLAN.md#10.3, #11.2): one short sentence, a primary button named after the
 * action and an info icon whose tooltip says why.
 */
import { useState, type JSX } from 'react';
import type { NextStep } from '../stages/next-step.js';
import { InfoIcon } from './icons.js';

export function NextStepCard(props: {
  readonly step: NextStep;
  readonly onAction: () => void;
}): JSX.Element {
  const { step } = props;
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <div className="next-step" data-testid="next-step">
      <p className="next-step-text">
        <span className="next-step-label">{step.heading}</span>
        {step.text}
      </p>
      <div className="next-step-actions">
        <button type="button" className="small-button primary" onClick={props.onAction}>
          {step.button}
        </button>
        {step.why !== '' && (
          <button
            type="button"
            className="info-button"
            aria-label="Why this step?"
            aria-expanded={whyOpen}
            title={step.why}
            onClick={() => {
              setWhyOpen((open) => !open);
            }}
          >
            <InfoIcon />
          </button>
        )}
      </div>
      {whyOpen && <p className="next-step-why">{step.why}</p>}
    </div>
  );
}
