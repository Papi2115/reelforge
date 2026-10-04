/**
 * The Library dialog's state (PLAN.md#12.19): the global asset library searched with the current
 * filters, read again after every action.
 */
import { useCallback, useEffect, useState } from 'react';
import type {
  AssetActionResult,
  LibraryEditRequest,
  LibraryState,
} from '../../shared/library-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { EMPTY_LIBRARY_FILTERS, libraryQuery, type LibraryFilters } from './library-view.js';

const log = rendererLog('library');

export interface LibraryController {
  readonly state: LibraryState | undefined;
  readonly filters: LibraryFilters;
  readonly setFilters: (filters: LibraryFilters) => void;
  readonly edit: (request: LibraryEditRequest) => Promise<AssetActionResult>;
  readonly remove: (sha256: string) => Promise<AssetActionResult>;
  readonly use: (sha256: string) => Promise<AssetActionResult>;
}

async function action(run: () => Promise<AssetActionResult>): Promise<AssetActionResult> {
  try {
    return await run();
  } catch (error) {
    log.error(`library action failed: ${errorMessage(error)}`);
    return { status: 'error', message: errorMessage(error) };
  }
}

export function useLibrary(onChanged: () => void): LibraryController {
  const [state, setState] = useState<LibraryState | undefined>(undefined);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_LIBRARY_FILTERS);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    window.reelforge.getLibraryState(libraryQuery(filters)).then(
      (next) => {
        if (active) setState(next);
      },
      (error: unknown) => {
        log.error(`getLibraryState failed: ${errorMessage(error)}`);
        if (active) setState({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [filters, revision]);

  const after = useCallback(
    async (run: () => Promise<AssetActionResult>): Promise<AssetActionResult> => {
      const result = await action(run);
      setRevision((current) => current + 1);
      onChanged();
      return result;
    },
    [onChanged],
  );

  return {
    state,
    filters,
    setFilters,
    edit: (request) => after(() => window.reelforge.editLibraryEntry(request)),
    remove: (sha256) => after(() => window.reelforge.removeLibraryEntry(sha256)),
    use: (sha256) => after(() => window.reelforge.useLibraryEntry(sha256)),
  };
}
