/**
 * Settings → Channels → one channel (PLAN.md#13.13): name, color, the style and the genre preset
 * (PLAN.md#13.8) new projects of the channel start with, the ElevenLabs voice, the API key,
 * publishing defaults and Delete. Every field saves on its own (like the rest of Settings).
 */
import type { ChannelPatch } from '@reelforge/shared';
import { useId, useState, type JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import { styleLabel, type StyleChoice } from '../../shared/style-choices.js';
import { GenreSelect } from '../project/GenreField.js';
import { CHANNEL_GENRE_HINT } from '../project/genre-view.js';
import {
  APP_DEFAULT_STYLE_LABEL,
  CHANNEL_COLORS,
  checkChannelName,
  DEFAULT_CHANNEL_NOTE,
  publishWith,
  tagsFromText,
  tagsText,
  type PublishChange,
} from './channel-view.js';
import { ChannelKeyRow } from './ChannelKeyRow.js';
import { ChannelVoiceFields } from './ChannelVoiceFields.js';
import { CommitField } from './CommitField.js';
import { useLatestValue } from './use-latest-value.js';
import type { ChannelsController } from './use-channels.js';

export interface ChannelDetailProps {
  readonly channel: ChannelView;
  readonly channels: readonly ChannelView[];
  readonly controller: ChannelsController;
  /** The styles a new project may start with (preview worlds only with the experimental switch). */
  readonly styles: readonly StyleChoice[];
}

function StyleSelect(props: {
  readonly value: string | null;
  readonly styles: readonly StyleChoice[];
  readonly onChange: (style: string | null) => void;
}): JSX.Element {
  const id = useId();
  // A saved style the app does not offer now (a preview world with the switch off) stays listed.
  const unoffered =
    props.value === null || props.styles.some((style) => style.id === props.value)
      ? undefined
      : props.value;
  return (
    <div className="field channel-field">
      <label htmlFor={id}>Style of new projects</label>
      <select
        id={id}
        value={props.value ?? ''}
        onChange={(event) => {
          props.onChange(event.target.value === '' ? null : event.target.value);
        }}
      >
        <option value="">{APP_DEFAULT_STYLE_LABEL}</option>
        {props.styles.map((style) => (
          <option key={style.id} value={style.id}>
            {style.label}
            {style.preview ? ' (preview)' : ''}
          </option>
        ))}
        {unoffered !== undefined && (
          <option value={unoffered}>{styleLabel(unoffered)} (not offered now)</option>
        )}
      </select>
      {unoffered !== undefined && (
        <span className="muted">
          This world is a preview: new projects use it only with Settings → Projects → “Experimental
          worlds (preview)” on.
        </span>
      )}
    </div>
  );
}

export function ChannelDetail(props: ChannelDetailProps): JSX.Element {
  const { channel, controller } = props;
  const [error, setError] = useState<string | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  const patch = async (change: ChannelPatch): Promise<string | undefined> => {
    const outcome = await controller.update(channel.id, change);
    return outcome.ok ? undefined : outcome.message;
  };
  const patchShown = (change: ChannelPatch): void => {
    void patch(change).then(setError);
  };
  const publish = useLatestValue(channel.publishDefaults);
  const savePublish = (change: PublishChange): Promise<string | undefined> =>
    publish.save(
      (current) => publishWith(current, change) ?? undefined,
      (value) => patch({ publishDefaults: value ?? null }),
    );

  return (
    <div className="channel-detail" aria-label={`Channel ${channel.name}`} role="region">
      <h3 className="settings-heading">Channel</h3>
      {channel.isDefault && <p className="muted channel-note">{DEFAULT_CHANNEL_NOTE}</p>}
      <CommitField
        label="Name"
        value={channel.name}
        maxLength={80}
        onCommit={(text) => {
          const check = checkChannelName(text, props.channels, channel.id);
          return check.ok ? patch({ name: check.name }) : Promise.resolve(check.message);
        }}
      />
      <div className="field channel-field">
        <span id={`${channel.id}-color`}>Color</span>
        <div className="channel-colors" role="radiogroup" aria-labelledby={`${channel.id}-color`}>
          {CHANNEL_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              role="radio"
              aria-checked={channel.color?.toLowerCase() === color.value}
              aria-label={color.name}
              title={color.name}
              className="channel-swatch"
              style={{ background: color.value }}
              onClick={() => {
                patchShown({ color: color.value });
              }}
            />
          ))}
        </div>
      </div>
      <StyleSelect
        value={channel.defaultStyle}
        styles={props.styles}
        onChange={(style) => {
          patchShown({ defaultStyle: style });
        }}
      />
      <GenreSelect
        label="Genre of new projects"
        className="field channel-field"
        hint={CHANNEL_GENRE_HINT}
        value={channel.genrePreset}
        onChange={(genre) => {
          patchShown({ genrePreset: genre });
        }}
      />
      {error !== undefined && (
        <p className="channel-error" role="alert">
          {error}
        </p>
      )}

      <h3 className="settings-heading">Voice (ElevenLabs)</h3>
      <p className="muted channel-note">Films are read in English with this voice.</p>
      <ChannelKeyRow
        present={channel.secrets['elevenlabs-api-key']}
        onSet={(value) => controller.setKey(channel.id, value)}
        onRemove={() => controller.removeKey(channel.id)}
        onTest={() => controller.testKey(channel.id)}
      />
      <ChannelVoiceFields voice={channel.voice} onSave={(voice) => patch({ voice })} />

      <h3 className="settings-heading">Publishing defaults</h3>
      <CommitField
        label="Description template"
        value={channel.publishDefaults?.descriptionTemplate ?? ''}
        multiline
        maxLength={5_000}
        hint="The start of every description; the publish kit adds the film’s parts."
        onCommit={(text) => savePublish({ descriptionTemplate: text })}
      />
      <CommitField
        label="Tags"
        value={tagsText(channel.publishDefaults?.tags)}
        placeholder="science, explainer, space"
        hint="Separate tags with commas."
        onCommit={(text) => savePublish({ tags: tagsFromText(text) })}
      />
      <CommitField
        label="Credits style"
        value={channel.publishDefaults?.creditsStyle ?? ''}
        maxLength={64}
        placeholder="e.g. Short list at the end"
        hint="How the credits of photos and music are written."
        onCommit={(text) => savePublish({ creditsStyle: text })}
      />

      <h3 className="settings-heading">Taste</h3>
      <label className="settings-toggle channel-field">
        <input
          type="checkbox"
          checked={channel.tastePerWorld === true}
          onChange={(event) => {
            patchShown({ tastePerWorld: event.target.checked ? true : null });
          }}
        />
        <span>
          Keep a separate profile for each world
          <span className="muted">
            {' '}
            — each world learns and uses its own taste; off = one profile for the whole channel.
          </span>
        </span>
      </label>

      <h3 className="settings-heading">Delete</h3>
      {channel.isDefault ? (
        <p className="muted channel-note">The default channel cannot be deleted.</p>
      ) : confirmDelete ? (
        <div className="channel-confirm" role="group" aria-label="Confirm delete">
          <span>Delete “{channel.name}” and its saved key? This cannot be undone.</span>
          <button
            type="button"
            className="small-button"
            onClick={() => {
              setConfirmDelete(false);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="danger small-button"
            onClick={() => {
              setConfirmDelete(false);
              void controller.remove(channel.id, channel.name).then((outcome) => {
                setDeleteError(outcome.ok ? undefined : outcome.message);
              });
            }}
          >
            Delete channel
          </button>
        </div>
      ) : (
        <div className="channel-actions">
          <button
            type="button"
            className="small-button"
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            Delete channel…
          </button>
        </div>
      )}
      {deleteError !== undefined && (
        <p className="channel-error" role="alert">
          {deleteError}
        </p>
      )}
    </div>
  );
}
