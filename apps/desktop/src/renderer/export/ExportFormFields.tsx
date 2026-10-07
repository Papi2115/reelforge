/**
 * The export form (PLAN.md#9.1, U11 of docs/ux/redesign-2.4.md), essentials first: format (preset
 * with the integer scale factor; impossible ones disabled with the reason), quality, file name and
 * folder, then "Also save" (chapters, honest when YouTube's rule skips them; the thumbnail frame).
 * Encoder (+ a real test encode) and render workers sit under the "Advanced" disclosure, which
 * stays mounted while closed so the autodetected encoder line survives toggling.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import {
  ENCODER_PREFERENCES,
  EXPORT_QUALITY_PROFILES,
  type EncoderPreference,
} from '@reelforge/shared';
import type { ExportOptions } from '../../shared/export-contract.js';
import { errorMessage } from '../log.js';
import {
  advancedSummary,
  autoWorkers,
  chaptersRow,
  ENCODER_LABELS,
  encoderTestLine,
  frameTimeText,
  presetLabel,
  QUALITY_LABELS,
  type ExportForm,
} from './export-view.js';

export interface ExportFormFieldsProps {
  readonly options: ExportOptions;
  readonly form: ExportForm;
  readonly setForm: (update: (form: ExportForm) => ExportForm) => void;
  readonly playhead: number;
  readonly onFolder: (reset: boolean) => void;
}

function FormatFields({ options, form, setForm }: ExportFormFieldsProps): JSX.Element {
  return (
    <>
      <fieldset className="export-field">
        <legend>
          Format
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
    </>
  );
}

function OutputFields({ options, form, setForm, onFolder }: ExportFormFieldsProps): JSX.Element {
  return (
    <fieldset className="export-field export-group">
      <legend>Output</legend>
      <label className="export-row">
        <span className="export-label export-label-fixed">File name</span>
        <input
          type="text"
          value={form.fileName}
          aria-label="File name"
          onChange={(event) => {
            setForm((current) => ({ ...current, fileName: event.target.value }));
          }}
        />
      </label>
      <div className="export-row">
        <span className="export-label export-label-fixed">Save to</span>
        <span className="export-folder mono" title={options.outputDir}>
          {options.outputDir}
        </span>
        <button
          type="button"
          className="small-button"
          onClick={() => {
            onFolder(false);
          }}
        >
          Change…
        </button>
        {options.customOutputDir && (
          <button
            type="button"
            className="small-button"
            onClick={() => {
              onFolder(true);
            }}
          >
            Use out/
          </button>
        )}
      </div>
    </fieldset>
  );
}

function AlsoSaveFields({ options, form, setForm, playhead }: ExportFormFieldsProps): JSX.Element {
  const chapters = chaptersRow(options.chapters, form.includeChapters);
  const thumbAt = form.thumbnailAt ?? options.thumbnailDefaultS;
  return (
    <fieldset className="export-field export-group">
      <legend>Also save</legend>
      <label className={`export-check${chapters.available ? '' : ' unavailable'}`}>
        <input
          type="checkbox"
          checked={chapters.available && form.includeChapters}
          disabled={!chapters.available}
          onChange={(event) => {
            setForm((current) => ({ ...current, includeChapters: event.target.checked }));
          }}
        />
        Chapters <span className="muted export-chapters-note">{chapters.text}</span>
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
          Thumbnail at{' '}
          <span className="mono">{thumbAt === null ? '—' : frameTimeText(thumbAt)}</span>
          {form.thumbnailAt === null && <span className="muted"> (middle of the first shot)</span>}
        </label>
        <button
          type="button"
          className="small-button"
          title="Use the frame under the timeline playhead as the thumbnail"
          onClick={() => {
            setForm((current) => ({ ...current, includeThumbnail: true, thumbnailAt: playhead }));
          }}
        >
          Use playhead frame ({frameTimeText(playhead)})
        </button>
      </div>
    </fieldset>
  );
}

function AdvancedFields({ options, form, setForm }: ExportFormFieldsProps): JSX.Element {
  const [open, setOpen] = useState(false);
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
  return (
    <div className="export-advanced">
      <div className="export-advanced-head">
        <button
          type="button"
          className="export-disclosure"
          aria-expanded={open}
          aria-controls="export-advanced-body"
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span> Advanced
        </button>
        {!open && <span className="muted export-advanced-summary">{advancedSummary(form)}</span>}
      </div>
      <div id="export-advanced-body" className="export-advanced-body" hidden={!open}>
        <div className="export-field export-row">
          <label className="export-row">
            <span className="export-label export-label-fixed">Encoder</span>
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
        <label className="export-field export-row">
          <span className="export-label export-label-fixed">Render workers</span>
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
      </div>
    </div>
  );
}

export function ExportFormFields(props: ExportFormFieldsProps): JSX.Element {
  return (
    <>
      <FormatFields {...props} />
      <OutputFields {...props} />
      <AlsoSaveFields {...props} />
      <AdvancedFields {...props} />
    </>
  );
}
