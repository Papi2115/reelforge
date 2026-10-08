/**
 * ElevenLabs voice state of the open project (PLAN.md#13.14): read on mount, again when a voice
 * job finishes (main's `voiceProgress` push) and when the Voiceover step changes (`refreshKey`),
 * plus the live progress of a running job. Calls never throw: an IPC failure becomes a `failed`
 * problem the panel shows.
 */
import { useCallback, useEffect, useState } from 'react';
import type {
  VoiceEstimateResult,
  VoiceGenerateResult,
  VoiceProblem,
  VoiceProgress,
  VoiceRetakeResult,
  VoiceState,
} from '../../shared/voice-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('voice');

export interface VoiceControls {
  readonly state: VoiceState | undefined;
  /** The running job's progress (push), else the one in the state. */
  readonly progress: VoiceProgress | null;
  readonly estimate: () => Promise<VoiceEstimateResult>;
  readonly generate: () => Promise<VoiceGenerateResult>;
  readonly cancel: () => void;
  readonly retake: (sentenceId: string) => Promise<VoiceRetakeResult>;
}

async function guarded<T>(
  action: string,
  call: () => Promise<T | VoiceProblem>,
): Promise<T | VoiceProblem> {
  try {
    return await call();
  } catch (error) {
    log.error(`${action} failed: ${errorMessage(error)}`);
    return { status: 'error', kind: 'failed', message: errorMessage(error) };
  }
}

/** `refreshKey`: changes when the Voiceover step ran (its status/time), so the state is re-read. */
export function useVoice(refreshKey: string): VoiceControls {
  const [state, setState] = useState<VoiceState | undefined>(undefined);
  const [progress, setProgress] = useState<VoiceProgress | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    window.reelforge.getVoiceState().then(
      (next) => {
        if (!active) return;
        setState(next);
        setProgress(next.running);
      },
      (error: unknown) => {
        log.error(`getVoiceState failed: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [refreshKey, reloads]);

  useEffect(
    () =>
      window.reelforge.onVoiceProgress((next) => {
        setProgress(next.finished ? null : next);
        if (next.finished) setReloads((count) => count + 1);
      }),
    [],
  );

  const estimate = useCallback(
    () => guarded('estimateVoice', () => window.reelforge.estimateVoice()),
    [],
  );
  const generate = useCallback(
    () => guarded('generateVoice', () => window.reelforge.generateVoice()),
    [],
  );
  const retake = useCallback(
    (sentenceId: string) =>
      guarded('retakeSentence', () => window.reelforge.retakeSentence(sentenceId)),
    [],
  );
  const cancel = useCallback(() => {
    window.reelforge.cancelVoice().catch((error: unknown) => {
      log.error(`cancelVoice failed: ${errorMessage(error)}`);
    });
  }, []);
  return { state, progress, estimate, generate, cancel, retake };
}
