/**
 * Export dialog (PLAN.md#9.1, #9.2): preset (with the integer scale factor of the style's render
 * size; impossible ones are disabled with the reason), encoder (+ a real test encode), quality
 * profile, render workers, output folder and file name, chapters and thumbnail (any frame: "Use
 * the playhead frame"), then "Add to queue". The queue and the YouTube suggestions sit beside the
 * form. The last choices are saved by main when a job is queued.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import {
  ENCODER_PREFERENCES,
  EXPORT_QUALITY_PROFILES,
  type EncoderPreference,
} from '@reelforge/shared';
import type { ExportOptions } from '../../shared/export-contract.js';
import { errorMessage } from '../log.js';
import { ExportQueueList } from './ExportQueueList.js';
import {
  autoWorkers,
  ENCODER_LABELS,
  encoderTestLine,
  formProblem,
  formRequest,
  frameTimeText,
  initialForm,
  presetLabel,
  QUALITY_LABELS,
  type ExportForm,
} from './export-view.js';
import { useExport } from './use-export.js';
import { YoutubeExtras } from './YoutubeExtras.js';

export interface ExportDialogProps {
  readonly dir: string;
  /** Preview time (s): "Use the playhead frame" for the thumbnail. */
  readonly playhead: number;
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

function FormFields(props: {
  readonly options: ExportOptions;
  readonly form: ExportForm;
  readonly setForm: (update: (form: ExportForm) => ExportForm) => void;
  readonly playhead: number;
  readonly onFolder: (reset: boolean) => void;
}): JSX.Element {
  const { options, form, setForm } = props;
  const [encoderTest, setEncoderTest] = useState<string | null>(null);
  // Only the newest test may show its answer (the encoder can change while one runs).
  const tests = useRef(0);
  const testEncoder = (encoder: EncoderPreference): void => {
    tests.current += 1;
    const test = tests.current;
    setEncoderTest('Testing…');
    const show = (text: string): void => {
      if (test === tests.current) setEncoderTest(encoder === 'auto' ? `Auto: ${text}` : text);
    };
    window.reelforge.testEncoder(encoder).then(
      (result) => {
        show(encoderTestLine(result));
      },
      (error: unknown) => {
        show(errorMessage(error));
      },
    );
  };
  // The autodetected encoder of "Auto", once when the dialog opens.
  const initialEncoder = useRef(form.encoder);
  useEffect(() => {
    if (initialEncoder.current === 'auto') testEncoder('auto');
  }, []);
  const thumbAt = form.thumbnailAt ?? options.thumbnailDefaultS;
  return (
    <>
      <fieldset className="export-field">
        <legend>
          Preset
          {options.render === null
            ? ''
            : ` (render ${String(options.render.width)}×${String(options.render.height)})`}
        </legend>
        {options.presets.map((preset) => (
          <label
            key={preset.id}
            className={`export-radio${preset.factor === null ? ' blocked' : ''}`}
          >
            <input
              type="radio"
              name="export-preset"
              value={preset.id}
              checked={form.preset === preset.id}
              disabled={preset.factor === null}
              aria-describedby={preset.problem === null ? undefined : `preset-problem-${preset.id}`}
              onChange={() => {
                setForm((current) => ({ ...current, preset: preset.id }));
              }}
            />
            <span>{presetLabel(preset)}</span>
            {preset.problem !== null && (
              <span className="export-problem" id={`preset-problem-${preset.id}`}>
                {preset.problem}
              </span>
            )}
          </label>
        ))}
      </fieldset>
      <div className="export-field export-row">
        <label>
          Encoder
          <select
            value={form.encoder}
            onChange={(event) => {
              const encoder = ENCODER_PREFERENCES.find((id) => id === event.target.value);
              if (encoder !== undefined) setForm((current) => ({ ...current, encoder }));
              tests.current += 1;
              setEncoderTest(null);
            }}
          >
            {ENCODER_PREFERENCES.map((id) => (
              <option key={id} value={id}>
                {ENCODER_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="small-button"
          onClick={() => {
            testEncoder(form.encoder);
          }}
        >
          Test encoder
        </button>
      </div>
      {encoderTest !== null && (
        <p className="export-note" role="status">
          {encoderTest}
        </p>
      )}
      <fieldset className="export-field export-inline">
        <legend>Quality</legend>
        {EXPORT_QUALITY_PROFILES.map((profile) => (
          <label key={profile} className="export-radio">
            <input
              type="radio"
              name="export-quality"
              checked={form.quality === profile}
              onChange={() => {
                setForm((current) => ({ ...current, quality: profile }));
              }}
            />
            {QUALITY_LABELS[profile]}
          </label>
        ))}
      </fieldset>
      <label className="export-field export-row">
        Render workers
        <input
          type="number"
          min={1}
          max={options.cores}
          value={form.workers}
          onChange={(event) => {
            setForm((current) => ({ ...current, workers: Number(event.target.value) }));
          }}
        />
        <span className="muted">
          auto = {autoWorkers(options.cores)} of {options.cores} cores
        </span>
      </label>
      <div className="export-field">
        <span className="export-label">Output folder</span>
        <div className="export-row">
          <span className="export-folder mono" title={options.outputDir}>
            {options.outputDir}
          </span>
          <button
            type="button"
            className="small-button"
            onClick={() => {
              props.onFolder(false);
            }}
          >
            Change…
          </button>
          {options.customOutputDir && (
            <button
              type="button"
              className="small-button"
              onClick={() => {
                props.onFolder(true);
              }}
            >
              Use out/
            </button>
          )}
        </div>
      </div>
      <label className="export-field export-row">
        File name
        <input
          type="text"
          value={form.fileName}
          aria-label="File name"
          onChange={(event) => {
            setForm((current) => ({ ...current, fileName: event.target.value }));
          }}
        />
      </label>
      <label className="export-check">
        <input
          type="checkbox"
          checked={form.includeChapters}
          onChange={(event) => {
            setForm((current) => ({ ...current, includeChapters: event.target.checked }));
          }}
        />
        chapters.txt
        <span className="muted">
          {options.chapters.text === null
            ? ` (${options.chapters.problem ?? 'none'})`
            : ' (YouTube format)'}
        </span>
      </label>
      <div className="export-check-row">
        <label className="export-check">
          <input
            type="checkbox"
            checked={form.includeThumbnail}
            onChange={(event) => {
              setForm((current) => ({ ...current, includeThumbnail: event.target.checked }));
            }}
          />
          thumb.png at{' '}
          <span className="mono">{thumbAt === null ? '—' : frameTimeText(thumbAt)}</span>
          {form.thumbnailAt === null && <span className="muted"> (middle of the first shot)</span>}
        </label>
        <button
          type="button"
          className="small-button"
          title="Use the frame under the timeline playhead as the thumbnail"
          onClick={() => {
            setForm((current) => ({
              ...current,
              includeThumbnail: true,
              thumbnailAt: props.playhead,
            }));
          }}
        >
          Use playhead frame ({frameTimeText(props.playhead)})
        </button>
      </div>
    </>
  );
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

  const problem = form === null || options === undefined ? 'Loading…' : formProblem(form, options);
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
            {options === undefined || form === null ? (
              <p className="muted">Loading…</p>
            ) : (
              <FormFields
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
                title={problem ?? 'Render and encode the video'}
              >
                Add to queue
              </button>
              {problem !== null && problem !== 'Loading…' && (
                <span className="export-problem">{problem}</span>
              )}
            </div>
          </form>
          <div className="export-side">
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
            <YoutubeExtras
              meta={data.meta}
              chapters={options?.chapters ?? { text: null, problem: null }}
              onMeta={data.setMeta}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
