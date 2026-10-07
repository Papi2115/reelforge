/**
 * New project form → "Style" (PLAN.md#13.6): the built-in styles and, with Settings → Projects →
 * "Experimental worlds (preview)" on, the preview worlds (Sketchbook), one plain line each.
 * Radios in a fieldset: the legend names the group, arrow keys move the choice.
 */
import { useId, type JSX } from 'react';
import type { StyleChoice } from '../../shared/style-choices.js';
import { PREVIEW_TAG, STYLE_FIELD_HINT } from './world-settings-view.js';

export interface StyleFieldProps {
  readonly choices: readonly StyleChoice[];
  readonly value: string | undefined;
  readonly onChange: (style: string) => void;
  readonly disabled?: boolean;
}

export function StyleField({ choices, value, onChange, disabled }: StyleFieldProps): JSX.Element {
  const name = useId();
  return (
    <fieldset className="start-style">
      <legend>Style</legend>
      <p className="muted">{STYLE_FIELD_HINT}</p>
      {choices.map((choice) => (
        <label key={choice.id} className="settings-toggle">
          <input
            type="radio"
            name={name}
            value={choice.id}
            checked={value === choice.id}
            disabled={disabled === true}
            onChange={() => {
              onChange(choice.id);
            }}
          />
          <span>
            <strong>
              {choice.label}
              {choice.preview && (
                <>
                  {' '}
                  <span className="style-preview-tag">{PREVIEW_TAG}</span>
                </>
              )}
            </strong>
            <span className="muted">{choice.description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
