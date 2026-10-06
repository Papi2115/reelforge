/**
 * Bottom status bar (PLAN.md#6.3, #6.7, docs/ux/redesign-2.4.md U4): History (the project's git
 * history drawer), the Claude Code connection chip (opens Settings → Claude), the model mode in
 * plain words and the app version. No usage figure until there is a real number to show.
 */
import type { JSX } from 'react';
import type { ClaudeStatus } from '../../shared/settings-contract.js';
import { claudeChip } from '../settings/connect-wizard.js';
import { modelsText } from './header-view.js';

export interface StatusBarProps {
  /** Shown only while a project is open. */
  readonly projectOpen: boolean;
  readonly historyOpen: boolean;
  readonly onToggleHistory: () => void;
  readonly version: string | undefined;
  /** Undefined until the settings are loaded. */
  readonly economy: boolean | undefined;
  readonly claude: ClaudeStatus | undefined;
  readonly onOpenClaudeSettings: () => void;
}

export function StatusBar(props: StatusBarProps): JSX.Element {
  const chip = claudeChip(props.claude);
  const models = modelsText(props.economy);
  return (
    <footer className="status-bar" aria-label="Status">
      {props.projectOpen && (
        <button
          type="button"
          className="saved-badge"
          aria-expanded={props.historyOpen}
          title="Saved on this computer: every step and Claude turn is kept, you can go back"
          onClick={props.onToggleHistory}
        >
          History
        </button>
      )}
      <button
        type="button"
        className="status-item claude-chip"
        title={`${chip.detail ?? 'Claude Code connection'} (Settings → Claude)`}
        onClick={props.onOpenClaudeSettings}
      >
        <span className={`connect-dot tone-${chip.tone}`} aria-hidden="true" />
        {chip.label}
      </button>
      {models !== null && (
        <span className="status-item" title="Models per step and Economy mode: Settings → Models">
          {models}
        </span>
      )}
      {props.version !== undefined && (
        <span className="status-item status-version">ReelForge v{props.version}</span>
      )}
    </footer>
  );
}
