/**
 * The Sound panel's state (PLAN.md#8.2), read through main again when project files it shows
 * change (cues.json, audio/, the mix report, stems) or a stage finished, and its commands. Gains
 * and ducking are sent debounced, so dragging a slider writes (and commits) once it rests.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LibrarySound,
  SoundAction,
  SoundKind,
  SoundMixPatch,
  SoundState,
} from '../../shared/sound-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { mergeGains } from './sound-view.js';

const log = rendererLog('sound');

/** Slider writes wait for this long without a change. */
export const MIX_WRITE_DELAY_MS = 400;

const SOUND_PATHS = /^(cues\.json|audio\/|\.reelforge\/reports\/mix\.json|out\/stems\/)/;

export interface SoundControls {
  readonly state: SoundState | undefined;
  readonly notice: string | null;
  readonly run: (action: SoundAction) => void;
  readonly importFiles: (kind: SoundKind) => void;
  readonly preview: (sound: LibrarySound) => Promise<string | null>;
  /** Shown at once; written after MIX_WRITE_DELAY_MS without further changes. */
  readonly setMix: (patch: SoundMixPatch) => void;
}

export function useSound(dir: string, stagesKey: string): SoundControls {
  const [state, setState] = useState<SoundState | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<{ patch: SoundMixPatch; timer: number } | null>(null);

  const load = useCallback(() => {
    window.reelforge.getSoundState().then(
      (next) => {
        if (next.projectDir === dir) setState(next);
      },
      (error: unknown) => {
        log.error(`getSoundState failed: ${errorMessage(error)}`);
      },
    );
  }, [dir]);

  useEffect(() => {
    load();
    return window.reelforge.onProjectChanged((event) => {
      if (event.dir === dir && (event.truncated || event.paths.some((p) => SOUND_PATHS.test(p)))) {
        load();
      }
    });
  }, [dir, load, stagesKey]);

  const report = (result: { status: string; message: string | null }): void => {
    setNotice(
      result.status === 'error' ? (result.message ?? 'That did not work.') : result.message,
    );
  };

  const run = useCallback((action: SoundAction) => {
    setNotice(null);
    window.reelforge.runSound(action).then(report, (error: unknown) => {
      setNotice(errorMessage(error));
    });
  }, []);

  const importFiles = useCallback(
    (kind: SoundKind) => {
      setNotice(null);
      window.reelforge.importSounds(kind).then(
        (result) => {
          report(result);
          if (result.status === 'ok') load();
        },
        (error: unknown) => {
          setNotice(errorMessage(error));
        },
      );
    },
    [load],
  );

  const preview = useCallback(async (sound: LibrarySound): Promise<string | null> => {
    const result = await window.reelforge.previewSound(sound);
    if (result.status === 'ok') return result.file;
    setNotice(result.message);
    return null;
  }, []);

  const flush = useCallback(() => {
    const current = pending.current;
    pending.current = null;
    if (current === null) return;
    window.reelforge.setMix(current.patch).then(
      (result) => {
        setNotice(result.status === 'ok' ? null : result.message);
        load();
      },
      (error: unknown) => {
        setNotice(errorMessage(error));
      },
    );
  }, [load]);

  const setMix = useCallback(
    (patch: SoundMixPatch) => {
      setState((current) =>
        current === undefined
          ? current
          : {
              ...current,
              gains: mergeGains(current.gains, patch.gains),
              ducking: patch.ducking ?? current.ducking,
            },
      );
      const merged: SoundMixPatch = {
        ...pending.current?.patch,
        ...patch,
        ...(patch.gains === undefined
          ? {}
          : { gains: { ...pending.current?.patch.gains, ...patch.gains } }),
      };
      if (pending.current !== null) window.clearTimeout(pending.current.timer);
      pending.current = { patch: merged, timer: window.setTimeout(flush, MIX_WRITE_DELAY_MS) };
    },
    [flush],
  );

  useEffect(
    () => () => {
      flush();
    },
    [dir, flush],
  );

  return { state, notice, run, importFiles, preview, setMix };
}
