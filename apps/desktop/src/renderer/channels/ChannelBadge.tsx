/** A channel's small square badge (its color and initial) or a plain color dot. */
import type { JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import { channelInitial } from './channel-view.js';

export function ChannelBadge({
  channel,
}: {
  readonly channel: Pick<ChannelView, 'name' | 'avatar' | 'color'>;
}): JSX.Element {
  return (
    <span
      className="channel-badge"
      aria-hidden="true"
      style={channel.color === undefined ? undefined : { background: channel.color }}
    >
      {channelInitial(channel)}
    </span>
  );
}

/** The dot of the recent list and the header; its title names the channel. */
export function ChannelDot({
  channel,
}: {
  readonly channel: Pick<ChannelView, 'name' | 'color'>;
}): JSX.Element {
  return (
    <span
      className="channel-dot"
      role="img"
      aria-label={`Channel: ${channel.name}`}
      title={`Channel: ${channel.name}`}
      style={channel.color === undefined ? undefined : { background: channel.color }}
    />
  );
}
