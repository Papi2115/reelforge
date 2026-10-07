/**
 * Project settings → "Channel" (PLAN.md#13.13): the channel the project belongs to, read-only
 * (moving a project to another channel comes later).
 */
import { useId, type JSX } from 'react';
import type { ChannelView } from '../../shared/channels-contract.js';
import { SettingRow } from '../project/SettingRow.js';
import { ChannelBadge } from './ChannelBadge.js';
import { PROJECT_CHANNEL_NOTE } from './channel-view.js';

export function ChannelRow({ channel }: { readonly channel: ChannelView }): JSX.Element {
  const headingId = useId();
  return (
    <section className="project-settings-section" aria-labelledby={headingId}>
      <h3 className="settings-heading" id={headingId}>
        Channel
      </h3>
      <SettingRow title="Channel" note={PROJECT_CHANNEL_NOTE}>
        {() => (
          <p className="option-readonly project-channel-row">
            <ChannelBadge channel={channel} />
            <strong>{channel.name}</strong>
            {channel.isDefault && <span className="muted"> (default channel)</span>}
          </p>
        )}
      </SettingRow>
    </section>
  );
}
