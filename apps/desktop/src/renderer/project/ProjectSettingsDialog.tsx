/**
 * "Project settings": the project's channel (read-only, PLAN.md#13.13), its genre preset
 * (read-only, PLAN.md#13.8) and the options stored in the open project's project.json (the style,
 * read-only; look mode, ambient variation, continuity links, characters and mascot, research
 * assets, tension map, dramaturgy, editing, scenes per minute and faster checks). In a world's
 * project the rows that do not apply say why instead (WorldRows.tsx). Sections and rows are data
 * (PROJECT_SETTINGS_ROWS in project-settings-view.ts) shown in section tabs (Visuals ·
 * Characters · Direction · Scenes and checks · Research · Channel & genre, project-settings-tabs.ts;
 * docs/ux/redesign-2.4.md U12) instead of one long scroll; the tab list is keyboard accessible
 * (arrows, Home / End). The row components are shared with the steps' "All options" sections
 * (option-registry.ts). Every change is saved and committed by main right away; it applies to
 * future builds and marks no step out of date.
 */
import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import { ChannelRow } from '../channels/ChannelRow.js';
import { useEscapeToClose } from '../layout/use-escape-to-close.js';
import { optionsStatus } from '../options/step-options-view.js';
import { GenreRow } from './GenreRow.js';
import {
  projectSettingsTabs,
  tabAfterKey,
  type ProjectSettingsTabId,
} from './project-settings-tabs.js';
import { PROJECT_SETTINGS_ROWS } from './project-settings-view.js';
import { useProjectSettings } from './use-project-settings.js';
import { OptionRow } from './WorldRows.js';

export interface ProjectSettingsDialogProps {
  readonly projectTitle: string;
  /** The project's channel (read-only here); undefined while the channels load. */
  readonly channel?: ChannelView | undefined;
  readonly onClose: () => void;
}

const TABS = projectSettingsTabs(PROJECT_SETTINGS_ROWS);

export function ProjectSettingsDialog({
  projectTitle,
  channel,
  onClose,
}: ProjectSettingsDialogProps): JSX.Element {
  const controller = useProjectSettings();
  const { settings } = controller;
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef(new Map<ProjectSettingsTabId, HTMLButtonElement>());
  const [tabId, setTabId] = useState<ProjectSettingsTabId>(TABS[0]?.id ?? 'visuals');
  const baseId = useId();
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  // Escape closes the dialog wherever the focus is (unless a dialog over it is open).
  useEscapeToClose(onClose);

  const onTabKey = (event: KeyboardEvent): void => {
    const next = tabAfterKey(
      TABS.map((tab) => tab.id),
      tabId,
      event.key,
    );
    if (next === undefined) return;
    event.preventDefault();
    setTabId(next);
    tabRefs.current.get(next)?.focus();
  };

  const tab = TABS.find((entry) => entry.id === tabId);
  const tabDomId = (id: ProjectSettingsTabId): string => `${baseId}-tab-${id}`;
  const panelId = `${baseId}-panel`;
  const loading = settings === undefined && controller.error === undefined;
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
        <div className="settings-body">
          <div
            className="settings-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Project settings sections"
            onKeyDown={onTabKey}
          >
            {TABS.map((entry) => (
              <button
                key={entry.id}
                ref={(element) => {
                  if (element) tabRefs.current.set(entry.id, element);
                  else tabRefs.current.delete(entry.id);
                }}
                type="button"
                role="tab"
                id={tabDomId(entry.id)}
                aria-selected={entry.id === tabId}
                aria-controls={panelId}
                tabIndex={entry.id === tabId ? 0 : -1}
                className="settings-tab"
                onClick={() => {
                  setTabId(entry.id);
                }}
              >
                {entry.title}
              </button>
            ))}
          </div>
          <div
            key={tabId}
            className="settings-panel project-settings-body"
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabDomId(tabId)}
          >
            {loading && <p className="muted">Loading…</p>}
            {tab?.channelAndGenre === true && channel !== undefined && (
              <ChannelRow channel={channel} />
            )}
            {tab?.channelAndGenre === true && controller.genrePreset !== undefined && (
              <GenreRow genrePreset={controller.genrePreset} />
            )}
            {settings !== undefined &&
              tab?.sections.map((section) => (
                <section
                  key={section.id}
                  className="project-settings-section"
                  aria-labelledby={`${baseId}-${section.id}`}
                >
                  <h3 className="settings-heading" id={`${baseId}-${section.id}`}>
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
        </div>
        <footer className="settings-footer muted" aria-live="polite">
          {optionsStatus(controller.pending)}
        </footer>
      </div>
    </div>
  );
}
