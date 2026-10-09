/**
 * Home → Channels (PLAN.md#13.16): one card per channel (colour, projects, what waits for you,
 * voice, genre, style) with "New project" and "Edit channel" (Settings → Channels). Home →
 * Shorts is ShortsView.tsx.
 */
import type { JSX } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import { plural } from '../../shared/plural.js';
import { styleLabel } from '../../shared/style-choices.js';
import { ChannelBadge } from '../channels/ChannelBadge.js';
import type { ChannelList } from '../channels/channel-view.js';
import { genreLabel } from '../project/genre-view.js';
import { cardState } from './card-view.js';
import { projectChannelId } from './home-view.js';
import { canGenerateVoice } from '../wizard/wizard-view.js';

export interface ChannelsViewProps {
  readonly channels: ChannelList | undefined;
  readonly loadError: string | undefined;
  readonly projects: readonly HomeProject[];
  readonly busy: boolean;
  readonly onNew: (channelId: string) => void;
  /** Settings → Channels (with this channel selected; undefined = the list). */
  readonly onEdit: (channelId: string | undefined) => void;
}

export function ChannelsView(props: ChannelsViewProps): JSX.Element {
  const { channels, projects } = props;
  return (
    <div className="home-projects">
      <header className="home-heading">
        <h1 className="home-title">Channels</h1>
        <span className="header-spacer" />
        <button
          type="button"
          className="primary"
          onClick={() => {
            props.onEdit(undefined);
          }}
        >
          Add or edit channels…
        </button>
      </header>
      <p className="muted home-intro">
        A channel is one of your YouTube channels: its voice, API key, genre and style of new
        projects. Projects are sorted by channel on the Projects page.
      </p>
      {props.loadError !== undefined && (
        <p className="home-error" role="alert">
          {props.loadError}
        </p>
      )}
      <ul className="channel-cards">
        {(channels?.channels ?? []).map((channel) => {
          const mine = projects.filter(
            (project) => projectChannelId(project, channels) === channel.id,
          );
          const waiting = mine.filter((project) => cardState(project) === 'needs-you').length;
          return (
            <li key={channel.id} className="channel-card">
              <div className="channel-card-head">
                <ChannelBadge channel={channel} />
                <span className="section-title">{channel.name}</span>
                {channel.isDefault && <span className="muted">default</span>}
              </div>
              <p className="channel-card-line">
                {plural(mine.length, 'project')}
                {waiting > 0 && (
                  <span className="card-badge badge-needs-you">{waiting} need you</span>
                )}
              </p>
              <p className="muted channel-card-line">
                {canGenerateVoice(channel) ? 'Voice: ElevenLabs ✓' : 'Voice: you record it'} ·
                Genre: {channel.genrePreset === null ? 'none' : genreLabel(channel.genrePreset)} ·
                Style:{' '}
                {channel.defaultStyle === null
                  ? 'as in Settings'
                  : styleLabel(channel.defaultStyle)}
              </p>
              <div className="channel-card-actions">
                <button
                  type="button"
                  disabled={props.busy}
                  onClick={() => {
                    props.onNew(channel.id);
                  }}
                >
                  New project
                  <span className="visually-hidden"> in {channel.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onEdit(channel.id);
                  }}
                >
                  Edit channel
                  <span className="visually-hidden"> {channel.name}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
