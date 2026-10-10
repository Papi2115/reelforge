import { mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileAtomicIfChanged } from './atomic-write.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge-atomic-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function codedError(code: string): Error {
  return Object.assign(new Error(`${code}: simulated`), { code });
}

/** Windows: opening the target while a rename replaces it fails briefly (ENOENT/EPERM/EBUSY). */
const REPLACING_CODES = new Set(['ENOENT', 'EPERM', 'EBUSY', 'EACCES']);

/** The pause of a reader between two reads (not a wait for a state: nothing is awaited here). */
const readerGap = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 2);
  });

/** The file's content, or undefined when it was being replaced at that instant. */
async function readWhenOpenable(file: string): Promise<Buffer | undefined> {
  try {
    return await readFile(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    if (REPLACING_CODES.has(code)) return undefined;
    throw error;
  }
}

/** A large payload, so a non-atomic write would be observable as a truncated file. */
function payload(fill: string): Buffer {
  return Buffer.alloc(2 * 1024 * 1024, fill);
}

describe('writeFileAtomicIfChanged', () => {
  it('writes a new file, then skips the write when the content is unchanged', async () => {
    const file = path.join(dir, 'harness.js');
    expect(await writeFileAtomicIfChanged(file, 'one')).toBe('written');
    const before = await stat(file);
    expect(await writeFileAtomicIfChanged(file, 'one')).toBe('unchanged');
    expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
    expect(await writeFileAtomicIfChanged(file, 'two')).toBe('written');
    expect(await readFile(file, 'utf8')).toBe('two');
    expect(await readdir(dir)).toEqual(['harness.js']);
  });

  it('concurrent writers never expose a truncated file to a reader and leave no temp files', async () => {
    const file = path.join(dir, 'harness.js');
    const versions = [payload('a'), payload('b')];
    await writeFile(file, versions[0] ?? '');
    const run = { writing: true };
    const seen = new Set<string>();
    const reader = (async () => {
      while (run.writing) {
        const content = await readWhenOpenable(file);
        if (content !== undefined) {
          const match = versions.findIndex((version) => version.equals(content));
          expect(match, `a read saw ${String(content.length)} bytes of a partial file`).not.toBe(
            -1,
          );
          seen.add(String(match));
        }
        // A real reader (the frames harness) does not spin on the file: leave the writers a gap.
        await readerGap();
      }
    })();
    const writers = Array.from({ length: 12 }, (_, index) =>
      writeFileAtomicIfChanged(file, versions[index % 2] ?? Buffer.alloc(0), {
        attempts: 20,
        delayMs: 10,
      }),
    );
    let outcomes: Awaited<ReturnType<typeof writeFileAtomicIfChanged>>[];
    try {
      outcomes = await Promise.all(writers);
    } finally {
      // The reader is always awaited, so its failure is reported instead of escaping unhandled.
      run.writing = false;
      await reader;
    }
    expect(outcomes).toHaveLength(12);
    expect(outcomes).toContain('written');
    expect(seen.size).toBeGreaterThan(0);
    const final = await readFile(file);
    expect(versions.some((version) => version.equals(final))).toBe(true);
    expect(await readdir(dir)).toEqual(['harness.js']);
  });

  it('retries a rename refused by Windows (EPERM/EBUSY) and then publishes', async () => {
    const file = path.join(dir, 'harness.js');
    await writeFile(file, 'old');
    const failures = ['EPERM', 'EBUSY'];
    let calls = 0;
    const outcome = await writeFileAtomicIfChanged(file, 'new', {
      delayMs: 1,
      rename: async (from, to) => {
        calls += 1;
        const code = failures.shift();
        if (code !== undefined) throw codedError(code);
        await rename(from, to);
      },
    });
    expect(outcome).toBe('written');
    expect(calls).toBe(3);
    expect(await readFile(file, 'utf8')).toBe('new');
    expect(await readdir(dir)).toEqual(['harness.js']);
  });

  it('a refused rename is fine when another writer already published the same content', async () => {
    const file = path.join(dir, 'harness.js');
    await writeFile(file, 'old');
    const outcome = await writeFileAtomicIfChanged(file, 'new', {
      delayMs: 1,
      rename: async () => {
        // The other process wins the race and holds the file.
        await writeFile(file, 'new');
        throw codedError('EPERM');
      },
    });
    expect(outcome).toBe('unchanged');
    expect(await readdir(dir)).toEqual(['harness.js']);
  });

  it('gives up after the attempts when the rename keeps failing with other content on disk', async () => {
    const file = path.join(dir, 'harness.js');
    await writeFile(file, 'old');
    let calls = 0;
    const write = writeFileAtomicIfChanged(file, 'new', {
      attempts: 3,
      delayMs: 1,
      rename: () => {
        calls += 1;
        return Promise.reject(codedError('EBUSY'));
      },
    });
    await expect(write).rejects.toMatchObject({ code: 'EBUSY' });
    expect(calls).toBe(3);
    expect(await readFile(file, 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual(['harness.js']);
  });

  it('does not retry other errors', async () => {
    const file = path.join(dir, 'harness.js');
    let calls = 0;
    const write = writeFileAtomicIfChanged(file, 'new', {
      rename: () => {
        calls += 1;
        return Promise.reject(codedError('EXDEV'));
      },
    });
    await expect(write).rejects.toMatchObject({ code: 'EXDEV' });
    expect(calls).toBe(1);
    expect(await readdir(dir)).toEqual([]);
  });
});
