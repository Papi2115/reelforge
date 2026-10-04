import { describe, expect, it } from 'vitest';
import { writeTextVerified, type TextClipboard } from './clipboard-text.js';

/** A clipboard whose first `lostWrites` writes are dropped (another program held it open). */
function busyClipboard(lostWrites: number): TextClipboard & { writes: number } {
  let content = 'before';
  const fake = {
    writes: 0,
    writeText(text: string): Promise<void> {
      fake.writes += 1;
      if (fake.writes > lostWrites) content = text;
      return Promise.resolve();
    },
    readText(): Promise<string> {
      return Promise.resolve(content);
    },
  };
  return fake;
}

const noSleep = (): Promise<void> => Promise.resolve();

describe('writeTextVerified', () => {
  it('writes once when the clipboard is free', async () => {
    const clipboard = busyClipboard(0);
    expect(await writeTextVerified(clipboard, 'Title\nline 2', { sleep: noSleep })).toBe(true);
    expect(clipboard.writes).toBe(1);
    expect(await clipboard.readText()).toBe('Title\nline 2');
  });

  it('writes again until the text sticks', async () => {
    const clipboard = busyClipboard(2);
    const waits: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      waits.push(ms);
      return Promise.resolve();
    };
    expect(await writeTextVerified(clipboard, 'Doom', { sleep, waitMs: 25 })).toBe(true);
    expect(clipboard.writes).toBe(3);
    expect(waits).toEqual([25, 25]);
  });

  it('gives up after the last attempt without waiting after it', async () => {
    const clipboard = busyClipboard(10);
    const waits: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      waits.push(ms);
      return Promise.resolve();
    };
    expect(await writeTextVerified(clipboard, 'Doom', { attempts: 3, sleep })).toBe(false);
    expect(clipboard.writes).toBe(3);
    expect(waits).toHaveLength(2);
    expect(await clipboard.readText()).toBe('before');
  });
});
