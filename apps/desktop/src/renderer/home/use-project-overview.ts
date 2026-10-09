/**
 * The project overview's data and actions (PLAN.md#13.16 part B, #13.18): the overview of the open
 * project (read again when the window gets focus back), thumbnail upload / remove, "Show in
 * folder" of the last export, the film's two Shorts and a Short's captions switch. One action at a
 * time; its outcome is a short note in plain words.
 */
import { useCallback, useEffect, useState } from 'react';
import type { HomeActionResult } from '../../shared/home-contract.js';
import type { ProjectOverview, ThumbnailResult } from '../../shared/overview-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('overview');

export type OverviewAction = 'thumbnail' | 'shorts' | 'captions' | 'export';

export interface ProjectOverviewController {
  /** Undefined until the first answer. */
  readonly overview: ProjectOverview | undefined;
  readonly error: string | undefined;
  /** The action in progress, if any. */
  readonly busy: OverviewAction | null;
  /** Outcome of the last action. */
  readonly note: string | null;
  readonly uploadThumbnail: () => void;
  readonly removeThumbnail: () => void;
  readonly showExport: () => void;
  readonly createShorts: () => void;
  readonly setCaptions: (captions: boolean) => void;
}

export function useProjectOverview(dir: string): ProjectOverviewController {
  const [overview, setOverview] = useState<ProjectOverview | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<OverviewAction | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback((): void => {
    window.reelforge.getProjectOverview(dir).then(
      (result) => {
        if (result.status === 'ok') {
          setOverview(result.overview);
          setError(undefined);
        } else setError(result.message);
      },
      (reason: unknown) => {
        log.error(`getProjectOverview failed: ${errorMessage(reason)}`);
        setError('The overview could not be read. See the log for details.');
      },
    );
  }, [dir]);

  useEffect(() => {
    load();
    window.addEventListener('focus', load);
    return () => {
      window.removeEventListener('focus', load);
    };
  }, [load]);

  /** Runs one action; `done` turns its answer into a note (null = none). */
  const act = <Result>(
    action: OverviewAction,
    call: () => Promise<Result>,
    done: (result: Result) => string | null,
  ): void => {
    if (busy !== null) return;
    setBusy(action);
    setNote(null);
    call()
      .then(
        (result) => {
          setNote(done(result));
        },
        (reason: unknown) => {
          log.error(`${action} failed: ${errorMessage(reason)}`);
          setNote('That did not work. See the log for details.');
        },
      )
      .finally(() => {
        setBusy(null);
      });
  };

  const thumbnailDone =
    (success: string) =>
    (result: ThumbnailResult): string | null => {
      if (result.status === 'ok') setOverview(result.overview);
      if (result.status === 'error') return result.message;
      return result.status === 'ok' ? success : null;
    };
  const actionDone =
    (success: string | null) =>
    (result: HomeActionResult): string | null => {
      if (result.status === 'error') return result.message;
      load();
      return success;
    };

  return {
    overview,
    error,
    busy,
    note,
    uploadThumbnail: () => {
      act(
        'thumbnail',
        () => window.reelforge.uploadThumbnail(dir),
        thumbnailDone('Thumbnail saved.'),
      );
    },
    removeThumbnail: () => {
      act(
        'thumbnail',
        () => window.reelforge.removeThumbnail(dir),
        thumbnailDone('Thumbnail removed.'),
      );
    },
    showExport: () => {
      act('export', () => window.reelforge.showLastExport(dir), actionDone(null));
    },
    createShorts: () => {
      act(
        'shorts',
        () => window.reelforge.createShorts({ dir, captions: false }),
        (result) => {
          if (result.status === 'error') return result.message;
          load();
          return 'Two Shorts made (30 s and 60 s): open one below.';
        },
      );
    },
    setCaptions: (captions) => {
      act(
        'captions',
        () => window.reelforge.setShortCaptions(dir, captions),
        actionDone(captions ? 'Captions on.' : 'Captions off.'),
      );
    },
  };
}
