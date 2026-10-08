/**
 * "Generate with ElevenLabs" in the Voiceover panel (PLAN.md#13.14): the button sits next to
 * Import / Record; a click first asks main for the cost (no characters spent), then a confirm step
 * shows "About 5,400 characters · 35% of your remaining 15,000" before anything is paid; while it
 * runs a progress bar with Cancel; afterwards the result line. Without a voice or key for the
 * project's channel only one line says what is missing, with "Open Channels" (Settings → Channels
 * with the project's channel selected).
 */
import { useState, type JSX } from 'react';
import type { VoiceSetup } from '../../shared/voice-contract.js';
import { StopIcon } from '../layout/icons.js';
import { useOpenSettings } from '../settings/open-settings.js';
import type { VoiceControls } from './use-voice.js';
import {
  estimateView,
  OPEN_CHANNELS_LABEL,
  progressView,
  setupPointer,
  type EstimateView,
  type SetupPointer,
} from './voice-view.js';

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'estimating' }
  | { readonly kind: 'confirm'; readonly estimate: EstimateView }
  | { readonly kind: 'generating' };

export interface GenerateFlow {
  readonly phase: Phase;
  /** Last outcome in words (ok / cancelled / error). */
  readonly outcome: { readonly tone: 'ok' | 'info' | 'error'; readonly text: string } | null;
  readonly start: () => void;
  readonly confirm: () => void;
  readonly dismiss: () => void;
}

export function useGenerateFlow(voice: VoiceControls): GenerateFlow {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [outcome, setOutcome] = useState<GenerateFlow['outcome']>(null);
  const start = (): void => {
    setOutcome(null);
    setPhase({ kind: 'estimating' });
    void voice.estimate().then((estimate) => {
      if (estimate.status === 'ok') {
        setPhase({ kind: 'confirm', estimate: estimateView(estimate) });
        return;
      }
      setPhase({ kind: 'idle' });
      setOutcome({ tone: 'error', text: estimate.message });
    });
  };
  const confirm = (): void => {
    setPhase({ kind: 'generating' });
    void voice.generate().then((result) => {
      setPhase({ kind: 'idle' });
      if (result.status === 'ok') {
        setOutcome({
          tone: 'ok',
          text: `${result.message} The Voiceover step takes it in now; later steps become out of date.`,
        });
      } else
        setOutcome({ tone: result.status === 'error' ? 'error' : 'info', text: result.message });
    });
  };
  const dismiss = (): void => {
    setPhase({ kind: 'idle' });
  };
  return { phase, outcome, start, confirm, dismiss };
}

export function GenerateButton(props: {
  readonly setup: VoiceSetup | undefined;
  readonly generated: boolean;
  readonly flow: GenerateFlow;
  readonly busy: boolean;
}): JSX.Element | null {
  if (props.setup?.status !== 'ready') return null;
  return (
    <button
      type="button"
      className="small-button primary"
      disabled={props.busy || props.flow.phase.kind !== 'idle'}
      title={`Voice ${props.setup.voiceId} · ${props.setup.model} (channel ${props.setup.channelName})`}
      onClick={props.flow.start}
    >
      {props.generated ? 'Generate again with ElevenLabs' : 'Generate with ElevenLabs'}
    </button>
  );
}

function Confirm(props: {
  readonly estimate: EstimateView;
  readonly flow: GenerateFlow;
}): JSX.Element {
  const { estimate } = props;
  return (
    <div className="voice-confirm" role="group" aria-label="Confirm voice generation">
      <p className="voice-estimate" data-testid="voice-estimate">
        {estimate.line}
      </p>
      {estimate.details.map((line) => (
        <p key={line} className="muted vo-hint">
          {line}
        </p>
      ))}
      {estimate.warning !== null && (
        <p className="fit-line fit-warn" role="alert">
          {estimate.warning}
        </p>
      )}
      <div className="vo-actions">
        <button type="button" className="small-button primary" onClick={props.flow.confirm}>
          {estimate.confirmLabel}
        </button>
        <button type="button" className="small-button" onClick={props.flow.dismiss}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SetupLine({ pointer }: { readonly pointer: SetupPointer }): JSX.Element {
  const openSettings = useOpenSettings();
  if (openSettings === null) {
    return (
      <p className="muted vo-hint" data-testid="voice-setup">
        {pointer.text} (Settings → Channels)
      </p>
    );
  }
  return (
    <div className="vo-setup" data-testid="voice-setup">
      <p className="muted vo-hint">{pointer.text}</p>
      <button
        type="button"
        className="small-button"
        title="Settings → Channels, with this project's channel selected"
        onClick={() => {
          openSettings({ tab: 'channels', channelId: pointer.channelId });
        }}
      >
        {OPEN_CHANNELS_LABEL}
      </button>
    </div>
  );
}

/** Estimate / confirm / progress / outcome below the action buttons. */
export function GenerateStatus(props: {
  readonly setup: VoiceSetup | undefined;
  readonly voice: VoiceControls;
  readonly flow: GenerateFlow;
}): JSX.Element | null {
  const { setup, voice, flow } = props;
  if (setup === undefined) return null;
  const pointer = setupPointer(setup);
  if (pointer !== null) return <SetupLine pointer={pointer} />;
  if (setup.status !== 'ready') return null;
  const running = voice.progress;
  if (running !== null) {
    const view = progressView(running);
    return (
      <section className="stage-run voice-run" aria-label="Voice generation progress">
        <div className="stage-run-header">
          <div className="stage-run-text">
            <h3 className="stage-run-title">Generating with ElevenLabs</h3>
            <p className="stage-run-step" aria-live="polite">
              {view.line}
            </p>
            {running.note !== null && <p className="fit-line fit-warn">{running.note}</p>}
          </div>
          <button
            type="button"
            className="small-button stop-button"
            title="Stop after the paragraph being made; finished paragraphs are kept"
            disabled={running.phase === 'importing'}
            onClick={voice.cancel}
          >
            <StopIcon /> Cancel
          </button>
        </div>
        {view.percent !== null && (
          <div
            className="stage-progress"
            role="progressbar"
            aria-label="Voice generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={view.percent}
          >
            <span style={{ width: `${String(view.percent)}%` }} />
          </div>
        )}
      </section>
    );
  }
  if (flow.phase.kind === 'estimating') {
    return <p className="muted vo-hint">Checking what it costs…</p>;
  }
  if (flow.phase.kind === 'confirm') return <Confirm estimate={flow.phase.estimate} flow={flow} />;
  if (flow.outcome === null) return null;
  return (
    <p
      className={
        flow.outcome.tone === 'error'
          ? 'panel-error'
          : `fit-line fit-${flow.outcome.tone === 'ok' ? 'ok' : 'none'}`
      }
      role={flow.outcome.tone === 'error' ? 'alert' : 'status'}
    >
      {flow.outcome.text}
    </p>
  );
}
