/**
 * "Listen to mix" (PLAN.md#8.2): what the player monitors (the full mix or the voice-over only)
 * and the preview mix of cue edits. When cues.json changes (a timeline edit, a slider, a new cue)
 * and a mix exists, main re-renders ≤ 20 s around the playhead into a new full-length preview file
 * and the player switches to it at the same position; a new full mix render (audio/ changed)
 * goes back to mix.wav. Requests are debounced, so a burst of nudges costs one render.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import type { MonitorMode, PreviewMixFile } from '../preview/audio-source.js';

const log = rendererLog('mix-preview');

export const PREVIEW_DEBOUNCE_MS = 400;

export interface MixPreviewView {
  readonly file: string;
  readonly startS: number;
  readonly durationS: number;
  readonly ms: number;
}

export interface MixPreviewControls {
  readonly monitor: MonitorMode;
  readonly setMonitor: (mode: MonitorMode) => void;
  /** The preview file the player should play instead of mix.wav (null: mix.wav). */
  readonly playing: PreviewMixFile | null;
  readonly last: MixPreviewView | null;
  readonly busy: boolean;
  readonly message: string | null;
}

export function useMixPreview(
  dir: string,
  audioRevision: number,
  hasMix: boolean,
  playhead: () => number,
): MixPreviewControls {
  const [monitor, setMonitor] = useState<MonitorMode>('mix');
  const [last, setLast] = useState<MixPreviewView | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const playheadRef = useRef(playhead);
  playheadRef.current = playhead;
  const hasMixRef = useRef(hasMix);
  hasMixRef.current = hasMix;

  // A new full mix (or another project) replaces every preview.
  useEffect(() => {
    setLast(null);
    setMessage(null);
  }, [dir, audioRevision]);

  const render = useCallback(() => {
    setBusy(true);
    window.reelforge.renderMixPreview(Math.max(0, playheadRef.current())).then(
      (result) => {
        setBusy(false);
        if (result.status === 'ok') {
          setLast(result);
          setRevision((value) => value + 1);
          setMessage(null);
        } else if (result.status === 'error') {
          setMessage(`Preview mix failed: ${result.message}`);
        } else if (!result.reason.startsWith('superseded')) {
          setMessage(result.reason);
        }
      },
      (error: unknown) => {
        setBusy(false);
        log.error(`renderMixPreview failed: ${errorMessage(error)}`);
      },
    );
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = window.reelforge.onProjectChanged((event) => {
      if (event.dir !== dir || !event.paths.includes('cues.json') || !hasMixRef.current) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(render, PREVIEW_DEBOUNCE_MS);
    });
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [dir, render]);

  return {
    monitor,
    setMonitor,
    playing: last === null ? null : { file: last.file, revision },
    last,
    busy,
    message,
  };
}
