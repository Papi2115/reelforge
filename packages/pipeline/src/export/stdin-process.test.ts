import { describe, expect, it } from 'vitest';
import { spawnStdinProcess } from './stdin-process.js';

/** `node -e <script>`: a portable stand-in for ffmpeg reading frames from stdin. */
const node = (script: string, signal?: AbortSignal) =>
  spawnStdinProcess(process.execPath, ['-e', script], signal);

const CONSUME_AND_EXIT = `
let bytes = 0;
process.stdin.on('data', (chunk) => { bytes += chunk.length; });
process.stdin.on('end', () => process.exit(bytes === 3 * 1024 * 1024 ? 0 : 5));
`;

describe('spawnStdinProcess', () => {
  it('streams chunks with back-pressure and reports a clean exit', async () => {
    const child = node(CONSUME_AND_EXIT);
    for (let index = 0; index < 3; index += 1) {
      expect(await child.write(new Uint8Array(1024 * 1024))).toEqual({
        ok: true,
        value: undefined,
      });
    }
    expect(await child.finish()).toEqual({ ok: true, value: undefined });
  });

  it('reports a non-zero exit with the stderr tail', async () => {
    const child = node("process.stderr.write('boom: bad input\\n'); process.exit(3);");
    const finished = await child.finish();
    expect(finished.ok).toBe(false);
    if (finished.ok) return;
    expect(finished.error).toMatchObject({ kind: 'exit-code', code: 3 });
    expect(finished.error.message).toContain('boom: bad input');
  });

  it('fails writes once the process died', async () => {
    const child = node('process.exit(4);');
    let result = await child.write(new Uint8Array(16));
    // The first write may land before the exit is noticed; keep writing until it fails.
    for (let attempt = 0; attempt < 200 && result.ok; attempt += 1) {
      result = await child.write(new Uint8Array(1024 * 1024));
    }
    expect(!result.ok && result.error.kind).toBe('exit-code');
  });

  it('kills the process tree on abort and reports cancellation', async () => {
    const controller = new AbortController();
    const child = node(
      'process.stdin.resume(); setInterval(() => undefined, 1000);',
      controller.signal,
    );
    expect((await child.write(new Uint8Array(1024))).ok).toBe(true);
    controller.abort();
    const finished = await child.finish();
    expect(!finished.ok && finished.error.kind).toBe('cancelled');
    const late = await child.write(new Uint8Array(1));
    expect(!late.ok && late.error.kind).toBe('cancelled');
  });

  it('reports a missing binary as spawn-failed', async () => {
    const child = spawnStdinProcess('reelforge-no-such-binary-xyz', []);
    const finished = await child.finish();
    expect(!finished.ok && finished.error.kind).toBe('spawn-failed');
  });
});
