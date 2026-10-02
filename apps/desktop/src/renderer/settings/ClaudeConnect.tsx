/**
 * "Connect Claude" wizard (PLAN.md §2.1): install -> log in -> connected, with Check again and
 * "Open terminal and log in". Used on the Settings page and in the first-run gate.
 */
import type { JSX } from 'react';
import {
  connectWizardView,
  NATIVE_INSTALLER_NOTE,
  PRIVACY_NOTE,
  type WizardStepState,
} from './connect-wizard.js';
import type { ClaudeStatusController } from './use-claude-status.js';

const STEP_MARK: Readonly<Record<WizardStepState, string>> = {
  done: '✓',
  current: '•',
  todo: '',
  failed: '!',
};

export function ClaudeConnect({
  claude,
}: {
  readonly claude: ClaudeStatusController;
}): JSX.Element {
  const view = connectWizardView(claude.status, claude.checking);
  return (
    <div className="connect" data-tone={view.tone}>
      <ol className="connect-steps" aria-label="Connection steps">
        {view.steps.map((step) => (
          <li key={step.id} className={`connect-step step-${step.state}`}>
            <span className="connect-step-mark" aria-hidden="true">
              {STEP_MARK[step.state]}
            </span>
            {step.label}
            <span className="visually-hidden"> ({step.state})</span>
          </li>
        ))}
      </ol>
      <div className="connect-status" role="status" aria-live="polite">
        <span className={`connect-dot tone-${view.tone}`} aria-hidden="true" />
        <div>
          <p className="connect-headline">{view.headline}</p>
          <p className="connect-detail">{view.detail}</p>
        </div>
      </div>
      {view.installCommand !== undefined && (
        <div className="connect-install">
          <label className="field">
            <span>Install command (run it in a terminal)</span>
            <input
              className="mono"
              readOnly
              value={view.installCommand}
              onFocus={(event) => {
                event.target.select();
              }}
            />
          </label>
          <p className="muted connect-note">{NATIVE_INSTALLER_NOTE}</p>
        </div>
      )}
      <div className="connect-actions">
        {view.canOpenTerminal && (
          <button type="button" className="primary" onClick={claude.openLogin}>
            Open terminal and log in
          </button>
        )}
        <button type="button" disabled={!view.canCheckAgain} onClick={claude.recheck}>
          {claude.checking ? 'Checking…' : 'Check again'}
        </button>
      </div>
      {claude.login !== undefined && (
        <p
          className={claude.login.status === 'opened' ? 'muted connect-note' : 'connect-error'}
          role={claude.login.status === 'opened' ? undefined : 'alert'}
        >
          {claude.login.status === 'opened'
            ? `A terminal is running ${claude.login.command}. Finish the login there, then press Check again.`
            : claude.login.message}
        </p>
      )}
      <p className="connect-privacy">{PRIVACY_NOTE}</p>
    </div>
  );
}
