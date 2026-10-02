/**
 * Damaged files of the open project (PLAN.md#10.2): which file, where and what is wrong, with the
 * fix main offers. Documents in git get "Restore from history" (the last good version comes back
 * as a new commit); app state files get "Reset to defaults" (moved aside as a backup).
 */
import { useState, type JSX } from 'react';
import type { FileFix, FileProblem, RepairableFile } from '../../shared/snapshot-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('repair');

const FIX_LABELS: Readonly<Record<FileFix, string>> = {
  restore: 'Restore from history',
  reset: 'Reset to defaults',
};

/** `<project>\timing\words.json` on Windows (the separator of the project folder). */
function fullPath(dir: string, file: string): string {
  const separator = dir.includes('\\') ? '\\' : '/';
  return [dir, ...file.split('/')].join(separator);
}

export interface FileProblemsBannerProps {
  readonly dir: string;
  readonly problems: readonly FileProblem[];
  /** Re-reads the project after a repair. */
  readonly onRepaired: () => void;
}

export function FileProblemsBanner({
  dir,
  problems,
  onRepaired,
}: FileProblemsBannerProps): JSX.Element | null {
  const [busy, setBusy] = useState<RepairableFile | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  if (problems.length === 0 && notice === undefined) return null;

  const repair = (file: RepairableFile): void => {
    setBusy(file);
    setNotice(undefined);
    window.reelforge
      .repairProjectFile(file)
      .then((result) => {
        setNotice(result.status === 'repaired' ? result.message : result.error.message);
        onRepaired();
      })
      .catch((reason: unknown) => {
        log.error(`repair of ${file} failed: ${errorMessage(reason)}`);
        setNotice(errorMessage(reason));
      })
      .finally(() => {
        setBusy(null);
      });
  };

  return (
    <section className="banner file-problems" aria-label="Damaged files">
      {problems.map((problem) => (
        <div key={problem.file} className="file-problem" role="alert">
          <p className="panel-error">{problem.message}</p>
          <p className="muted file-problem-path">{fullPath(dir, problem.file)}</p>
          <button
            type="button"
            className="small-button"
            disabled={busy !== null}
            onClick={() => {
              repair(problem.file);
            }}
          >
            {FIX_LABELS[problem.fix]}
          </button>
        </div>
      ))}
      {notice !== undefined && (
        <p className="muted" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
