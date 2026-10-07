/**
 * Settings (PLAN.md#6.7): a modal with a vertical tab list — Claude (connect wizard), Models
 * (per stage, Economy, budget), Projects (language, style), Channels (PLAN.md#13.13), Taste
 * (PLAN.md#12.13), Performance and Tools. Every change is saved by main right away.
 */
import { useEffect, useRef, type JSX, type KeyboardEvent } from 'react';
import { ChannelsPage } from '../channels/ChannelsPage.js';
import type { ChannelsController } from '../channels/use-channels.js';
import { ClaudeConnect } from './ClaudeConnect.js';
import { ModelsPage, PerformancePage, ProjectsPage } from './GeneralSettings.js';
import { TastePage } from './TasteSettings.js';
import { ToolsPage } from './ToolsSettings.js';
import type { ClaudeStatusController } from './use-claude-status.js';
import type { SettingsController } from './use-settings.js';
import { useEscapeToClose } from '../layout/use-escape-to-close.js';

export const SETTINGS_TABS = [
  'claude',
  'models',
  'projects',
  'channels',
  'taste',
  'performance',
  'tools',
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const TAB_LABELS: Readonly<Record<SettingsTab, string>> = {
  claude: 'Claude',
  models: 'Models',
  projects: 'Projects',
  channels: 'Channels',
  taste: 'Taste',
  performance: 'Performance',
  tools: 'Tools',
};

export interface SettingsDialogProps {
  readonly tab: SettingsTab;
  readonly onTab: (tab: SettingsTab) => void;
  /** Channels tab: the channel selected first (e.g. the open project's). */
  readonly channelId?: string | undefined;
  readonly settings: SettingsController;
  readonly claude: ClaudeStatusController;
  readonly channels: ChannelsController;
  readonly onClose: () => void;
}

export function SettingsDialog(props: SettingsDialogProps): JSX.Element {
  const { tab, settings } = props;
  const tabRefs = useRef(new Map<SettingsTab, HTMLButtonElement>());
  // Focus the selected tab when the dialog opens; arrow keys move it afterwards.
  const initialTab = useRef(tab);
  useEffect(() => {
    tabRefs.current.get(initialTab.current)?.focus();
  }, []);
  // Escape closes the dialog wherever the focus is (e.g. after a re-render dropped it to <body>).
  const { onClose } = props;
  useEscapeToClose(onClose);

  const onTabKey = (event: KeyboardEvent): void => {
    const index = SETTINGS_TABS.indexOf(tab);
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = SETTINGS_TABS[(index + step + SETTINGS_TABS.length) % SETTINGS_TABS.length];
    if (next === undefined) return;
    props.onTab(next);
    tabRefs.current.get(next)?.focus();
  };

  const state = settings.state;
  const pageProps = state === undefined ? undefined : { state, update: settings.update };
  return (
    <div className="modal-backdrop">
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
        <header className="settings-header">
          <h2 className="modal-title">Settings</h2>
          <button type="button" className="small-button" onClick={props.onClose}>
            Close
          </button>
        </header>
        <div className="settings-body">
          <div
            className="settings-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Settings sections"
            onKeyDown={onTabKey}
          >
            {SETTINGS_TABS.map((id) => (
              <button
                key={id}
                ref={(element) => {
                  if (element) tabRefs.current.set(id, element);
                  else tabRefs.current.delete(id);
                }}
                type="button"
                role="tab"
                id={`settings-tab-${id}`}
                aria-selected={tab === id}
                aria-controls="settings-panel"
                tabIndex={tab === id ? 0 : -1}
                className="settings-tab"
                onClick={() => {
                  props.onTab(id);
                }}
              >
                {TAB_LABELS[id]}
              </button>
            ))}
          </div>
          <div
            className="settings-panel"
            id="settings-panel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab}`}
          >
            {tab === 'claude' && <ClaudeConnect claude={props.claude} />}
            {pageProps === undefined && tab !== 'claude' && <p className="muted">Loading…</p>}
            {pageProps !== undefined && tab === 'models' && <ModelsPage {...pageProps} />}
            {pageProps !== undefined && tab === 'projects' && <ProjectsPage {...pageProps} />}
            {pageProps !== undefined && tab === 'channels' && (
              <ChannelsPage
                controller={props.channels}
                experimentalWorlds={pageProps.state.settings.experimental.worlds}
                initialChannelId={props.channelId}
              />
            )}
            {pageProps !== undefined && tab === 'taste' && <TastePage {...pageProps} />}
            {pageProps !== undefined && tab === 'performance' && <PerformancePage {...pageProps} />}
            {pageProps !== undefined && tab === 'tools' && <ToolsPage {...pageProps} />}
            {settings.error !== undefined && (
              <p className="connect-error" role="alert">
                {settings.error}
              </p>
            )}
          </div>
        </div>
        {state !== undefined && tab !== 'channels' && (
          <footer className="settings-footer muted">
            Saved automatically to <span className="mono">{state.file}</span>
          </footer>
        )}
        {tab === 'channels' && (
          <footer className="settings-footer muted">
            Channels are saved automatically on this computer; API keys are stored encrypted.
          </footer>
        )}
      </div>
    </div>
  );
}
