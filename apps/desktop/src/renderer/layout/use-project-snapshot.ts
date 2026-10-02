/**
 * Keeps the open project's snapshot fresh (PLAN.md#6.3): read once, then again after every
 * `projectChanged` push. `previewRevision` advances only when a change can alter the video, so
 * the preview reloads its manifest only then; `audioRevision` advances when project audio changed,
 * so the player reloads its master clock media (PLAN.md#6.4).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectSnapshot } from '../../shared/snapshot-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { affectsAudio } from '../preview/audio-source.js';
import { affectsPreview } from '../preview/preview-source.js';

const log = rendererLog('project');

export interface ProjectData {
  readonly snapshot: ProjectSnapshot | undefined;
  readonly error: string | undefined;
  readonly previewRevision: number;
  readonly audioRevision: number;
  /** Reads the snapshot again; resolves once it is in state (after an edit made by the app). */
  readonly reload: () => Promise<void>;
}

export function useProjectSnapshot(dir: string): ProjectData {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [audioRevision, setAudioRevision] = useState(0);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    let active = true;
    let latest = 0;
    let latestLoad: Promise<void> = Promise.resolve();
    const load = (): Promise<void> => {
      latest += 1;
      const request = latest;
      latestLoad = window.reelforge.getProjectSnapshot().then(
        (result) => {
          if (!active) return undefined;
          // Superseded: settle when the newer read is in state.
          if (request !== latest) return latestLoad;
          if (result.status === 'ok') {
            setSnapshot(result.snapshot);
            setError(undefined);
          } else {
            setError(result.error.message);
          }
          return undefined;
        },
        (reason: unknown) => {
          log.error(`getProjectSnapshot failed: ${errorMessage(reason)}`);
          if (active) setError(errorMessage(reason));
        },
      );
      return latestLoad;
    };
    loadRef.current = load;
    setSnapshot(undefined);
    void load();
    const unsubscribe = window.reelforge.onProjectChanged((event) => {
      if (event.dir !== dir) return;
      void load();
      if (affectsPreview(event)) setPreviewRevision((revision) => revision + 1);
      if (affectsAudio(event.paths, event.truncated)) setAudioRevision((revision) => revision + 1);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [dir]);

  const reload = useCallback(() => loadRef.current(), []);
  return { snapshot, error, previewRevision, audioRevision, reload };
}
