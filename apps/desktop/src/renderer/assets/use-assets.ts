/**
 * Asset state of the open project (PLAN.md#12.10, #12.12), read through main again whenever the
 * pipeline state changes (`key`, e.g. the Assets step finished) and after every action (review,
 * own-file import, edit, remove, save to the library).
 */
import { useCallback, useEffect, useState } from 'react';
import type {
  AssetsEditRequest,
  AssetsReviewResult,
  AssetsState,
} from '../../shared/assets-contract.js';
import type { AssetActionResult } from '../../shared/library-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('assets');

export interface AssetsController {
  /** Undefined while loading. */
  readonly state: AssetsState | undefined;
  readonly reload: () => void;
  /** Approves `approve` of package `number` (the rest rejected). */
  readonly review: (number: number, approve: readonly string[]) => Promise<AssetsReviewResult>;
  /** Adds the user's files: dropped paths, or main's file picker without paths. */
  readonly importFiles: (paths?: readonly string[]) => Promise<AssetActionResult>;
  readonly edit: (request: AssetsEditRequest) => Promise<AssetActionResult>;
  readonly remove: (id: string) => Promise<AssetActionResult>;
  readonly setInLibrary: (id: string, save: boolean) => Promise<AssetActionResult>;
}

export function useAssets(dir: string, key: string): AssetsController {
  const [state, setState] = useState<AssetsState | undefined>(undefined);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    window.reelforge.getAssetsState().then(
      (next) => {
        if (active) setState(next);
      },
      (error: unknown) => {
        log.error(`getAssetsState failed: ${errorMessage(error)}`);
        if (active) setState({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [dir, key, revision]);

  const review = useCallback(
    async (number: number, approve: readonly string[]): Promise<AssetsReviewResult> => {
      try {
        return await window.reelforge.reviewAssets({ number, approve: [...approve] });
      } catch (error) {
        log.error(`reviewAssets failed: ${errorMessage(error)}`);
        return { status: 'error', message: errorMessage(error) };
      } finally {
        reload();
      }
    },
    [reload],
  );

  const act = useCallback(
    async (run: () => Promise<AssetActionResult>): Promise<AssetActionResult> => {
      try {
        return await run();
      } catch (error) {
        log.error(`asset action failed: ${errorMessage(error)}`);
        return { status: 'error', message: errorMessage(error) };
      } finally {
        reload();
      }
    },
    [reload],
  );

  return {
    state,
    reload,
    review,
    importFiles: (paths) =>
      act(() => window.reelforge.importAssets(paths === undefined ? {} : { paths: [...paths] })),
    edit: (request) => act(() => window.reelforge.editAsset(request)),
    remove: (id) => act(() => window.reelforge.removeAsset(id)),
    setInLibrary: (id, save) => act(() => window.reelforge.setAssetInLibrary({ id, save })),
  };
}
