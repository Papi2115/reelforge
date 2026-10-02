import { describe, expect, it } from 'vitest';
import { MIC_ARM_MS, MicPermissionGate, type MicRequest } from './mic-permission.js';
import { APP_ORIGIN } from './navigation-policy.js';

const AUDIO: MicRequest = {
  permission: 'media',
  mediaTypes: ['audio'],
  requestingUrl: `${APP_ORIGIN}/index.html`,
  isMainFrame: true,
};

function gate(): { gate: MicPermissionGate; clock: { t: number } } {
  const clock = { t: 1_000 };
  return { gate: new MicPermissionGate(APP_ORIGIN, () => clock.t), clock };
}

describe('microphone permission', () => {
  it('denies everything until the user clicks Record', () => {
    const { gate: mic } = gate();
    expect(mic.request(AUDIO)).toBe(false);
    expect(
      mic.check({ permission: 'media', mediaType: 'audio', requestingOrigin: APP_ORIGIN }),
    ).toBe(false);
  });

  it('allows one audio-only request of the app origin right after the click', () => {
    const { gate: mic } = gate();
    mic.arm();
    expect(mic.request(AUDIO)).toBe(true);
    // The grant is used up: a second request needs another click.
    expect(mic.request(AUDIO)).toBe(false);
    expect(
      mic.check({ permission: 'media', mediaType: 'audio', requestingOrigin: APP_ORIGIN }),
    ).toBe(true);
    expect(
      mic.check({ permission: 'media', mediaType: 'video', requestingOrigin: APP_ORIGIN }),
    ).toBe(false);
  });

  it('refuses the camera, other permissions, other origins, subframes and stale clicks', () => {
    const { gate: mic, clock } = gate();
    const refused: MicRequest[] = [
      { ...AUDIO, mediaTypes: ['audio', 'video'] },
      { ...AUDIO, mediaTypes: ['video'] },
      { ...AUDIO, mediaTypes: [] },
      { ...AUDIO, permission: 'geolocation' },
      { ...AUDIO, permission: 'display-capture' },
      { ...AUDIO, requestingUrl: 'https://example.com/' },
      { ...AUDIO, requestingUrl: 'http://127.0.0.1:5173/' },
      { ...AUDIO, isMainFrame: false },
    ];
    for (const request of refused) {
      mic.arm();
      expect(mic.request(request)).toBe(false);
    }
    mic.arm();
    clock.t += MIC_ARM_MS + 1;
    expect(mic.request(AUDIO)).toBe(false);
    expect(
      mic.check({ permission: 'media', mediaType: 'audio', requestingOrigin: 'https://evil.test' }),
    ).toBe(false);
  });
});
