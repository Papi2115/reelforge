/**
 * Controls of the Sound panel (PLAN.md#8.2, #11.2): what the player monitors (the full mix with the
 * latest edits, or the voice alone) and the music ducking presets with their advanced numbers.
 */
import type { JSX } from 'react';
import type { Ducking } from '../../shared/sound-contract.js';
import {
  DUCKING_OFF,
  DUCKING_PRESET_VALUES,
  DUCKING_PRESETS,
  duckingPresetOf,
} from '../../shared/sound-library.js';
import type { MonitorMode } from '../preview/audio-source.js';
import { withDuckingField, type DuckingNumberField } from './sound-view.js';
import type { MixPreviewControls } from './use-mix-preview.js';

export function DuckingField(props: {
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
      <legend className="visually-hidden">Music ducking</legend>
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

export function MonitorToggle({ preview }: { readonly preview: MixPreviewControls }): JSX.Element {
  const modes: readonly [MonitorMode, string, string][] = [
    [
      'mix',
      'Full mix',
      'Hear the mixed sound: your voice, effects, ambience and music, with your latest edits',
    ],
    ['vo', 'Voice only', 'Hear only your cleaned-up voiceover (no effects or music)'],
  ];
  return (
    <div className="segmented sound-listen" role="group" aria-label="Listen to">
      <span className="sound-listen-label" aria-hidden="true">
        Listen:
      </span>
      {modes.map(([mode, label, hint]) => (
        <button
          key={mode}
          type="button"
          title={hint}
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
