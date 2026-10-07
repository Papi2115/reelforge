/**
 * Settings → Channels (PLAN.md#13.13, ADR-031): the user's channels as a dynamic list on the left
 * (add, move up/down, the default one marked) and the chosen channel's form on the right. A new
 * channel is named first (AddChannelForm), gets the next palette color and is selected.
 */
import { useMemo, useState, type JSX } from 'react';
import { styleChoices } from '../../shared/style-choices.js';
import { ChannelBadge } from './ChannelBadge.js';
import { AddChannelForm } from './AddChannelForm.js';
import { ChannelDetail } from './ChannelDetail.js';
import { moveChannelIds, nextChannelColor } from './channel-view.js';
import type { ChannelsController } from './use-channels.js';

export interface ChannelsPageProps {
  readonly controller: ChannelsController;
  /** Settings → Projects → "Experimental worlds (preview)": offers preview worlds as a style. */
  readonly experimentalWorlds: boolean;
}

export const CHANNELS_INTRO =
  'Each channel has its own voice, API key, style and publishing defaults. New projects start with the settings of their channel.';

export function ChannelsPage({ controller, experimentalWorlds }: ChannelsPageProps): JSX.Element {
  const { list } = controller;
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const styles = useMemo(() => styleChoices(experimentalWorlds), [experimentalWorlds]);

  if (list === undefined) {
    return controller.loadError === undefined ? (
      <p className="muted">Loading…</p>
    ) : (
      <p className="channel-error" role="alert">
        {controller.loadError}
      </p>
    );
  }
  const channels = list.channels;
  const selected =
    channels.find((channel) => channel.id === selectedId) ??
    channels.find((channel) => channel.id === list.defaultChannelId) ??
    channels[0];
  const ids = channels.map((channel) => channel.id);

  const act = (call: () => ReturnType<ChannelsController['create']>): void => {
    setBusy(true);
    setError(undefined);
    void call().then((outcome) => {
      setBusy(false);
      if (!outcome.ok) setError(outcome.message);
      else if (outcome.changedId !== null) setSelectedId(outcome.changedId);
    });
  };
  const move = (delta: -1 | 1): void => {
    const reordered = selected === undefined ? undefined : moveChannelIds(ids, selected.id, delta);
    if (reordered !== undefined) act(() => controller.reorder(reordered));
  };
  const index = selected === undefined ? -1 : ids.indexOf(selected.id);

  return (
    <div className="settings-page channels-page">
      <p className="muted channel-note">{CHANNELS_INTRO}</p>
      <div className="channels-layout">
        <div className="channels-list-panel">
          <ul className="channels-list" role="listbox" aria-label="Channels">
            {channels.map((channel) => (
              <li
                key={channel.id}
                role="option"
                aria-selected={channel.id === selected?.id}
                className="channels-item"
                tabIndex={channel.id === selected?.id ? 0 : -1}
                onClick={() => {
                  setSelectedId(channel.id);
                }}
                onKeyDown={(event) => {
                  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
                  const next = channels[ids.indexOf(channel.id) + step];
                  if (step === 0 || next === undefined) return;
                  event.preventDefault();
                  setSelectedId(next.id);
                  const sibling =
                    step === 1
                      ? event.currentTarget.nextElementSibling
                      : event.currentTarget.previousElementSibling;
                  if (sibling instanceof HTMLElement) sibling.focus();
                }}
              >
                <ChannelBadge channel={channel} />
                <span className="channels-item-name">{channel.name}</span>
                {channel.isDefault && <span className="channels-item-tag">default</span>}
                <span className="channels-item-key muted" title="ElevenLabs API key">
                  {channel.secrets['elevenlabs-api-key'] ? 'key ✓' : 'no key'}
                </span>
              </li>
            ))}
          </ul>
          <div className="channels-list-tools">
            <button
              type="button"
              className="small-button"
              disabled={busy || adding}
              onClick={() => {
                setAdding(true);
              }}
            >
              Add channel
            </button>
            <button
              type="button"
              className="small-button"
              aria-label="Move up"
              title="Move up"
              disabled={busy || index <= 0}
              onClick={() => {
                move(-1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="small-button"
              aria-label="Move down"
              title="Move down"
              disabled={busy || index < 0 || index >= channels.length - 1}
              onClick={() => {
                move(1);
              }}
            >
              ↓
            </button>
          </div>
          {adding && (
            <AddChannelForm
              channels={channels}
              onCancel={() => {
                setAdding(false);
              }}
              onAdd={async (name) => {
                const outcome = await controller.create({
                  name,
                  color: nextChannelColor(channels),
                });
                if (outcome.ok) {
                  setAdding(false);
                  if (outcome.changedId !== null) setSelectedId(outcome.changedId);
                }
                return outcome;
              }}
            />
          )}
          {error !== undefined && (
            <p className="channel-error" role="alert">
              {error}
            </p>
          )}
        </div>
        {selected !== undefined && (
          <ChannelDetail
            key={selected.id}
            channel={selected}
            channels={channels}
            controller={controller}
            styles={styles}
          />
        )}
      </div>
    </div>
  );
}
