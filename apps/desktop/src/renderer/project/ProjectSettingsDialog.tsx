/**
 * "Project settings": options stored in the open project's project.json (look mode, ambient
 * variation, research assets). Sections and rows are data (project-settings-view.ts): a later option adds a row to
 * `rows` with its section, and the section appears. Every change is saved and committed by main
 * right away; it applies to future builds and marks no step out of date.
 */
import { useEffect, useId, useRef, type JSX, type ReactNode } from 'react';
import type {
  LookSummary,
  ProjectSettings,
  ProjectSettingsPatch,
} from '../../shared/project-settings-contract.js';
import {
  AMBIENT_NOTE,
  groupBySection,
  LOOK_MODE_NOTE,
  lookModeChoices,
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
import { useProjectSettings } from './use-project-settings.js';

interface SettingRowProps {
  readonly title: string;
  /** When the change takes effect. */
  readonly note: string;
  /** The control; `labelId` names it (e.g. `aria-labelledby` of a radio group). */
  readonly children: (labelId: string) => ReactNode;
}

/** One setting: a title, its control and a note on when the change applies. */
function SettingRow({ title, note, children }: SettingRowProps): JSX.Element {
  const labelId = useId();
  return (
    <div className="project-setting-row">
      <span className="project-setting-title" id={labelId}>
        {title}
      </span>
      {children(labelId)}
      <p className="project-setting-note muted">{note}</p>
    </div>
  );
}

interface RowProps {
  readonly settings: ProjectSettings;
  readonly looks: readonly LookSummary[];
  readonly update: (patch: ProjectSettingsPatch) => void;
}

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

interface RowDefinition extends SectionRow {
  readonly Row: (props: RowProps) => JSX.Element;
}

/** Every row of the dialog; later options (Direction, Taste) are added here. */
const ROWS: readonly RowDefinition[] = [
  { id: 'look-mode', section: 'visuals', Row: LookModeRow },
  { id: 'ambient-variation', section: 'visuals', Row: AmbientRow },
  { id: 'research-assets', section: 'research', Row: ResearchRow },
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
