/** New project wizard → step 1 "Topic" (PLAN.md#13.16): title, what it is about, target length. */
import type { JSX } from 'react';
import {
  ABOUT_HINT,
  ENGLISH_NOTE,
  MAX_MINUTES,
  MIN_MINUTES,
  type WizardDraft,
} from './wizard-view.js';

export interface TopicStepProps {
  readonly draft: WizardDraft;
  readonly onDraft: (patch: Partial<WizardDraft>) => void;
  readonly disabled: boolean;
}

export function TopicStep({ draft, onDraft, disabled }: TopicStepProps): JSX.Element {
  return (
    <div className="wizard-fields">
      <label className="field wizard-field-wide">
        <span>Video title</span>
        <input
          value={draft.title}
          maxLength={200}
          placeholder="How a calculator runs Doom"
          autoFocus
          disabled={disabled}
          onChange={(event) => {
            onDraft({ title: event.target.value });
          }}
        />
      </label>
      <label className="field wizard-field-wide">
        <span>What is the video about? (optional)</span>
        <textarea
          value={draft.about}
          rows={4}
          maxLength={4000}
          placeholder="The 1993 shooter on a TI-84: what it takes, who did it first, why people still try."
          disabled={disabled}
          onChange={(event) => {
            onDraft({ about: event.target.value });
          }}
        />
        <span className="muted">{ABOUT_HINT}</span>
      </label>
      <label className="field wizard-field-short">
        <span>Target length (minutes)</span>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={0.5}
          value={draft.minutes}
          disabled={disabled}
          onChange={(event) => {
            onDraft({ minutes: event.target.value });
          }}
        />
      </label>
      <p className="muted wizard-note">{ENGLISH_NOTE}</p>
    </div>
  );
}
