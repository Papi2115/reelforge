/**
 * Voice test hook (unpackaged app + REELFORGE_TEST_HOOKS=1 only): REELFORGE_TEST_ELEVENLABS_URL
 * points the ElevenLabs client at a local fake server (`fake-elevenlabs.ts` of the pipeline), so
 * smoke tests never reach the real API. Anything else (packaged app, hooks off, not a loopback
 * http URL) is ignored: the real API is used.
 */
export const TEST_ELEVENLABS_URL_ENV = 'REELFORGE_TEST_ELEVENLABS_URL';

const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d{1,5}$/;

export function elevenLabsTestUrl(
  env: Readonly<Record<string, string | undefined>>,
  hooksOn: boolean,
): string | undefined {
  const url = env[TEST_ELEVENLABS_URL_ENV];
  if (!hooksOn || url === undefined) return undefined;
  return LOOPBACK.test(url) ? url : undefined;
}
