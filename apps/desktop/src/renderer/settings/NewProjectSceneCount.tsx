/** Settings → Projects: the scenes per minute and faster checks new projects start with (ADR-027). */
import type { JSX } from 'react';
import { SceneCountFields } from '../project/SceneCountFields.js';
import { SCENE_COUNT_HINT } from '../project/scene-count-view.js';
import type { PageProps } from './GeneralSettings.js';

export function NewProjectSceneCount({ state, update }: PageProps): JSX.Element {
  const defaults = state.settings.newProjectDefaults;
  return (
    <>
      <h3 className="settings-heading">Scenes and checks of new projects</h3>
      <p className="muted">
        {SCENE_COUNT_HINT} The New project form starts with these; each project keeps its own choice
        (Project settings).
      </p>
      <SceneCountFields
        range={defaults.shotsPerMinute}
        fasterChecks={defaults.fasterChecks}
        onRange={(range) => {
          update({ newProjectDefaults: { shotsPerMinute: range } });
        }}
        onFasterChecks={(on) => {
          update({ newProjectDefaults: { fasterChecks: on } });
        }}
      />
    </>
  );
}
