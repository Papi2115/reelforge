/**
 * "Project settings": options stored in the open project's project.json (look mode, ambient
 * variation, characters and mascot, research assets, tension map, dramaturgy, editing, scenes per
 * minute and faster checks). Sections
 * and rows are data (project-settings-view.ts): a later option adds a row to `rows` with its
 * section, and the section appears. Every change is saved and committed by main
 * right away; it applies to future builds and marks no step out of date.
 */
import { useEffect, useId, useRef, type JSX } from 'react';
import { CharactersRow, MascotRow } from './CharacterRows.js';
import {
  AMBIENT_NOTE,
  DRAMATURGY_CHOICES,
  DRAMATURGY_NOTE,
  EDITING_CHOICES,
  EDITING_NOTE,
  groupBySection,
  LOOK_MODE_NOTE,
  lookModeChoices,
  TENSION_MAP_NOTE,
  type SectionRow,
} from './project-settings-view.js';
import {
  allowlistProblem,
  FULL_AUTO_WARNING,
  RESEARCH_MODE_CHOICES,
  RESEARCH_NOTE,
  RESEARCH_SOURCE_CHOICES,
  researchModePatch,
  researchSourcePatch,
} from './research-settings-view.js';
import { SceneCountFields } from './SceneCountFields.js';
import { SCENE_COUNT_HINT, SCENE_COUNT_NOTE } from './scene-count-view.js';
import { SettingRow, type RowProps } from './SettingRow.js';
import { useProjectSettings } from './use-project-settings.js';

