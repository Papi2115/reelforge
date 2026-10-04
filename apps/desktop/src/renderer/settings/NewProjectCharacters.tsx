/** Settings → Projects: the characters and mascot new projects start with (PLAN.md#12.20). */
import { MASCOT_CHOICES } from '@reelforge/shared';
import type { JSX } from 'react';
import {
  CHARACTER_CHOICES,
  isMascotChoice,
  mascotOptionLabel,
  NEW_PROJECT_DEFAULTS_HINT,
} from '../project/character-settings-view.js';
import type { PageProps } from './GeneralSettings.js';

export function NewProjectCharacters({ state, update }: PageProps): JSX.Element {
  const defaults = state.settings.newProjectDefaults;
  const classic = defaults.characters !== 'pack';
  return (
    <>
      <h3 className="settings-heading">New projects start with …</h3>
      <p className="muted">{NEW_PROJECT_DEFAULTS_HINT}</p>
      <div className="settings-grid">
        <label className="field">
          <span>People</span>
          <select
            value={defaults.characters}
            onChange={(event) => {
              const value = CHARACTER_CHOICES.find((choice) => choice.value === event.target.value);
              if (value !== undefined) update({ newProjectDefaults: { characters: value.value } });
            }}
          >
            {CHARACTER_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Mascot{classic ? ' (pack style only)' : ''}</span>
          <select
            value={defaults.mascot}
            disabled={classic}
            onChange={(event) => {
              const value = event.target.value;
              if (isMascotChoice(value)) update({ newProjectDefaults: { mascot: value } });
            }}
          >
            {MASCOT_CHOICES.map((value) => (
              <option key={value} value={value}>
                {mascotOptionLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
