/** Research assets (PLAN.md#12.10): the four modes, the allowlist sources, the full-auto ⚠. */
import { useId, type JSX } from 'react';
import {
  allowlistProblem,
  FULL_AUTO_WARNING,
  RESEARCH_MODE_CHOICES,
  RESEARCH_NOTE,
  RESEARCH_SOURCE_CHOICES,
  researchModePatch,
  researchSourcePatch,
} from './research-settings-view.js';
import { SettingRow, type RowProps } from './SettingRow.js';

export function ResearchRow({ settings, update }: RowProps): JSX.Element {
  const name = useId();
  const problem = allowlistProblem(settings);
  return (
    <SettingRow title="Research assets" note={RESEARCH_NOTE}>
      {(labelId) => (
        <>
          <div className="project-setting-choices" role="radiogroup" aria-labelledby={labelId}>
            {RESEARCH_MODE_CHOICES.map((choice) => (
              <label key={choice.value} className="settings-toggle">
                <input
                  type="radio"
                  name={name}
                  value={choice.value}
                  checked={settings.researchMode === choice.value}
                  onChange={() => {
                    update(researchModePatch(settings, choice.value));
                  }}
                />
                <span>
                  <strong className={choice.risky ? 'research-risky' : undefined}>
                    {choice.title}
                  </strong>
                  <span className="muted">{choice.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {settings.researchMode === 'full-auto' && (
            <p className="research-warning" role="alert">
              {FULL_AUTO_WARNING}
            </p>
          )}
          {settings.researchMode === 'allowlist' && (
            <fieldset className="research-sources">
              <legend>Sources Claude may download from</legend>
              {RESEARCH_SOURCE_CHOICES.map((source) => (
                <label key={source.id} className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.researchSources.includes(source.id)}
                    onChange={(event) => {
                      update(researchSourcePatch(settings, source.id, event.target.checked));
                    }}
                  />
                  <span>
                    <strong>{source.label}</strong>
                    <span className="muted">{source.hint}</span>
                  </span>
                </label>
              ))}
              {problem !== null && <p className="research-warning">{problem}</p>}
            </fieldset>
          )}
        </>
      )}
    </SettingRow>
  );
}
