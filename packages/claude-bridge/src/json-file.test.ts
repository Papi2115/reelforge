import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { JsonFileStore } from './json-file.js';

const counterSchema = z.object({ version: z.literal(1), count: z.number().int() });
type Counter = z.infer<typeof counterSchema>;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge json ż-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true, maxRetries: 5 });
});

function counterStore(): JsonFileStore<Counter> {
  return new JsonFileStore(counterSchema, () => ({ version: 1, count: 0 }));
}

describe('JsonFileStore', () => {
  it('a read issued during pending updates sees all of them (never a half-replaced file)', async () => {
    const store = counterStore();
    const file = path.join(dir, 'counter.json');
    const updates = Array.from({ length: 20 }, () =>
      store.update(file, (current) => ({ ...current, count: current.count + 1 })),
    );
    const reads = Array.from({ length: 20 }, () => store.read(file));
    const read = await reads[reads.length - 1];
    expect(read).toEqual({ ok: true, value: { version: 1, count: 20 } });
    for (const result of await Promise.all([...updates, ...reads])) expect(result.ok).toBe(true);
    expect(await readdir(dir)).toEqual(['counter.json']);
  });

  it('an update whose mutation throws does not block the next operations', async () => {
    const store = counterStore();
    const file = path.join(dir, 'counter.json');
    const broken = store.update(file, () => {
      throw new Error('mutation failed');
    });
    const next = store.update(file, (current) => ({ ...current, count: current.count + 1 }));
    await expect(broken).rejects.toThrow('mutation failed');
    expect(await next).toEqual({ ok: true, value: { version: 1, count: 1 } });
    expect(await store.read(file)).toEqual({ ok: true, value: { version: 1, count: 1 } });
  });
});
