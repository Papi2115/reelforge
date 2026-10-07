/**
 * Settings → Channels → Voice (PLAN.md#13.13): the ElevenLabs voice ID, the model and the four
 * voice settings as sliders with plain labels (ElevenLabs' defaults until changed). A slider saves
 * when it is let go; the whole voice object is saved each time (patches replace it).
 */
import type { ChannelVoice } from '@reelforge/shared';
import { useEffect, useId, useRef, useState, type JSX } from 'react';
import {
  DEFAULT_VOICE_MODEL,
  formatVoiceValue,
  sliderPosition,
  sliderSteps,
  sliderValue,
  voiceModelChoices,
  voiceSettingValue,
  voiceWith,
  voiceWithoutSettings,
  VOICE_SLIDERS,
  type VoiceChange,
  type VoiceSlider,
} from './channel-view.js';
import { CommitField } from './CommitField.js';
import { pendingValue, showsSavedValue, valueToSend } from './slider-sync.js';
import { useLatestValue } from './use-latest-value.js';

export interface ChannelVoiceFieldsProps {
  readonly voice: ChannelVoice | undefined;
  /** Saves the whole voice; answers with an error sentence or undefined. */
  readonly onSave: (voice: ChannelVoice) => Promise<string | undefined>;
}

function VoiceSliderRow(props: {
  readonly slider: VoiceSlider;
  readonly saved: number;
  readonly onCommit: (value: number) => Promise<string | undefined>;
}): JSX.Element {
  const { slider, saved, onCommit } = props;
  const id = useId();
  const [position, setPosition] = useState(sliderPosition(slider, saved));
  // The value sent last and an unsent move: answers to earlier saves (arrow keys in a row) must
  // not move the knob back (slider-sync.ts).
  const sent = useRef<number | undefined>(undefined);
  const moved = useRef(false);
  useEffect(() => {
    if (!showsSavedValue({ moved: moved.current, sent: sent.current }, saved)) return;
    sent.current = undefined;
    setPosition(sliderPosition(slider, saved));
  }, [slider, saved]);
  const value = sliderValue(slider, position);
  const commit = (): void => {
    // The answer to the value sent last may have come while the knob was moving.
    sent.current = pendingValue(sent.current, saved);
    const sync = { moved: moved.current, sent: sent.current };
    moved.current = false;
    if (valueToSend(sync, value, saved) === undefined) return;
    sent.current = value;
    void onCommit(value).then((message) => {
      if (message === undefined || sent.current !== value) return;
      sent.current = undefined;
      setPosition(sliderPosition(slider, saved));
    });
  };
  return (
    <div className="channel-slider">
      <label htmlFor={id}>{slider.label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={sliderSteps(slider)}
        step={1}
        value={position}
        aria-valuetext={formatVoiceValue(slider, value)}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          moved.current = true;
          setPosition(Number(event.target.value));
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span className="mono channel-slider-value">{formatVoiceValue(slider, value)}</span>
      <span className="muted channel-slider-hint" id={`${id}-hint`}>
        {slider.hint}
      </span>
    </div>
  );
}

export function ChannelVoiceFields({ voice, onSave }: ChannelVoiceFieldsProps): JSX.Element {
  const modelId = useId();
  const [error, setError] = useState<string | undefined>(undefined);
  const latest = useLatestValue(voice);
  const save = (change: VoiceChange): Promise<string | undefined> =>
    latest
      .save((current) => voiceWith(current, change), onSave)
      .then((message) => {
        setError(message);
        return message;
      });
  const model = voice?.model ?? DEFAULT_VOICE_MODEL;
  const customised = voice?.settings !== undefined && Object.keys(voice.settings).length > 0;
  return (
    <>
      <CommitField
        label="Voice ID"
        value={voice?.voiceId ?? ''}
        mono
        maxLength={128}
        placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
        hint="From ElevenLabs: Voices → your voice → Copy voice ID."
        onCommit={(text) => save({ voiceId: text })}
      />
      <div className="field channel-field">
        <label htmlFor={modelId}>Model</label>
        <select
          id={modelId}
          value={model}
          onChange={(event) => {
            void save({ model: event.target.value });
          }}
        >
          {voiceModelChoices(voice?.model).map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
      <div className="channel-sliders" role="group" aria-label="Voice settings">
        {VOICE_SLIDERS.map((slider) => (
          <VoiceSliderRow
            key={slider.key}
            slider={slider}
            saved={voiceSettingValue(voice, slider)}
            onCommit={(value) => save({ setting: { key: slider.key, value } })}
          />
        ))}
      </div>
      <div className="channel-actions">
        <button
          type="button"
          className="small-button"
          disabled={!customised}
          onClick={() => {
            void latest.save(voiceWithoutSettings, onSave).then(setError);
          }}
        >
          Reset voice settings
        </button>
      </div>
      {error !== undefined && (
        <p className="channel-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
