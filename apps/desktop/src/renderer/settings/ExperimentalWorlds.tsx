/**
 * Settings → Projects → "Experimental worlds (preview)" (PLAN.md#13.6): off by default. On, new
 * projects may start in a preview world (Sketchbook), and the steps and Claude's `reelforge` CLI
 * build such a project in its world (main: StageSettings.experimentalWorlds and the CLI launchers).
 */
import type { JSX } from 'react';
import type { PageProps } from './GeneralSettings.js';

export const EXPERIMENTAL_WORLDS_TITLE = 'Experimental worlds (preview)';

export const EXPERIMENTAL_WORLDS_HINT =
  'Offers worlds that are still being built (today: Sketchbook, a hand-drawn notebook) as a style for new projects, and lets projects in them build. Their look may still change between versions.';

/** One line under the switch, always shown. */
export const EXPERIMENTAL_WORLDS_NOTE = 'Preview worlds are unfinished and may change.';

export function ExperimentalWorlds({ state, update }: PageProps): JSX.Element {
  return (
    <>
      <h3 className="settings-heading">Worlds</h3>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={state.settings.experimental.worlds}
          onChange={(event) => {
            update({ experimental: { worlds: event.target.checked } });
          }}
        />
        <span>
          <strong>{EXPERIMENTAL_WORLDS_TITLE}</strong>
          <span className="muted">{EXPERIMENTAL_WORLDS_HINT}</span>
        </span>
      </label>
      <p className="muted settings-toggle-note">{EXPERIMENTAL_WORLDS_NOTE}</p>
    </>
  );
}
