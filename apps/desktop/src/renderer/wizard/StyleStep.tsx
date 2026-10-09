/**
 * New project wizard → step 3 "Style" (PLAN.md#13.16): one card per offered style with a preview
 * frame, its name (+ PREVIEW for an experimental world) and one line. Radios in a fieldset: the
 * legend names the group, arrow keys move the choice. With Experimental worlds off a line says
 * where the worlds are.
 */
import { useId, type JSX } from 'react';
import type { StyleChoice } from '../../shared/style-choices.js';
import { styleTint } from '../home/card-view.js';
import { PREVIEW_TAG, STYLE_FIELD_HINT } from '../project/world-settings-view.js';
import { styleThumb } from './style-thumbs.js';

export const WORLDS_OFF_HINT =
  'More worlds (Sketchbook, Comic, two game worlds) are in preview: turn on “Experimental worlds (preview)” in Settings → Projects to see them here.';

export interface StyleStepProps {
  readonly choices: readonly StyleChoice[];
  readonly value: string | undefined;
  readonly onChange: (style: string) => void;
  readonly experimentalWorlds: boolean;
  /** The genre's note when its preferred style is not offered. */
  readonly genreNote: string | undefined;
  readonly disabled: boolean;
}

function StylePicture({ choice }: { readonly choice: StyleChoice }): JSX.Element {
  const src = styleThumb(choice.id);
  if (src !== undefined) return <img className="style-card-picture" src={src} alt="" />;
  const tint = styleTint(choice.id);
  return (
    <span
      className="style-card-picture"
      aria-hidden="true"
      style={{ background: tint.back, borderColor: tint.ink }}
    />
  );
}

export function StyleStep(props: StyleStepProps): JSX.Element {
  const name = useId();
  return (
    <fieldset className="wizard-styles">
      <legend>Style</legend>
      <p className="muted">{STYLE_FIELD_HINT}</p>
      {props.genreNote !== undefined && <p className="genre-style-note">{props.genreNote}</p>}
      <div className="style-cards">
        {props.choices.map((choice) => (
          <label key={choice.id} className="style-card">
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={props.value === choice.id}
              disabled={props.disabled}
              onChange={() => {
                props.onChange(choice.id);
              }}
            />
            <StylePicture choice={choice} />
            <span className="style-card-text">
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
      </div>
      {!props.experimentalWorlds && <p className="muted wizard-note">{WORLDS_OFF_HINT}</p>}
    </fieldset>
  );
}
