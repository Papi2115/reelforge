/**
 * First-run gate (PLAN.md §2.1, #6.7): until the user finishes or skips it once, the app opens
 * with the "Connect Claude" wizard on top. Continue is offered when connected; Skip always.
 */
import { useEffect, useRef, type JSX } from 'react';
import { ClaudeConnect } from './ClaudeConnect.js';
import type { ClaudeStatusController } from './use-claude-status.js';

export interface FirstRunGateProps {
  readonly claude: ClaudeStatusController;
  readonly onDone: () => void;
}

export function FirstRunGate({ claude, onDone }: FirstRunGateProps): JSX.Element {
  const connected = claude.status?.state === 'connected';
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        className="settings-dialog first-run"
        role="dialog"
        aria-modal="true"
        aria-label="Connect Claude"
      >
        <header className="settings-header">
          <h2 className="modal-title" ref={titleRef} tabIndex={-1}>
            Connect Claude
          </h2>
        </header>
        <div className="first-run-body">
          <p>
            ReelForge writes scripts, storyboards and scenes with Claude Code on your own Claude
            subscription. Connect it once; you can change this later in Settings.
          </p>
          <ClaudeConnect claude={claude} />
        </div>
        <footer className="modal-actions first-run-actions">
          <button type="button" onClick={onDone}>
            Skip for now
          </button>
          <button type="button" className="primary" disabled={!connected} onClick={onDone}>
            Continue
          </button>
        </footer>
      </div>
    </div>
  );
}
