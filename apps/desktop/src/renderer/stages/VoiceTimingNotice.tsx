/**
 * "Voice changed — timing out of date" with the one-click "Re-time" (voice-timing-view.ts), shown
 * in the Voiceover panel and above the shot list while a redone sentence is newer than the words.
 */
import { useState, type JSX } from 'react';
import type { VoiceTiming } from '../../shared/voiceover-contract.js';
import type { StagesControls } from './use-stages.js';
import { RETIME_LABEL, RETIME_STAGES, retimeButton, voiceTimingText } from './voice-timing-view.js';

export function VoiceTimingNotice(props: {
  readonly timing: VoiceTiming | null | undefined;
  readonly stages: StagesControls;
  /** An ElevenLabs job runs (Voiceover panel). */
  readonly voiceBusy?: boolean;
  /** `shots-banner` in the Shots panel, `fit-line fit-warn` in the Voiceover panel. */
  readonly className: string;
}): JSX.Element | null {
  const [error, setError] = useState<string | null>(null);
  const text = voiceTimingText(props.timing ?? null);
  if (text === null) return null;
  const button = retimeButton(props.stages.state, props.voiceBusy === true);
  return (
    <>
      <p className={`${props.className} voice-timing`} role="status">
        <span>{text}</span>
        <button
          type="button"
          className="small-button"
          aria-disabled={button.disabled}
          title={button.title}
          onClick={() => {
            if (button.disabled) return;
            setError(null);
            void props.stages.run(RETIME_STAGES).then((result) => {
              if (result.status === 'error') setError(result.message ?? 'Not started.');
            });
          }}
        >
          {RETIME_LABEL}
        </button>
      </p>
      {error !== null && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
