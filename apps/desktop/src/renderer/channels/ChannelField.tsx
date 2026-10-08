/**
 * New project form → "Channel" (PLAN.md#13.13): which channel the project belongs to. Shown once
 * there is more than one channel; picking one preselects its style.
 */
import { useId, type JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';

export const CHANNEL_FIELD_HINT = 'The project starts with this channel’s style and voice.';

export interface ChannelFieldProps {
  readonly channels: readonly ChannelView[];
  readonly value: string;
  readonly onChange: (channelId: string) => void;
  readonly disabled?: boolean;
}

export function ChannelField({
  channels,
  value,
  onChange,
  disabled,
}: ChannelFieldProps): JSX.Element {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Channel</label>
      <select
        id={id}
        value={value}
        aria-describedby={`${id}-hint`}
        disabled={disabled === true}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>
      <span className="muted" id={`${id}-hint`}>
        {CHANNEL_FIELD_HINT}
      </span>
    </div>
  );
}
