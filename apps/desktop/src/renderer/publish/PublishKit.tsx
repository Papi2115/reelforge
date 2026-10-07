/**
 * Publish kit of the export dialog (PLAN.md#12.17), inside its "YouTube texts" section (U11 of
 * docs/ux/redesign-2.4.md): the four paste-ready texts of the finished film (description,
 * chapters, tags, credits) with a Copy button each, "Refresh", "Save to publish/" (tracked,
 * committed) and "Open folder". A banner warns while a used asset's licence is unverified.
 * Nothing is uploaded: the user pastes the texts into YouTube Studio.
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import type { PublishKitResult } from '../../shared/publish-contract.js';
import { CopyButton } from '../export/CopyButton.js';
import { errorMessage } from '../log.js';
import {
  chaptersNote,
  kitSummary,
  previewRows,
  PUBLISH_FILE_LABELS,
  saveNote,
  unverifiedBanner,
} from './publish-view.js';

export interface PublishKitProps {
  /** Changes when the YouTube suggestions change (the kit is read again). */
  readonly revision: string;
}

export function PublishKit({ revision }: PublishKitProps): JSX.Element {
  const [result, setResult] = useState<PublishKitResult | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    window.reelforge.getPublishKit().then(setResult, (error: unknown) => {
      setResult({ status: 'error', message: errorMessage(error) });
    });
  }, []);

  useEffect(() => {
    load();
  }, [load, revision]);

  const save = (): void => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    window.reelforge.savePublishKit().then(
      (saved) => {
        setBusy(false);
        setNote(saveNote(saved));
        load();
      },
      (error: unknown) => {
        setBusy(false);
        setNote(`Not saved: ${errorMessage(error)}`);
      },
    );
  };
  const openFolder = (): void => {
    window.reelforge.openPublishFolder().then(
      (opened) => {
        if (opened.status === 'error') setNote(opened.message);
      },
      (error: unknown) => {
        setNote(errorMessage(error));
      },
    );
  };

  const kit = result?.status === 'ok' ? result.kit : null;
  const banner = kit === null ? null : unverifiedBanner(kit);
  const chapters = kit === null ? null : chaptersNote(kit);
  return (
    <div className="publish-kit">
      {result === undefined && <p className="muted">Reading the project…</p>}
      {result?.status === 'error' && <p className="muted">{result.message}</p>}
      {kit !== null && (
        <>
          <p className="muted publish-summary">{kitSummary(kit)}</p>
          {banner !== null && (
            <p className="publish-banner" role="alert">
              {banner}
            </p>
          )}
          {kit.warnings
            .filter((warning) => banner === null || !warning.includes('unverified'))
            .map((warning) => (
              <p key={warning} className="export-note qa-warning">
                {warning}
              </p>
            ))}
          {kit.files.map((file) => (
            <div key={file.name} className="publish-file">
              <div className="publish-file-head">
                <span className="publish-file-label">
                  {PUBLISH_FILE_LABELS[file.name]} <span className="muted mono">{file.name}</span>
                </span>
                <CopyButton text={file.text} label={PUBLISH_FILE_LABELS[file.name].toLowerCase()} />
              </div>
              {file.name === 'chapters.txt' && chapters !== null && (
                <p className="muted publish-note">{chapters}</p>
              )}
              <textarea
                className="publish-text mono"
                readOnly
                rows={previewRows(file.text)}
                value={file.text}
                aria-label={`${PUBLISH_FILE_LABELS[file.name]} (${file.name})`}
              />
            </div>
          ))}
        </>
      )}
      <div className="publish-actions">
        <button type="button" className="small-button" onClick={load}>
          Refresh
        </button>
        {kit !== null && (
          <>
            <button type="button" className="small-button" aria-disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save to publish/'}
            </button>
            <button type="button" className="small-button" onClick={openFolder}>
              Open folder
            </button>
          </>
        )}
      </div>
      {note !== null && (
        <p className="muted publish-note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
