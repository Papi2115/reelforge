/**
 * Bottom status bar (PLAN.md#6.3): local save + git history (opens the history drawer), and
 * placeholders for the model / usage (PLAN.md#6.7) and the Claude connection (PLAN.md#6.6).
 */
import type { JSX } from 'react';

export interface StatusBarProps {
  /** Shown only while a project is open. */
  readonly projectOpen: boolean;
  readonly historyOpen: boolean;
  readonly onToggleHistory: () => void;
  readonly version: string | undefined;
}

export function StatusBar(props: StatusBarProps): JSX.Element {
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
      <span className="status-item" title="Model and usage settings arrive with Settings">
        Model: — · Usage: —
      </span>
      <span className="status-item" title="Claude Code connection check arrives with Settings">
        <span className="status-dot" aria-hidden="true" /> Claude: not checked
      </span>
      {props.version !== undefined && (
        <span className="status-item status-version">ReelForge v{props.version}</span>
      )}
    </footer>
  );
}
