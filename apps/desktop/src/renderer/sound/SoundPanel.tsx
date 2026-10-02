/**
 * Sound design (PLAN.md#8.2), docked under the preview: the library (drag onto the timeline),
 * "Generate cues" (Claude, or the deterministic default cues without it), "Render mix" (with
 * stems) and its loudness readout, the level sliders (voice-over + SFX / ambience / music buses)
 * and the music ducking presets, and what the player monitors (full mix with the preview of the
 * latest edits, or the voice-over only).
 */
import { type JSX } from 'react';
import type { Ducking, LibrarySound, SoundAction } from '../../shared/sound-contract.js';
import {
  DUCKING_OFF,
  DUCKING_PRESET_VALUES,
  DUCKING_PRESETS,
  duckingPresetOf,
} from '../../shared/sound-library.js';
import type { StagesState } from '../../shared/stages-contract.js';
import type { MonitorMode } from '../preview/audio-source.js';
import { STAGE_LABELS } from '../stages/pipeline-view.js';
import { SoundLibrary } from './SoundLibrary.js';
import {
  formatDb,
  GAIN_RANGE,
  GAIN_ROWS,
  gainPatch,
  loudnessReadout,
  withDuckingField,
  type DuckingNumberField,
} from './sound-view.js';
import type { MixPreviewControls } from './use-mix-preview.js';
import type { SoundControls } from './use-sound.js';

export interface SoundPanelProps {
  readonly sound: SoundControls;
  readonly preview: MixPreviewControls;
  readonly stages: StagesState | undefined;
  readonly onAdd: (sound: LibrarySound) => void;
  readonly onOpenStems: () => void;
  readonly onClose: () => void;
}

const ACTIONS: readonly {
  readonly action: SoundAction;
  readonly label: string;
  readonly hint: string;
}[] = [
  {
    action: 'generate-cues',
    label: 'Generate cues',
    hint: 'Claude writes cues.json from the storyboard',
  },
  {
    action: 'default-cues',
    label: 'Default cues (no Claude)',
    hint: 'Deterministic cues: hits on anchors, whooshes on transitions, ambience per act',
  },
  { action: 'mix', label: 'Render mix', hint: 'audio/mix.wav at −14 LUFS, true peak ≤ −1 dBTP' },
  {
    action: 'mix-stems',
    label: 'Render mix + stems',
    hint: 'Also vo/sfx/ambience/music stems in out/stems',
  },
];

function busyText(stages: StagesState | undefined): string | null {
  const running = stages?.running;
  if (
    running !== undefined &&
    running !== null &&
    (running.stage === 'sound-cues' || running.stage === 'mix')
  ) {
    const percent = running.percent === null ? '' : ` (${String(Math.round(running.percent))} %)`;
    return `${STAGE_LABELS[running.stage]}: ${running.label ?? 'starting'}${percent}`;
  }
  const queued = stages?.queue.find((stage) => stage === 'sound-cues' || stage === 'mix');
  return queued === undefined ? null : `${STAGE_LABELS[queued]} is queued.`;
}

function MixReadout({
  sound,
  onOpenStems,
}: Pick<SoundPanelProps, 'sound' | 'onOpenStems'>): JSX.Element {
  const mix = sound.state?.mix;
  if (mix === undefined || !mix.exists) {
    return <p className="muted mix-readout">No mix yet: Render mix writes audio/mix.wav.</p>;
  }
  const readout = mix.result === null ? null : loudnessReadout(mix.result);
  const stems = sound.state?.stems ?? [];
  return (
    <div className="mix-readout" data-testid="mix-readout">
      {readout === null ? (
        <span className="muted">audio/mix.wav (no loudness report)</span>
      ) : (
        <>
          <span className={readout.lufsOk ? 'qa-ok' : 'qa-failed'}>
            {readout.lufs} {readout.lufsOk ? '✓' : '✗'}
          </span>
          <span className="muted">{readout.lufsTarget}</span>
          <span className={readout.peakOk ? 'qa-ok' : 'qa-failed'}>
            {readout.peak} {readout.peakOk ? '✓' : '✗'}
          </span>
          <span className="muted">{readout.peakTarget}</span>
        </>
      )}
      {mix.stale && <span className="qa-warning">Cues changed since this render.</span>}
      {stems.length > 0 && (
        <button type="button" className="link-button" onClick={onOpenStems}>
          {stems.length} stems
        </button>
      )}
    </div>
  );
}

