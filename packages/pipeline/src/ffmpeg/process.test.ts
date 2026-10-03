import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runProcess } from './process.js';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge process '));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('runProcess', () => {
  it('resolves (never rejects) when the file cannot be run at all', async () => {
    // Windows throws `spawn UNKNOWN` synchronously for a non-executable .exe; POSIX emits EACCES.
    const fake = path.join(dir, 'whisper-cli.exe');
    await writeFile(fake, 'not a program');
    const result = await runProcess(fake, ['--version']);
    expect(result).toMatchObject({ ok: false, error: { kind: 'spawn-failed', command: fake } });
  });
});
