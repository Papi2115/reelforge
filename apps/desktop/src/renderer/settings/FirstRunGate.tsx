/**
 * First-run gate (PLAN.md §2.1, #6.7): until the user finishes or skips it once, the app opens
 * with the "Connect Claude" wizard on top (Continue when connected; Skip always), followed by the
 * optional "Prepare tools" step (ffmpeg found? whisper.cpp installed? — skippable).
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { ClaudeConnect } from './ClaudeConnect.js';
import { PrepareTools } from './PrepareTools.js';
import type { ClaudeStatusController } from './use-claude-status.js';

export interface FirstRunGateProps {
  readonly claude: ClaudeStatusController;
  readonly onDone: () => void;
}

type Step = 'claude' | 'tools';

export function FirstRunGate({ claude, onDone }: FirstRunGateProps): JSX.Element {
  const [step, setStep] = useState<Step>('claude');
  const connected = claude.status?.state === 'connected';
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);
  const title = step === 'claude' ? 'Connect Claude' : 'Prepare tools';
  return (
    <div className="modal-backdrop">
      <div className="settings-dialog first-run" role="dialog" aria-modal="true" aria-label={title}>
        <header className="settings-header">
          <h2 className="modal-title" ref={titleRef} tabIndex={-1}>
            {title}
          </h2>
          <span className="muted">Step {step === 'claude' ? '1' : '2'} of 2</span>
        </header>
        {step === 'claude' ? (
          <>
            <div className="first-run-body">
              <p>
                ReelForge writes scripts, storyboards and scenes with Claude Code on your own Claude
                subscription. Connect it once; you can change this later in Settings.
              </p>
              <ClaudeConnect claude={claude} />
            </div>
            <footer className="modal-actions first-run-actions">
              <button
                type="button"
                onClick={() => {
                  setStep('tools');
                }}
              >
                Skip for now
              </button>
              <button
                type="button"
                className="primary"
                disabled={!connected}
                onClick={() => {
                  setStep('tools');
                }}
              >
                Continue
              </button>
            </footer>
          </>
        ) : (
          <>
            <div className="first-run-body">
              <p>
                ReelForge also uses two local tools: ffmpeg for audio and video, whisper.cpp to time
                the words of your voice-over.
              </p>
              <PrepareTools />
            </div>
            <footer className="modal-actions first-run-actions">
              <button
                type="button"
                onClick={() => {
                  setStep('claude');
                }}
              >
                Back
              </button>
              <button type="button" onClick={onDone}>
                Skip
              </button>
              <button type="button" className="primary" onClick={onDone}>
                Done
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
