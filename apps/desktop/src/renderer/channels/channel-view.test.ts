import { channelVoiceSchema, channelPublishDefaultsSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { ChannelView } from '../../shared/channels-contract.js';
import {
  CHANNEL_COLORS,
  channelDefaultStyle,
  channelErrorText,
  channelInitial,
  channelOf,
  checkChannelName,
  formatVoiceValue,
  initialChannelId,
  moveChannelIds,
  nextChannelColor,
  publishWith,
  secretErrorText,
  showChannels,
  sliderPosition,
  sliderSteps,
  sliderValue,
  tagsFromText,
  tagsText,
  voiceModelChoices,
  voiceSettingValue,
  voiceWith,
  voiceWithoutSettings,
  VOICE_MODELS,
  VOICE_SLIDERS,
  type VoiceSlider,
} from './channel-view.js';

function channel(id: string, name: string, extra: Partial<ChannelView> = {}): ChannelView {
  return {
    id,
    name,
    defaultStyle: null,
    genrePreset: null,
    createdAt: '2026-10-07T00:00:00.000Z',
    isDefault: id === 'default',
    secrets: { 'elevenlabs-api-key': false },
    ...extra,
  };
}

const LIST = {
  defaultChannelId: 'default',
  channels: [
    channel('default', 'Default'),
    channel('voxplain', 'Voxplain', { color: '#4fb3ff', defaultStyle: 'noir-voxel' }),
    channel('crime', 'Crime Desk'),
  ],
};

function slider(key: VoiceSlider['key']): VoiceSlider {
  const found = VOICE_SLIDERS.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`no slider ${key}`);
  return found;
}

