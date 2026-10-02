/**
 * The script documents of the open project (PLAN.md#7.1): script.txt, research.md, beats.md, the
 * sources and the script report, read through main and read again whenever one of those files
 * changes on disk or the script stage changes state (`stageKey`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScriptDocument } from '../../shared/stages-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('script');

const WATCHED = new Set([
  'brief.json',
  'script.txt',
  'research.md',
  'beats.md',
  '.reelforge/reports/script.json',
]);

export interface ScriptDocumentData {
  /** undefined while the first read is in flight. */
  readonly document: ScriptDocument | undefined;
  readonly reload: () => void;
}

export function useScriptDocument(dir: string, stageKey: string): ScriptDocumentData {
  const [document, setDocument] = useState<ScriptDocument | undefined>(undefined);
  const latest = useRef(0);

  const reload = useCallback(() => {
    latest.current += 1;
    const request = latest.current;
    window.reelforge.getScript().then(
      (next) => {
        if (request === latest.current) setDocument(next);
      },
      (error: unknown) => {
        log.error(`getScript failed: ${errorMessage(error)}`);
      },
    );
  }, []);

  useEffect(() => {
    reload();
  }, [reload, stageKey]);

  useEffect(
    () =>
      window.reelforge.onProjectChanged((event) => {
        if (event.dir !== dir) return;
        if (event.truncated || event.paths.some((changed) => WATCHED.has(changed))) reload();
      }),
    [dir, reload],
  );

  return { document, reload };
}
