import { describe, expect, it } from 'vitest';
import { installFailure } from './install-failure.js';

const ROOT = String.raw`C:\Users\Papi\AppData\Local\ReelForge\whisper`;
const download = (code: string | undefined, status: number | null = null) =>
  ({ kind: 'download-failed', message: 'fetch failed', url: 'https://x', status, code }) as const;

describe('installFailure', () => {
  it('explains offline, HTTP errors and disk full', () => {
    expect(installFailure(download('ENOTFOUND'), ROOT).message).toMatch(/internet connection/);
    expect(installFailure(download(undefined), ROOT).message).toMatch(/internet connection/);
    expect(installFailure(download(undefined, 503), ROOT).message).toBe(
      'The download server answered HTTP 503. Try again later.',
    );
    const full = installFailure(download('ENOSPC'), ROOT);
    expect(full.message).toContain('Not enough free disk space');
    expect(full.message).toContain(ROOT);
    expect(full.detail).toBe('fetch failed');
  });

  it('blames antivirus software for refused or vanished files', () => {
    for (const error of [
      { kind: 'io', message: 'EPERM: operation not permitted, rename', path: ROOT, code: 'EPERM' },
      {
        kind: 'extract-failed',
        message: 'whisper-cli is missing',
        path: ROOT,
        code: 'CLI_MISSING',
      },
    ] as const) {
      const failure = installFailure(error, ROOT);
      expect(failure.message).toMatch(/antivirus/);
      expect(failure.detail).toContain(ROOT);
    }
  });

  it('covers checksum mismatches, broken archives and cancel', () => {
    expect(
      installFailure(
        { kind: 'checksum-mismatch', message: 'x', url: 'u', expected: 'a', actual: 'b' },
        ROOT,
      ).message,
    ).toMatch(/checksum/);
    expect(
      installFailure({ kind: 'extract-failed', message: 'bad zip', path: 'z' }, ROOT).message,
    ).toMatch(/could not be unpacked/);
    expect(installFailure({ kind: 'cancelled', message: 'c' }, ROOT).message).toBe(
      'Download cancelled.',
    );
  });
});
