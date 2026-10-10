/** "Thumbnail from the opening frame" (PLAN.md#14.18): adopt when none, uploads win. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OPENING_FRAME, adoptOpeningThumbnail, thumbnailOrigin } from './opening-thumbnail.js';

let dir: string;
let still: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'reelforge opening ż '));
  still = path.join(dir, OPENING_FRAME);
  await mkdir(path.dirname(still), { recursive: true });
  await writeFile(still, 'title card');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('opening-frame thumbnail', () => {
  it('becomes the thumbnail when the project has none, labelled as such', async () => {
    expect(await adoptOpeningThumbnail(dir, still)).toBe(true);
    const thumbnail = path.join(dir, 'publish', 'thumbnail.png');
    expect(await readFile(thumbnail, 'utf8')).toBe('title card');
    expect(await thumbnailOrigin(dir, thumbnail)).toBe('opening-frame');
    // a later export with a new title card keeps the thumbnail as it is
    await writeFile(still, 'new title card');
    expect(await adoptOpeningThumbnail(dir, still)).toBe(false);
    expect(await thumbnailOrigin(dir, thumbnail)).toBe('uploaded');
  });

  it('never replaces an uploaded thumbnail', async () => {
    const uploaded = path.join(dir, 'publish', 'thumbnail.jpg');
    await mkdir(path.dirname(uploaded), { recursive: true });
    await writeFile(uploaded, 'my picture');
    expect(await adoptOpeningThumbnail(dir, still)).toBe(false);
    expect(await thumbnailOrigin(dir, uploaded)).toBe('uploaded');
  });
});
