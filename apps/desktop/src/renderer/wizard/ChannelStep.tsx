/**
 * New project wizard → step 2 "Channel and genre" (PLAN.md#13.16): which channel the film belongs
 * to (or a new one typed here: it is made when the project is created, no key needed) and the
 * genre (the channel's preselected; it preselects the style and the pace).
 */
import { useId, type JSX } from 'react';
import type { GenrePresetResolution } from '@reelforge/shared';
import type { ChannelView } from '../../shared/channels-contract.js';
import { MAX_CHANNEL_NAME_LENGTH } from '../channels/channel-view.js';
import { GenreField } from '../project/GenreField.js';
import type { TouchedFields } from '../project/genre-view.js';
import type { ChannelChoice } from './wizard-view.js';

/** The select's value of "New channel…" (channel ids are kebab-case: never this). */
const NEW_CHANNEL = '__new_channel__';

export const CHANNEL_FIELD_HINT =
  'The project starts with this channel’s genre, style and voice. Projects are sorted by channel.';

export const NEW_CHANNEL_HINT =
  'Made when you create the project. Add its voice and API key later in Settings → Channels.';

export interface ChannelStepProps {
  readonly channels: readonly ChannelView[] | undefined;
  readonly channelsError: string | undefined;
  readonly choice: ChannelChoice | undefined;
  readonly onChoice: (choice: ChannelChoice) => void;
  readonly genre: string | null;
  readonly resolution: GenrePresetResolution | undefined;
  readonly touched: TouchedFields;
  readonly experimentalWorlds: boolean;
  readonly onGenre: (genre: string | null) => void;
  readonly disabled: boolean;
}

export function ChannelStep(props: ChannelStepProps): JSX.Element {
  const id = useId();
  const { choice } = props;
  return (
    <div className="wizard-fields">
      {props.channels === undefined ? (
        <p className="muted">
          {props.channelsError ?? 'Loading your channels…'} The project goes to the default channel.
        </p>
      ) : (
        <div className="field wizard-field-wide">
          <label htmlFor={id}>Channel</label>
          <select
            id={id}
            value={choice?.kind === 'existing' ? choice.id : NEW_CHANNEL}
            aria-describedby={`${id}-hint`}
            disabled={props.disabled}
            onChange={(event) => {
              const value = event.target.value;
              props.onChoice(
                value === NEW_CHANNEL ? { kind: 'new', name: '' } : { kind: 'existing', id: value },
              );
            }}
          >
            {props.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
            <option value={NEW_CHANNEL}>New channel…</option>
          </select>
          <span className="muted" id={`${id}-hint`}>
            {CHANNEL_FIELD_HINT}
          </span>
        </div>
      )}
      {choice?.kind === 'new' && (
        <label className="field wizard-field-wide">
          <span>New channel name</span>
          <input
            value={choice.name}
            maxLength={MAX_CHANNEL_NAME_LENGTH}
            placeholder="Voxplain"
            autoFocus
            disabled={props.disabled}
            onChange={(event) => {
              props.onChoice({ kind: 'new', name: event.target.value });
            }}
          />
          <span className="muted">{NEW_CHANNEL_HINT}</span>
        </label>
      )}
      <div className="wizard-field-wide">
        <GenreField
          value={props.genre}
          resolution={props.resolution}
          touched={props.touched}
          experimentalWorlds={props.experimentalWorlds}
          onChange={props.onGenre}
          disabled={props.disabled}
        />
      </div>
    </div>
  );
}
