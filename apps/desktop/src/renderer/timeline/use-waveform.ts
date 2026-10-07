/**
 * Waveform of the playing audio for the Audio track (PLAN.md#6.5): asks main for the peaks of
 * the file whenever it (or its revision) changes.
 */
import { useEffect, useState } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import type { WaveformView } from './draw-timeline.js';

const log = rendererLog('waveform');

/** `file`: project-relative audio (undefined: the project has none yet). */
export function useWaveform(file: string | undefined, revision: number): WaveformView {
  const [waveform, setWaveform] = useState<WaveformView>({ kind: 'message', text: '' });

  useEffect(() => {
    if (file === undefined) {
      setWaveform({
        kind: 'message',
        text: 'No voiceover yet: add it in Voiceover added',
        missing: true,
      });
      return undefined;
    }
    let active = true;
    setWaveform({ kind: 'message', text: 'Reading the waveform…' });
    window.reelforge.getWaveform(file).then(
      (result) => {
        if (!active) return;
        setWaveform(
          result.status === 'ok'
            ? { kind: 'ok', source: { peaks: result.peaks, peaksPerSecond: result.peaksPerSecond } }
            : { kind: 'message', text: `Waveform unavailable: ${result.reason}` },
        );
      },
      (error: unknown) => {
        log.warn(`waveform of ${file} failed: ${errorMessage(error)}`);
        if (active) setWaveform({ kind: 'message', text: 'Waveform unavailable' });
      },
    );
    return () => {
      active = false;
    };
  }, [file, revision]);

  return waveform;
}