describe('channel names and colors', () => {
  it('validates names: empty, too long, duplicate (case-insensitive), own name allowed', () => {
    expect(checkChannelName('  ', LIST.channels, 'crime')).toEqual({
      ok: false,
      message: 'A channel needs a name.',
    });
    expect(checkChannelName('x'.repeat(81), LIST.channels, 'crime').ok).toBe(false);
    expect(checkChannelName(' voxplain ', LIST.channels, 'crime')).toEqual({
      ok: false,
      message: 'Another channel already has this name.',
    });
    expect(checkChannelName('Crime desk', LIST.channels, 'crime')).toEqual({
      ok: true,
      name: 'Crime desk',
    });
  });

  it('gives a new channel the first unused palette color, then repeats the palette', () => {
    expect(nextChannelColor([{}, { color: '#FF8A3D' }])).toBe('#4fb3ff');
    const all = CHANNEL_COLORS.map((color) => ({ color: color.value }));
    expect(nextChannelColor(all)).toBe(CHANNEL_COLORS[0].value);
  });

  it('shows the avatar or the first letter of the name', () => {
    expect(channelInitial({ name: ' żubr tv' })).toBe('Ż');
    expect(channelInitial({ name: 'Voxplain', avatar: 'VX' })).toBe('VX');
    expect(channelInitial({ name: '   ' })).toBe('?');
  });

  it('moves a channel up and down within the list', () => {
    expect(moveChannelIds(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveChannelIds(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveChannelIds(['a', 'b'], 'a', -1)).toBeUndefined();
    expect(moveChannelIds(['a', 'b'], 'b', 1)).toBeUndefined();
    expect(moveChannelIds(['a'], 'x', 1)).toBeUndefined();
  });
});

describe('voice', () => {
  it('maps slider positions to values without float drift and clamps', () => {
    const stability = slider('stability');
    expect(sliderSteps(stability)).toBe(20);
    expect(sliderPosition(stability, 0.75)).toBe(15);
    expect(sliderValue(stability, 15)).toBe(0.75);
    expect(sliderValue(stability, 99)).toBe(1);
    const speed = slider('speed');
    expect(sliderSteps(speed)).toBe(50);
    expect(sliderPosition(speed, 1)).toBe(30);
    expect(sliderValue(speed, 30)).toBe(1);
    expect(sliderValue(speed, -4)).toBe(0.7);
    expect(sliderPosition(speed, 3)).toBe(50);
    for (let position = 0; position <= sliderSteps(speed); position += 1) {
      expect(sliderPosition(speed, sliderValue(speed, position))).toBe(position);
    }
  });

  it('keeps every slider inside the channel schema', () => {
    for (const entry of VOICE_SLIDERS) {
      for (const value of [entry.min, entry.max, entry.defaultValue]) {
        const voice = voiceWith(undefined, { setting: { key: entry.key, value } });
        expect(channelVoiceSchema.safeParse(voice).success).toBe(true);
      }
    }
  });

  it('formats values in plain units and falls back to the documented defaults', () => {
    expect(formatVoiceValue(slider('similarity'), 0.75)).toBe('75 %');
    expect(formatVoiceValue(slider('speed'), 1.05)).toBe('1.05×');
    expect(voiceSettingValue(undefined, slider('stability'))).toBe(0.5);
    expect(voiceSettingValue(undefined, slider('style'))).toBe(0);
    expect(
      voiceSettingValue(
        { provider: 'elevenlabs', settings: { stability: 0.2 } },
        slider('stability'),
      ),
    ).toBe(0.2);
  });

  it('builds the whole voice object on every change', () => {
    const first = voiceWith(undefined, { voiceId: '  abc123 ' });
    expect(first).toEqual({ provider: 'elevenlabs', voiceId: 'abc123' });
    const second = voiceWith(first, { model: 'eleven_v4' });
    const third = voiceWith(second, { setting: { key: 'speed', value: 1.1 } });
    expect(third).toEqual({
      provider: 'elevenlabs',
      voiceId: 'abc123',
      model: 'eleven_v4',
      settings: { speed: 1.1 },
    });
    expect(voiceWith(third, { voiceId: '' })).toEqual({
      provider: 'elevenlabs',
      model: 'eleven_v4',
      settings: { speed: 1.1 },
    });
  });

  it('resets the settings but keeps the voice ID and model', () => {
    expect(
      voiceWithoutSettings({
        provider: 'elevenlabs',
        voiceId: 'v',
        model: 'eleven_v3',
        settings: { style: 0.4 },
      }),
    ).toEqual({ provider: 'elevenlabs', voiceId: 'v', model: 'eleven_v3' });
    expect(voiceWithoutSettings(undefined)).toEqual({ provider: 'elevenlabs' });
  });

  it('lists the known models and keeps an unknown saved one', () => {
    expect(voiceModelChoices(undefined)).toBe(VOICE_MODELS);
    expect(voiceModelChoices('eleven_v3')).toBe(VOICE_MODELS);
    expect(voiceModelChoices('custom_model').at(-1)).toEqual({
      id: 'custom_model',
      label: 'custom_model (saved earlier)',
    });
  });
});

describe('publishing defaults', () => {
  it('parses tags from commas and lines without empties or duplicates', () => {
    expect(tagsFromText('science, Tech,\n, science ,space')).toEqual(['science', 'Tech', 'space']);
    expect(
      tagsFromText(Array.from({ length: 60 }, (_, index) => `t${String(index)}`).join(',')),
    ).toHaveLength(50);
    expect(tagsText(['a', 'b'])).toBe('a, b');
    expect(tagsText(undefined)).toBe('');
  });

  it('merges a change and clears the defaults when nothing is left', () => {
    const first = publishWith(undefined, { tags: ['a'] });
    expect(first).toEqual({ tags: ['a'] });
    const second = publishWith(first ?? undefined, { creditsStyle: ' Short list ' });
    expect(second).toEqual({ tags: ['a'], creditsStyle: 'Short list' });
    expect(channelPublishDefaultsSchema.safeParse(second).success).toBe(true);
    expect(publishWith(second ?? undefined, { tags: [], creditsStyle: '' })).toBeNull();
  });
});

describe('errors in plain words', () => {
  it('names the projects that keep a channel from being deleted', () => {
    expect(
      channelErrorText(
        {
          kind: 'has-projects',
          message: 'channel crime has projects',
          projects: ['C:\\Films\\Heist', '/home/papi/films/Fraud'],
        },
        'Crime Desk',
      ),
    ).toBe(
      '“Crime Desk” still has 2 projects (Heist, Fraud), so it cannot be deleted. Projects cannot move to another channel yet.',
    );
    expect(
      channelErrorText({ kind: 'has-projects', message: '', projects: ['D:/x/One'] }),
    ).toContain('This channel still has 1 project (One)');
  });

  it('has a sentence for every channel and key error', () => {
    expect(channelErrorText({ kind: 'default-channel', message: 'x' })).toContain(
      'cannot be deleted',
    );
    expect(channelErrorText({ kind: 'limit', message: 'x' })).toBe(
      'You can have up to 50 channels.',
    );
    expect(secretErrorText('encryption-unavailable')).toContain('cannot encrypt');
    expect(secretErrorText('corrupt')).toContain('Enter the key again');
  });
});

describe('projects and the New project form', () => {
  it('resolves a project channel, falling back to the default one', () => {
    expect(channelOf(LIST, 'voxplain')?.name).toBe('Voxplain');
    expect(channelOf(LIST, undefined)?.id).toBe('default');
    expect(channelOf(LIST, 'gone')?.id).toBe('default');
    expect(channelOf(undefined, 'voxplain')).toBeUndefined();
  });

  it('shows channels only when there is more than one', () => {
    expect(showChannels(LIST)).toBe(true);
    expect(showChannels({ defaultChannelId: 'default', channels: [channel('default', 'D')] })).toBe(
      false,
    );
    expect(showChannels(undefined)).toBe(false);
  });

  it('starts the form in the channel of the most recent project', () => {
    expect(initialChannelId(LIST, [{ channelId: 'crime' }, { channelId: 'voxplain' }])).toBe(
      'crime',
    );
    expect(initialChannelId(LIST, [{}])).toBe('default');
    expect(initialChannelId(LIST, [{ channelId: 'deleted' }])).toBe('default');
    expect(initialChannelId(LIST, [])).toBe('default');
  });

  it('prefers the channel style over the settings style', () => {
    expect(channelDefaultStyle(LIST.channels[1], 'soft-480')).toBe('noir-voxel');
    expect(channelDefaultStyle(LIST.channels[2], 'soft-480')).toBe('soft-480');
    expect(channelDefaultStyle(undefined, undefined)).toBeUndefined();
  });
});