function LookModeRow({ settings, looks, update }: RowProps): JSX.Element {
  const name = useId();
  return (
    <SettingRow title="Look mode" note={LOOK_MODE_NOTE}>
      {(labelId) => (
        <>
          <div className="project-setting-choices" role="radiogroup" aria-labelledby={labelId}>
            {lookModeChoices(looks).map((choice) => (
              <label key={choice.value} className="settings-toggle">
                <input
                  type="radio"
                  name={name}
                  value={choice.value}
                  checked={settings.lookMode === choice.value}
                  onChange={() => {
                    update({ lookMode: choice.value });
                  }}
                />
                <span>
                  <strong>{choice.title}</strong>
                  <span className="muted">{choice.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {looks.length > 0 && (
            <ul className="project-setting-looks" aria-label="Available looks">
              {looks.map((look) => (
                <li key={look.id}>
                  <strong>{look.label}</strong>
                  <span className="muted"> — {look.description}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SettingRow>
  );
}

function AmbientRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Ambient variation" note={AMBIENT_NOTE}>
      {() => (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.ambientVariation}
            onChange={(event) => {
              update({ ambientVariation: event.target.checked });
            }}
          />
          <span>
            <strong>Vary backgrounds subtly between shots</strong>
            <span className="muted">
              Sky, grid, light and background details drift from shot to shot within the palette of
              the style, so neighbouring shots never look identical.
            </span>
          </span>
        </label>
      )}
    </SettingRow>
  );
}

/** Research assets (PLAN.md#12.10): the four modes, the allowlist sources, the full-auto ⚠. */
function ResearchRow({ settings, update }: RowProps): JSX.Element {
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

/** Tension map (PLAN.md#12.22): the dramatic curve steers tempo, looks, music and backgrounds. */
function TensionMapRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Tension map" note={TENSION_MAP_NOTE}>
      {() => (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.tensionMap === 'auto'}
            onChange={(event) => {
              update({ tensionMap: event.target.checked ? 'auto' : 'off' });
            }}
          />
          <span>
            <strong>Steer the film by a tension curve</strong>
            <span className="muted">
              Calm, rising, peak and release set the cut tempo, the choice of looks, the music mood
              per act, how dark the backgrounds get and how busy the effects are.
            </span>
          </span>
        </label>
      )}
    </SettingRow>
  );
}

/** Dramaturgy (PLAN.md#12.25-12.27): pattern interrupts, open loops, reveal moments. */
function DramaturgyRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Dramaturgy" note={DRAMATURGY_NOTE}>
      {() => (
        <div className="project-setting-choices">
          {DRAMATURGY_CHOICES.map((choice) => (
            <label key={choice.key} className="settings-toggle">
              <input
                type="checkbox"
                checked={settings[choice.key] === 'auto'}
                onChange={(event) => {
                  update({ [choice.key]: event.target.checked ? 'auto' : 'off' });
                }}
              />
              <span>
                <strong>{choice.title}</strong>
                <span className="muted">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </SettingRow>
  );
}

/** Editing (PLAN.md#12.21, #12.23): beat sync and repetition control. */
function EditingRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Editing" note={EDITING_NOTE}>
      {() => (
        <div className="project-setting-choices">
          {EDITING_CHOICES.map((choice) => (
            <label key={choice.key} className="settings-toggle">
              <input
                type="checkbox"
                checked={settings[choice.key] === 'auto'}
                onChange={(event) => {
                  update({ [choice.key]: event.target.checked ? 'auto' : 'off' });
                }}
              />
              <span>
                <strong>{choice.title}</strong>
                <span className="muted">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </SettingRow>
  );
}

/** Scenes per minute and faster checks (ADR-027). */
function SceneCountRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Scenes per minute" note={SCENE_COUNT_NOTE}>
      {() => (
        <>
          <p className="muted">{SCENE_COUNT_HINT}</p>
          <SceneCountFields
            range={settings.shotsPerMinute}
            fasterChecks={settings.fasterChecks}
            onRange={(range) => {
              update({ shotsPerMinute: range });
            }}
            onFasterChecks={(on) => {
              update({ fasterChecks: on });
            }}
          />
        </>
      )}
    </SettingRow>
  );
}

interface RowDefinition extends SectionRow {
  readonly Row: (props: RowProps) => JSX.Element;
}

/** Every row of the dialog; later options (Direction, Taste) are added here. */
const ROWS: readonly RowDefinition[] = [
  { id: 'look-mode', section: 'visuals', Row: LookModeRow },
  { id: 'ambient-variation', section: 'visuals', Row: AmbientRow },
  { id: 'characters', section: 'characters', Row: CharactersRow },
  { id: 'mascot', section: 'mascot', Row: MascotRow },
  { id: 'research-assets', section: 'research', Row: ResearchRow },
  { id: 'tension-map', section: 'direction', Row: TensionMapRow },
  { id: 'dramaturgy', section: 'direction', Row: DramaturgyRow },
  { id: 'editing', section: 'direction', Row: EditingRow },
  { id: 'scene-count', section: 'build', Row: SceneCountRow },
];

export interface ProjectSettingsDialogProps {
  readonly projectTitle: string;
  readonly onClose: () => void;
}

export function ProjectSettingsDialog({
  projectTitle,
  onClose,
}: ProjectSettingsDialogProps): JSX.Element {
  const controller = useProjectSettings();
  const { settings } = controller;
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  // Escape closes the dialog wherever the focus is.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <div
        className="settings-dialog project-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Project settings"
      >
        <header className="settings-header">
          <div className="project-settings-heading">
            <h2 className="modal-title">Project settings</h2>
            <span className="muted project-settings-subtitle">{projectTitle}</span>
          </div>
          <button ref={closeRef} type="button" className="small-button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="project-settings-body">
          {settings === undefined && controller.error === undefined && (
            <p className="muted">Loading…</p>
          )}
          {settings !== undefined &&
            groupBySection(ROWS).map((section) => (
              <section
                key={section.id}
                className="project-settings-section"
                aria-labelledby={`${headingId}-${section.id}`}
              >
                <h3 className="settings-heading" id={`${headingId}-${section.id}`}>
                  {section.title}
                </h3>
                {section.rows.map(({ id, Row }) => (
                  <Row
                    key={id}
                    settings={settings}
                    looks={controller.looks}
                    update={controller.update}
                  />
                ))}
              </section>
            ))}
          {controller.error !== undefined && (
            <p className="connect-error" role="alert">
              {controller.error}
            </p>
          )}
        </div>
        <footer className="settings-footer muted" aria-live="polite">
          {controller.pending > 0
            ? 'Saving…'
            : 'Saved automatically to project.json and the project history.'}
        </footer>
      </div>
    </div>
  );
}
