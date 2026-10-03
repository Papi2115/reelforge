/**
 * Bottom status bar (PLAN.md#6.3, #6.7): local save + git history (opens the history drawer), the
 * model mode (Economy or per stage), a usage placeholder and the Claude Code connection chip
 * (opens Settings → Claude).
 */
import type { JSX } from 'react';
import type { ClaudeStatus } from '../../shared/settings-contract.js';
import { claudeChip } from '../settings/connect-wizard.js';

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
  const models =
    props.economy === undefined ? 'Models: —' : props.economy ? 'Economy mode' : 'Models: per step';
  return (
    <footer className="status-bar" aria-label="Status">
      {props.projectOpen && (
        <button
          type="button"
          className="saved-badge"
          aria-expanded={props.historyOpen}
          onClick={props.onToggleHistory}
        >
          Saved locally · git history
        </button>
      )}
      <span className="status-item" title="Models per step and Economy mode: Settings → Models">
        {models} · Usage: —
      </span>
      <button
        type="button"
        className="status-item claude-chip"
        title="Claude Code connection (Settings → Claude)"
        onClick={props.onOpenClaudeSettings}
      >
        <span className={`connect-dot tone-${chip.tone}`} aria-hidden="true" />
        {chip.label}
      </button>
      {props.version !== undefined && (
        <span className="status-item status-version">ReelForge v{props.version}</span>
      )}
    </footer>
  );
}
