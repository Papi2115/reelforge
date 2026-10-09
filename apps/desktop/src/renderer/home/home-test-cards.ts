/** Test cards for the Home view-model tests. */
import {
  HOME_STEPS,
  type HomeProject,
  type HomeStep,
  type HomeStepState,
} from '../../shared/home-contract.js';
import type { ChannelView } from '../../shared/channels-contract.js';
import type { ChannelList } from '../channels/channel-view.js';

export const NOW = Date.parse('2026-10-09T12:00:00.000Z');

export function steps(states: Partial<Record<HomeStep, HomeStepState>> = {}): HomeProject['steps'] {
  return HOME_STEPS.map((step) => ({ step, state: states[step] ?? 'todo' }));
}

export function card(title: string, extra: Partial<HomeProject> = {}): HomeProject {
  return {
    dir: `C:\\Films\\${title}`,
    title,
    exists: true,
    problem: null,
    channelId: null,
    style: 'voxel-pixel-crisp640',
    genrePreset: null,
    kind: 'film',
    parentDir: null,
    parentTitle: null,
    short: null,
    hasScript: false,
    steps: steps(),
    durationS: null,
    updatedAt: '2026-10-09T10:00:00.000Z',
    openedAt: null,
    thumbnail: null,
    fromLine: false,
    ...extra,
  };
}

function channel(id: string, name: string, extra: Partial<ChannelView> = {}): ChannelView {
  return {
    id,
    name,
    color: '#ff8a3d',
    defaultStyle: null,
    genrePreset: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    isDefault: id === 'default',
    secrets: { 'elevenlabs-api-key': false },
    ...extra,
  };
}

export const CHANNELS: ChannelList = {
  defaultChannelId: 'default',
  channels: [
    channel('default', 'Default'),
    channel('voxplain', 'Voxplain', {
      voice: { provider: 'elevenlabs', voiceId: 'v1' },
      secrets: { 'elevenlabs-api-key': true },
    }),
    channel('crime', 'Crime'),
  ],
};

export function channelById(id: string): ChannelView {
  const found = CHANNELS.channels.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no channel ${id}`);
  return found;
}
