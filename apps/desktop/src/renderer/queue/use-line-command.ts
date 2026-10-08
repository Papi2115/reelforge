/**
 * Runs one command of the Production line dialog through main and keeps its answer for one line
 * under the control ("2 topics added.", or the error in plain words). One command at a time per
 * control group; a failed IPC call is logged and shown as a short error.
 */
import { useCallback, useState } from 'react';
import type { QueueCommandResult } from '../../shared/queue-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('production-line');

export interface LineCommand {
  readonly busy: boolean;
  readonly note: { readonly text: string; readonly error: boolean } | null;
  readonly run: (name: string, command: () => Promise<QueueCommandResult>) => Promise<boolean>;
  readonly clear: () => void;
}

export function useLineCommand(): LineCommand {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<LineCommand['note']>(null);
  const run = useCallback(
    async (name: string, command: () => Promise<QueueCommandResult>): Promise<boolean> => {
      setBusy(true);
      try {
        const result = await command();
        if (result.status === 'error') {
          setNote({ text: result.message, error: true });
          return false;
        }
        setNote(result.message === null ? null : { text: result.message, error: false });
        return true;
      } catch (error) {
        log.error(`${name} failed: ${errorMessage(error)}`);
        setNote({ text: 'That did not work. See the log for details.', error: true });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  return {
    busy,
    note,
    run,
    clear: () => {
      setNote(null);
    },
  };
}
