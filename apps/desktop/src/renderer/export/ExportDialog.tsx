/**
 * Export dialog (PLAN.md#9.1, #9.2; v2 = U11 of docs/ux/redesign-2.4.md). Left: shots the final
 * review (PLAN.md#11.5) left ⚠/✗ (click one to go to it), the asset licences, then the form with
 * the essentials first (format, quality, file name, folder, also save) and the technical knobs
 * under "Advanced", and "Export video" ("Export anyway" with pre-flight shots; a scene that cannot
 * render at all blocks it). Right: the export queue, only while something runs or is listed, then
 * one "YouTube texts" section (titles + the publish kit, PLAN.md#12.17). The last choices are
 * saved by main when a job is queued.
 */
import { useEffect, useState, type JSX } from 'react';
import { ExportAssets } from '../assets/ExportAssets.js';
import { errorMessage } from '../log.js';
import { ExportPreflight } from '../stages/FinalReview.js';
import type { Preflight } from '../stages/final-review-view.js';
import { ExportFormFields } from './ExportFormFields.js';
import { ExportQueueList } from './ExportQueueList.js';
import {
  formProblem,
  formRequest,
  initialForm,
  queueVisible,
  type ExportForm,
} from './export-view.js';
import { useExport } from './use-export.js';
import { YoutubeExtras } from './YoutubeExtras.js';

export interface ExportDialogProps {
  readonly dir: string;
  /** Preview time (s): "Use the playhead frame" for the thumbnail. */
  readonly playhead: number;
  /** ⚠/✗ shots left by the final review (or the last build). */
  readonly preflight: Preflight;
  /** A pre-flight shot was clicked: select it and seek there (the dialog closes). */
  readonly onSeekShot: (shotId: string, t: number) => void;
  readonly onClose: () => void;
}

function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
}

export function ExportDialog(props: ExportDialogProps): JSX.Element {
  const data = useExport(props.dir);
  const { options } = data;
  const [form, setForm] = useState<ExportForm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEscape(props.onClose);

  useEffect(() => {
    if (options !== undefined && options.projectDir !== null) {
      setForm((current) => current ?? initialForm(options));
    }
  }, [options]);

  const { preflight } = props;
  const problem =
    form === null || options === undefined
      ? 'Loading…'
      : (formProblem(form, options) ?? preflight.blocker);
  const anyway = preflight.items.length > 0;
  const enqueue = (): void => {
    if (form === null || problem !== null) return;
    setNotice(null);
    window.reelforge.enqueueExport(formRequest(form)).then(
      (result) => {
        if (result.status === 'invalid') setNotice(result.message);
      },
      (error: unknown) => {
        setNotice(errorMessage(error));
      },
    );
  };
  const report = (promise: Promise<{ status: string; message?: string | null }>): void => {
    promise.then(
      (result) => {
        if (result.status === 'invalid' || result.status === 'error') {
          setNotice(result.message ?? 'That did not work.');
        }
      },
      (error: unknown) => {
        setNotice(errorMessage(error));
      },
    );
  };

  return (
    <div className="modal-backdrop">
      <div className="export-dialog" role="dialog" aria-modal="true" aria-label="Export video">
        <header className="settings-header">
          <h2 className="modal-title">Export video</h2>
          <button type="button" className="small-button" onClick={props.onClose}>
            Close
          </button>
        </header>
        <div className="export-body">
          <form
            className="export-form"
            aria-label="Export settings"
            onSubmit={(event) => {
              event.preventDefault();
              enqueue();
            }}
          >
            <ExportPreflight preflight={preflight} onSeekShot={props.onSeekShot} />
            <ExportAssets dir={props.dir} />
            {options === undefined || form === null ? (
              <p className="muted">Loading…</p>
            ) : (
              <ExportFormFields
                options={options}
                form={form}
                setForm={(update) => {
                  setForm((current) => (current === null ? current : update(current)));
                }}
                playhead={props.playhead}
                onFolder={(reset) => {
                  report(
                    window.reelforge.pickExportFolder(reset).then((result) => {
                      if (result.status === 'saved') data.refresh();
                      return result;
                    }),
                  );
                }}
              />
            )}
            {options?.warnings.map((warning) => (
              <p key={warning} className="export-note qa-warning">
                {warning}
              </p>
            ))}
            {notice !== null && (
              <p className="panel-error" role="alert">
                {notice}
              </p>
            )}
            <div className="export-submit">
              <button
                type="submit"
                className="primary"
                aria-disabled={problem !== null}
                title={
                  problem ??
                  (anyway
                    ? 'Render and encode the video with the shots listed above as they are'
                    : 'Render and encode the video')
                }
              >
                {anyway ? 'Export anyway' : 'Export video'}
              </button>
              {problem !== null && problem !== 'Loading…' && (
                <span className="export-problem">{problem}</span>
              )}
            </div>
          </form>
          <div className="export-side">
            {queueVisible(data.queue) && (
              <ExportQueueList
                queue={data.queue}
                onCancel={(id) => {
                  void window.reelforge.cancelExportJob(id);
                }}
                onResume={(id) => {
                  report(window.reelforge.resumeExportJob(id));
                }}
                onResumeInterrupted={() => {
                  report(window.reelforge.resumeInterruptedExport());
                }}
                onOpenFolder={(id) => {
                  report(window.reelforge.openExportFolder(id));
                }}
              />
            )}
            <YoutubeExtras meta={data.meta} onMeta={data.setMeta} />
          </div>
        </div>
      </div>
    </div>
  );
}
