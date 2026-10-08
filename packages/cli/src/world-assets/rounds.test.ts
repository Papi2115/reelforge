/** Self-QA rounds of a world-assets design session (real run Comic 2: ~20 sheets instead of 2). */
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  countSheetRound,
  readSheetRounds,
  SHEET_ROUNDS_SESSION_MS,
  sheetRoundLine,
  startSheetRounds,
} from './rounds.js';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function project(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rf rounds '));
  roots.push(root);
  return root;
}

const at = (ms: number): Date => new Date(Date.UTC(2026, 9, 7, 12) + ms);

describe('world-assets sheet rounds', () => {
  it('counts the rounds of a session the step started and warns after two', async () => {
    const root = await project();
    await startSheetRounds(root, at(0));
    expect(await countSheetRound(root, at(1000))).toBe(1);
    expect(await countSheetRound(root, at(2000))).toBe(2);
    expect(await countSheetRound(root, at(3000))).toBe(3);
    expect((await readSheetRounds(root))?.rounds).toBe(3);
    expect(sheetRoundLine(2)).toBe('self-QA round 2 of 2');
    expect(sheetRoundLine(3)).toMatch(/^warning: self-QA round 3; the world-assets turn allows 2/);
    await startSheetRounds(root, at(4000));
    expect((await readSheetRounds(root))?.rounds).toBe(0);
  });

  it('starts a session itself without a file, with an old or a broken one', async () => {
    const root = await project();
    expect(await readSheetRounds(root)).toBeUndefined();
    expect(await countSheetRound(root, at(0))).toBe(1);
    expect(await countSheetRound(root, at(SHEET_ROUNDS_SESSION_MS + 1))).toBe(1);
    await mkdir(path.join(root, '.reelforge'), { recursive: true });
    await writeFile(path.join(root, '.reelforge', 'world-assets-rounds.json'), '{ broken');
    expect(await readSheetRounds(root)).toBeUndefined();
    expect(await countSheetRound(root, at(0))).toBe(1);
  });
});
