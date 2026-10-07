/**
 * "Project settings": the project's channel (read-only, PLAN.md#13.13), its genre preset
 * (read-only, PLAN.md#13.8) and the options stored in
 * the open project's project.json (the style, read-only;
 * look mode, ambient variation, continuity links, characters and mascot, research assets, tension
 * map, dramaturgy, editing, scenes per minute and faster checks). In a world's project the rows
 * that do not apply say why instead (WorldRows.tsx). Sections and rows are data
 * (PROJECT_SETTINGS_ROWS in project-settings-view.ts): a later option adds a row with its section,
 * and the section appears. The row components are shared with the steps' "All options" sections
 * (option-registry.ts). Every change is saved and committed by main right away; it applies to
 * future builds and marks no step out of date.
 */
import { useEffect, useId, useRef, type JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import { ChannelRow } from '../channels/ChannelRow.js';
import { optionsStatus } from '../options/step-options-view.js';
import { GenreRow } from './GenreRow.js';
import { groupBySection, PROJECT_SETTINGS_ROWS } from './project-settings-view.js';
import { useProjectSettings } from './use-project-settings.js';
import { OptionRow } from './WorldRows.js';

export interface ProjectSettingsDialogProps {
  readonly projectTitle: string;
  /** The project's channel (read-only here); undefined while the channels load. */
  readonly channel?: ChannelView | undefined;
  readonly onClose: () => void;
}

export function ProjectSettingsDialog({
  projectTitle,
  channel,
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
          {channel !== undefined && <ChannelRow channel={channel} />}
          {controller.genrePreset !== undefined && (
            <GenreRow genrePreset={controller.genrePreset} />
          )}
          {settings !== undefined &&
            groupBySection(PROJECT_SETTINGS_ROWS).map((section) => (
              <section
                key={section.id}
                className="project-settings-section"
                aria-labelledby={`${headingId}-${section.id}`}
              >
                <h3 className="settings-heading" id={`${headingId}-${section.id}`}>
                  {section.title}
                </h3>
                {section.rows.map(({ id }) => (
                  <OptionRow
                    key={id}
                    id={id}
                    settings={settings}
                    looks={controller.looks}
                    style={controller.style}
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
          {optionsStatus(controller.pending)}
        </footer>
      </div>
    </div>
  );
}
