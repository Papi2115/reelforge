/**
 * In-app voice-over recording (PLAN.md#7.2): the microphone is opened only from the user's click
 * (main grants it to this window right after `armMicrophone`), a device picker, a live level meter
 * (AnalyserNode), a 3-2-1 countdown, record / pause / resume / stop / redo, then the take is
 * decoded at 48 kHz, mixed to mono, encoded as 16-bit WAV and sent to main, which validates it,
 * saves it and imports it through the Voiceover stage. Raw processing settings (no echo
 * cancellation / noise suppression / AGC): the Audio cleaned stage does that consistently.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageCommandResult } from '../../shared/stages-contract.js';
import { RECORDING_SAMPLE_RATE } from '../../shared/voiceover-contract.js';
import { encodeWav, levelOf, mixToMono } from '../../shared/wav-encode.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('recorder');
export const COUNTDOWN_S = 3;

export type RecorderPhase =
  'idle' | 'opening' | 'ready' | 'countdown' | 'recording' | 'paused' | 'review' | 'saving';

export interface InputDevice {
  readonly id: string;
  readonly label: string;
}

export interface RecorderControls {
  readonly phase: RecorderPhase;
  readonly error: string | null;
  readonly devices: readonly InputDevice[];
  readonly deviceId: string | null;
  /** Peak level 0..1 of the last ~50 ms. */
  readonly level: number;
  readonly countdown: number | null;
  readonly elapsedS: number;
  readonly open: (deviceId?: string) => Promise<void>;
  readonly record: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly stop: () => void;
  readonly redo: () => void;
  readonly save: () => Promise<StageCommandResult>;
  readonly close: () => void;
}

interface Live {
  stream: MediaStream | null;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  take: Blob | null;
  frame: number;
  timer: number;
  /** Recorded seconds before the current segment + start of the segment (performance.now). */
  doneS: number;
  segmentStart: number | null;
}

function emptyLive(): Live {
  return {
    stream: null,
    context: null,
    analyser: null,
    recorder: null,
    chunks: [],
    take: null,
    frame: 0,
    timer: 0,
    doneS: 0,
    segmentStart: null,
  };
}

function elapsedOf(live: Live): number {
  const running = live.segmentStart === null ? 0 : (performance.now() - live.segmentStart) / 1000;
  return live.doneS + running;
}

async function decodeTake(take: Blob): Promise<Uint8Array> {
  const context = new AudioContext({ sampleRate: RECORDING_SAMPLE_RATE });
  try {
    const decoded = await context.decodeAudioData(await take.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index),
    );
    return encodeWav(mixToMono(channels), RECORDING_SAMPLE_RATE);
  } finally {
    await context.close();
  }
}

export function useRecorder(): RecorderControls {
  const live = useRef<Live>(emptyLive());
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<readonly InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedS, setElapsedS] = useState(0);

  const release = useCallback((): void => {
    const current = live.current;
    cancelAnimationFrame(current.frame);
    window.clearInterval(current.timer);
    if (current.recorder !== null && current.recorder.state !== 'inactive') current.recorder.stop();
    for (const track of current.stream?.getTracks() ?? []) track.stop();
    void current.context?.close();
    live.current = emptyLive();
  }, []);

  useEffect(() => release, [release]);

  const meter = useCallback((): void => {
    const analyser = live.current.analyser;
    if (analyser === null) return;
    const buffer = new Float32Array(analyser.fftSize);
    const tick = (): void => {
      analyser.getFloatTimeDomainData(buffer);
      setLevel(levelOf(buffer).peak);
      if (live.current.segmentStart !== null) setElapsedS(elapsedOf(live.current));
      live.current.frame = requestAnimationFrame(tick);
    };
    live.current.frame = requestAnimationFrame(tick);
  }, []);

  const open = useCallback(
    async (wanted?: string): Promise<void> => {
      release();
      setError(null);
      setPhase('opening');
      try {
        // The click that got us here arms the one-time microphone grant in main.
        await window.reelforge.armMicrophone();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(wanted === undefined ? {} : { deviceId: { exact: wanted } }),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        const context = new AudioContext({ sampleRate: RECORDING_SAMPLE_RATE });
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        context.createMediaStreamSource(stream).connect(analyser);
        live.current = { ...emptyLive(), stream, context, analyser };
        const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === 'audioinput',
        );
        setDevices(
          inputs.map((device, index) => ({
            id: device.deviceId,
            label: device.label || `Microphone ${String(index + 1)}`,
          })),
        );
        setDeviceId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? wanted ?? null);
        setElapsedS(0);
        setPhase('ready');
        meter();
      } catch (reason) {
        log.warn(`microphone not opened: ${errorMessage(reason)}`);
        release();
        setError(`The microphone could not be opened: ${errorMessage(reason)}`);
        setPhase('idle');
      }
    },
    [meter, release],
  );

  const startRecorder = useCallback((): void => {
    const current = live.current;
    if (current.stream === null) return;
    const recorder = new MediaRecorder(current.stream);
    current.chunks = [];
    current.take = null;
    current.doneS = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) live.current.chunks.push(event.data);
    };
    recorder.onstop = () => {
      live.current.take = new Blob(live.current.chunks, { type: recorder.mimeType });
      setPhase('review');
    };
    current.recorder = recorder;
    recorder.start(250);
    current.segmentStart = performance.now();
    setElapsedS(0);
    setPhase('recording');
  }, []);

  const record = useCallback((): void => {
    if (live.current.stream === null) return;
    let left = COUNTDOWN_S;
    setCountdown(left);
    setPhase('countdown');
    window.clearInterval(live.current.timer);
    live.current.timer = window.setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCountdown(left);
        return;
      }
      window.clearInterval(live.current.timer);
      setCountdown(null);
      startRecorder();
    }, 1_000);
  }, [startRecorder]);

  const pause = useCallback((): void => {
    const current = live.current;
    if (current.recorder?.state !== 'recording') return;
    current.recorder.pause();
    current.doneS = elapsedOf(current);
    current.segmentStart = null;
    setPhase('paused');
  }, []);

  const resume = useCallback((): void => {
    const current = live.current;
    if (current.recorder?.state !== 'paused') return;
    current.recorder.resume();
    current.segmentStart = performance.now();
    setPhase('recording');
  }, []);

  const stop = useCallback((): void => {
    const current = live.current;
    if (current.recorder === null || current.recorder.state === 'inactive') return;
    current.doneS = elapsedOf(current);
    current.segmentStart = null;
    setElapsedS(current.doneS);
    current.recorder.stop();
  }, []);

  const redo = useCallback((): void => {
    live.current.take = null;
    live.current.recorder = null;
    record();
  }, [record]);

  const save = useCallback(async (): Promise<StageCommandResult> => {
    const take = live.current.take;
    if (take === null) return { status: 'error', message: 'Nothing recorded yet.' };
    setPhase('saving');
    try {
      const result = await window.reelforge.saveRecording(await decodeTake(take));
      if (result.status === 'error') {
        setError(result.message);
        setPhase('review');
        return result;
      }
      release();
      setPhase('idle');
      return result;
    } catch (reason) {
      const message = `The take could not be saved: ${errorMessage(reason)}`;
      setError(message);
      setPhase('review');
      return { status: 'error', message };
    }
  }, [release]);

  const close = useCallback((): void => {
    release();
    setCountdown(null);
    setPhase('idle');
  }, [release]);

  return {
    phase,
    error,
    devices,
    deviceId,
    level,
    countdown,
    elapsedS,
    open,
    record,
    pause,
    resume,
    stop,
    redo,
    save,
    close,
  };
}
