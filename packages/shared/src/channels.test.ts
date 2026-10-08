import { describe, expect, it } from 'vitest';
import {
  applyChannelPatch,
  channelForProject,
  channelIdFromName,
  channelInputSchema,
  channelPatchSchema,
  channelSchema,
  channelSecretsFileSchema,
  channelsFileSchema,
  channelTasteProfileFile,
  DEFAULT_CHANNEL_ID,
  defaultChannelsFile,
  type Channel,
  type ChannelsFile,
} from './channels.js';
import { projectFileSchema } from './project.js';
import { recentProjectsFileSchema } from './recent-projects.js';

const NOW = new Date('2026-10-07T10:00:00.000Z');

function channel(id: string, extra: Partial<Channel> = {}): Channel {
  return channelSchema.parse({ id, name: id, createdAt: NOW.toISOString(), ...extra });
}

function file(channels: Channel[], defaultChannelId = channels[0]?.id ?? 'x'): ChannelsFile {
  return channelsFileSchema.parse({ version: 1, defaultChannelId, channels });
}

describe('channelsFileSchema', () => {
  it('round-trips a full channel through JSON', () => {
    const full = channel('voxplain', {
      name: 'Voxplain',
      color: '#ff8800',
      avatar: 'V',
      defaultStyle: 'sketchbook',
      genrePreset: 'tech',
      voice: {
        provider: 'elevenlabs',
        voiceId: 'abc123',
        model: 'multilingual',
        settings: { stability: 0.5, similarity: 0.75, style: 0, speed: 1 },
      },
      publishDefaults: { descriptionTemplate: '{summary}', tags: ['tech'], creditsStyle: 'short' },
      tasteProfile: 'voxplain',
      tastePerWorld: true,
      projectsDir: 'C:\\Users\\x\\Videos\\Voxplain',
      notes: 'main channel',
    });
    const data = file([channel(DEFAULT_CHANNEL_ID), full], DEFAULT_CHANNEL_ID);
    expect(channelsFileSchema.parse(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('fills defaults for a minimal channel and has no secret fields', () => {
    const minimal = channel('a');
    expect(minimal).toEqual({
      id: 'a',
      name: 'a',
      createdAt: NOW.toISOString(),
      defaultStyle: null,
      genrePreset: null,
    });
    expect(Object.keys(channelSchema.shape)).not.toContain('apiKey');
    expect(Object.keys(channelSchema.shape).some((key) => /key|secret|token/i.test(key))).toBe(
      false,
    );
  });

  it('refuses duplicate ids, a missing default channel and an empty list', () => {
    const base = { version: 1 };
    expect(
      channelsFileSchema.safeParse({
        ...base,
        defaultChannelId: 'a',
        channels: [channel('a'), channel('a')],
      }).success,
    ).toBe(false);
    expect(
      channelsFileSchema.safeParse({ ...base, defaultChannelId: 'b', channels: [channel('a')] })
        .success,
    ).toBe(false);
    expect(
      channelsFileSchema.safeParse({ ...base, defaultChannelId: 'a', channels: [] }).success,
    ).toBe(false);
  });

  it('refuses unknown keys in create input and patches (no secrets through them)', () => {
    expect(channelInputSchema.safeParse({ name: 'A', apiKey: 'sk-1' }).success).toBe(false);
    expect(channelInputSchema.safeParse({ name: 'A', id: 'a' }).success).toBe(false);
    expect(channelPatchSchema.safeParse({ apiKey: 'sk-1' }).success).toBe(false);
    expect(channelInputSchema.parse({ name: '  Voxplain  ' }).name).toBe('Voxplain');
  });

  it('the default file has one Default channel', () => {
    expect(defaultChannelsFile(NOW)).toEqual({
      version: 1,
      defaultChannelId: 'default',
      channels: [
        {
          id: 'default',
          name: 'Default',
          createdAt: NOW.toISOString(),
          defaultStyle: null,
          genrePreset: null,
        },
      ],
    });
  });
});

describe('applyChannelPatch', () => {
  it('sets, clears (null) and keeps fields; nullable fields become null', () => {
    const before = channel('a', { color: '#000000', notes: 'n', defaultStyle: 'sketchbook' });
    const after = applyChannelPatch(before, {
      name: 'B',
      color: null,
      defaultStyle: null,
      voice: { provider: 'elevenlabs', voiceId: 'v' },
    });
    expect(after).toEqual({
      id: 'a',
      name: 'B',
      createdAt: NOW.toISOString(),
      notes: 'n',
      defaultStyle: null,
      genrePreset: null,
      voice: { provider: 'elevenlabs', voiceId: 'v' },
    });
  });
});

describe('channelIdFromName', () => {
  it('slugs names (Polish letters too) and keeps ids unique', () => {
    expect(channelIdFromName('Voxplain', new Set())).toBe('voxplain');
    expect(channelIdFromName('Łódź Śledztwa!', new Set())).toBe('lodz-sledztwa');
    expect(channelIdFromName('Voxplain', new Set(['voxplain', 'voxplain-2']))).toBe('voxplain-3');
    expect(channelIdFromName('日本', new Set())).toBe('channel');
    expect(channelIdFromName('x'.repeat(200), new Set()).length).toBeLessThanOrEqual(48);
  });
});

describe('channelForProject', () => {
  const channels = file([channel('default'), channel('crime')], 'default');

  it('absent channelId = default; unknown = default (missing); known = explicit', () => {
    expect(channelForProject(channels, {})).toMatchObject({
      channel: { id: 'default' },
      assignment: 'default',
    });
    expect(channelForProject(channels, { channelId: 'gone' })).toMatchObject({
      channel: { id: 'default' },
      assignment: 'missing',
    });
    expect(channelForProject(channels, { channelId: 'crime' })).toMatchObject({
      channel: { id: 'crime' },
      assignment: 'explicit',
    });
  });
});

describe('channelTasteProfileFile', () => {
  it('keeps taste.json without a profile, per channel and per world otherwise', () => {
    expect(channelTasteProfileFile({})).toBe('taste.json');
    expect(channelTasteProfileFile({ tasteProfile: 'crime' }, 'sketchbook')).toBe(
      'taste-crime.json',
    );
    expect(
      channelTasteProfileFile({ tasteProfile: 'crime', tastePerWorld: true }, 'sketchbook'),
    ).toBe('taste-crime--sketchbook.json');
    expect(() =>
      channelTasteProfileFile({ tasteProfile: 'crime', tastePerWorld: true }, '../x'),
    ).toThrow();
    // A channel without its own profile (the default one) splits by world next to taste.json.
    expect(channelTasteProfileFile({ tastePerWorld: true }, 'sketchbook')).toBe(
      'taste--sketchbook.json',
    );
    expect(channelTasteProfileFile({ tastePerWorld: true })).toBe('taste.json');
    expect(channelTasteProfileFile({ tasteProfile: 'crime', tastePerWorld: false }, 'x')).toBe(
      'taste-crime.json',
    );
  });
});

describe('channel ids in other files', () => {
  const project = {
    version: 1,
    title: 'T',
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 1,
  };

  it('project.json: channelId is optional and validated', () => {
    expect(projectFileSchema.parse(project)).not.toHaveProperty('channelId');
    expect(projectFileSchema.parse({ ...project, channelId: 'crime' }).channelId).toBe('crime');
    expect(projectFileSchema.safeParse({ ...project, channelId: '../x' }).success).toBe(false);
  });

  it('recent projects keep an optional channelId', () => {
    const entry = { dir: 'C:\\a', title: 'A', openedAt: NOW.toISOString() };
    expect(
      recentProjectsFileSchema.parse({ version: 1, projects: [{ ...entry, channelId: 'crime' }] })
        .projects[0]?.channelId,
    ).toBe('crime');
    expect(recentProjectsFileSchema.parse({ version: 1, projects: [entry] }).projects[0]).toEqual(
      entry,
    );
  });
});

describe('channelSecretsFileSchema', () => {
  it('accepts base64 ciphertext per channel and known secret names only', () => {
    expect(
      channelSecretsFileSchema.safeParse({
        version: 1,
        secrets: { crime: { 'elevenlabs-api-key': 'AAEC' } },
      }).success,
    ).toBe(true);
    expect(
      channelSecretsFileSchema.safeParse({
        version: 1,
        secrets: { crime: { 'other-key': 'AAEC' } },
      }).success,
    ).toBe(false);
    expect(
      channelSecretsFileSchema.safeParse({
        version: 1,
        secrets: { crime: { 'elevenlabs-api-key': 'not base64!' } },
      }).success,
    ).toBe(false);
  });
});