function DuckingField(props: {
  readonly ducking: Ducking | null;
  readonly onChange: (ducking: Ducking) => void;
}): JSX.Element {
  const { ducking } = props;
  const current = ducking === null ? null : duckingPresetOf(ducking);
  const base = ducking ?? DUCKING_PRESET_VALUES.medium;
  const number = (
    field: DuckingNumberField,
    label: string,
    min: number,
    max: number,
  ): JSX.Element => (
    <label className="ducking-number">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={field === 'ratio' ? 0.5 : 1}
        value={base[field]}
        disabled={ducking === null}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= min && value <= max) {
            props.onChange(withDuckingField(base, field, value));
          }
        }}
      />
    </label>
  );
  return (
    <fieldset className="sound-ducking" disabled={ducking === null}>
      <legend>Music ducking</legend>
      <div className="segmented" role="group" aria-label="Music ducking amount">
        <button
          type="button"
          aria-pressed={current === 'off'}
          onClick={() => {
            props.onChange(DUCKING_OFF);
          }}
        >
          Off
        </button>
        {DUCKING_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={current === preset}
            onClick={() => {
              props.onChange(DUCKING_PRESET_VALUES[preset]);
            }}
          >
            {preset[0]?.toUpperCase()}
            {preset.slice(1)}
          </button>
        ))}
        {current === 'custom' && <span className="chip">Custom</span>}
      </div>
      {ducking === null ? (
        <p className="muted">No music cue yet: drop music on the timeline.</p>
      ) : (
        <details className="ducking-advanced">
          <summary>Advanced</summary>
          {number('thresholdDb', 'Threshold (dB)', -60, 0)}
          {number('ratio', 'Ratio', 1, 20)}
          {number('attackMs', 'Attack (ms)', 0.01, 2000)}
          {number('releaseMs', 'Release (ms)', 0.01, 9000)}
        </details>
      )}
    </fieldset>
  );
}

function MonitorToggle({ preview }: { readonly preview: MixPreviewControls }): JSX.Element {
  const modes: readonly [MonitorMode, string][] = [
    ['mix', 'Full mix'],
    ['vo', 'Voice-over only'],
  ];
  return (
    <div className="segmented" role="group" aria-label="Listen to">
      {modes.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          aria-pressed={preview.monitor === mode}
          onClick={() => {
            preview.setMonitor(mode);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function previewText(preview: MixPreviewControls): string | null {
  if (preview.busy) return 'Updating the preview mix…';
  if (preview.message !== null) return preview.message;
  const last = preview.last;
  if (last === null) return null;
  const end = last.startS + last.durationS;
  return `Preview mix ${last.startS.toFixed(1)}–${end.toFixed(1)} s updated (${(last.ms / 1000).toFixed(1)} s)`;
}

export function SoundPanel(props: SoundPanelProps): JSX.Element {
  const { sound, preview } = props;
  const state = sound.state;
  const busy = busyText(props.stages);
  const status = previewText(preview);
  return (
    <section className="doc-panel docked sound-panel" aria-label="Sound design">
      <div className="doc-header">
        <h2 className="doc-title">Sound design</h2>
        <MonitorToggle preview={preview} />
        <span className="sound-status muted" role="status">
          {status}
        </span>
        <button type="button" className="small-button" onClick={props.onClose}>
          Back to preview
        </button>
      </div>
      <div className="doc-body sound-body">
        <SoundLibrary
          library={state?.library ?? []}
          preview={sound.preview}
          onAdd={props.onAdd}
          onImport={sound.importFiles}
        />
        <div className="sound-controls">
          <div className="sound-actions" role="group" aria-label="Sound actions">
            {ACTIONS.map((entry) => (
              <button
                key={entry.action}
                type="button"
                className={`small-button${entry.action === 'mix' ? ' primary' : ''}`}
                aria-disabled={busy !== null}
                title={busy ?? entry.hint}
                onClick={() => {
                  if (busy === null) sound.run(entry.action);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {busy !== null && (
            <p className="sound-busy" aria-live="polite">
              {busy}
            </p>
          )}
          {sound.notice !== null && (
            <p className="panel-error" role="alert">
              {sound.notice}
            </p>
          )}
          {state?.cuesError !== null && state?.cuesError !== undefined && (
            <p className="panel-error" role="alert">
              {state.cuesError}
            </p>
          )}
          <MixReadout sound={sound} onOpenStems={props.onOpenStems} />
          <fieldset className="sound-levels">
            <legend>Levels</legend>
            {GAIN_ROWS.map((row) => {
              const value = state?.gains[row.key] ?? 0;
              return (
                <label key={row.key} className="level-row">
                  <span className="level-label">{row.label}</span>
                  <input
                    type="range"
                    min={GAIN_RANGE.min}
                    max={GAIN_RANGE.max}
                    step={GAIN_RANGE.step}
                    value={value}
                    disabled={state === undefined}
                    aria-label={`${row.label} level (dB)`}
                    onChange={(event) => {
                      sound.setMix(gainPatch(row.key, Number(event.target.value)));
                    }}
                  />
                  <output className="mono">{formatDb(value)}</output>
                </label>
              );
            })}
          </fieldset>
          <DuckingField
            ducking={state?.ducking ?? null}
            onChange={(ducking) => {
              sound.setMix({ ducking });
            }}
          />
        </div>
      </div>
    </section>
  );
}
