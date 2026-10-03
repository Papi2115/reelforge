/**
 * whisper.cpp setup in the renderer: main's state (reloaded when a job ends or `reloadKey`
 * changes, e.g. another model chosen), the pushed progress, and the actions. Downloads above
 * 200 MB wait for a confirmation ("Download 574 MB?"): `request` parks them in `pending`.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { SettingsWhisperModel } from '@reelforge/shared';
import type { WhisperJob, WhisperProgress } from '../../shared/whisper-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import {
  EMPTY_WHISPER_SETUP,
  formatBytes,
  needsConfirm,
  reduceWhisperSetup,
  type WhisperSetupView,
} from './whisper-setup-state.js';

const log = rendererLog('whisper-setup');

export interface PendingDownload {
  readonly job: WhisperJob;
  readonly bytes: number;
  /** "Download 574 MB?" */
  readonly title: string;
}

export interface WhisperSetupController {
  readonly view: WhisperSetupView;
  readonly pending: PendingDownload | undefined;
  /** `refresh`: re-run detection and the version probes (Re-detect). */
  readonly reload: (refresh: boolean) => void;
  /** Starts `job` (or asks first when it downloads more than 200 MB). */
  readonly request: (job: WhisperJob, bytes: number) => void;
  /** Starts `job` without asking (the button already names the size). */
  readonly start: (job: WhisperJob) => void;
  readonly confirm: () => void;
  readonly dismiss: () => void;
  readonly cancel: () => void;
  readonly remove: (model: SettingsWhisperModel) => void;
  readonly useExisting: (cliPath: string) => void;
}

export function useWhisperSetup(
  reloadKey = '',
  onFinished?: (progress: WhisperProgress) => void,
): WhisperSetupController {
  const [view, dispatch] = useReducer(reduceWhisperSetup, EMPTY_WHISPER_SETUP);
  const [pending, setPending] = useState<PendingDownload | undefined>(undefined);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  const reload = useCallback((refresh: boolean): void => {
    window.reelforge.getWhisperState(refresh).then(
      (state) => {
        dispatch({ type: 'loaded', state });
      },
      (reason: unknown) => {
        log.error(`getWhisperState failed: ${errorMessage(reason)}`);
        dispatch({ type: 'error', message: errorMessage(reason) });
      },
    );
  }, []);

  useEffect(() => {
    reload(false);
  }, [reload, reloadKey]);

  useEffect(
    () =>
      window.reelforge.onWhisperProgress((progress) => {
        dispatch({ type: 'progress', progress });
        if (progress.phase === 'running') return;
        reload(false);
        finished.current?.(progress);
      }),
    [reload],
  );

  const start = useCallback(
    (job: WhisperJob): void => {
      dispatch({ type: 'error', message: undefined });
      window.reelforge.installWhisper(job).then(
        (result) => {
          if (result.status === 'busy') {
            dispatch({ type: 'error', message: 'Another whisper download is still running.' });
          } else if (result.status === 'installed') {
            reload(false);
            finished.current?.({
              job,
              phase: 'done',
              label: null,
              step: 0,
              steps: 0,
              receivedBytes: 0,
              totalBytes: 0,
              bytesPerSecond: null,
              etaS: null,
              message: null,
              detail: null,
            });
          }
        },
        (reason: unknown) => {
          dispatch({ type: 'error', message: errorMessage(reason) });
        },
      );
    },
    [reload],
  );

  const request = useCallback(
    (job: WhisperJob, bytes: number): void => {
      if (needsConfirm(bytes)) setPending({ job, bytes, title: `Download ${formatBytes(bytes)}?` });
      else start(job);
    },
    [start],
  );

  const act = (action: () => Promise<unknown>): void => {
    action().then(
      () => {
        reload(false);
      },
      (reason: unknown) => {
        dispatch({ type: 'error', message: errorMessage(reason) });
      },
    );
  };

  return {
    view,
    pending,
    reload,
    request,
    start,
    confirm: () => {
      if (pending !== undefined) start(pending.job);
      setPending(undefined);
    },
    dismiss: () => {
      setPending(undefined);
    },
    cancel: () => {
      act(() => window.reelforge.cancelWhisperInstall());
    },
    remove: (model) => {
      act(async () => {
        const result = await window.reelforge.deleteWhisperModel(model);
        if (result.status === 'error') dispatch({ type: 'error', message: result.message });
      });
    },
    useExisting: (cliPath) => {
      act(async () => {
        const result = await window.reelforge.useExistingWhisper(cliPath);
        if (result.status === 'invalid') dispatch({ type: 'error', message: result.message });
        else dispatch({ type: 'loaded', state: result.state });
      });
    },
  };
}
