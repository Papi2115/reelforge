import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renderManifestSchema } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_SCENE_FILE, DEMO_WORDS_FILE, loadDemoManifest } from './demo-manifest.js';

const examplesDir = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'engine',
  'examples',
);

let root: string;
let demoDir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge-demo-'));
  demoDir = path.join(root, 'Creatorize Suite', 'źdźbło demo');
  await mkdir(demoDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('loadDemoManifest', () => {
  it('inlines the example scene and words into a valid manifest', async () => {
    await copyFile(path.join(examplesDir, DEMO_SCENE_FILE), path.join(demoDir, DEMO_SCENE_FILE));
    await copyFile(path.join(examplesDir, DEMO_WORDS_FILE), path.join(demoDir, DEMO_WORDS_FILE));
    const result = await loadDemoManifest(demoDir);
    if (!result.ok) throw new Error(result.error);
    expect(renderManifestSchema.safeParse(result.value).success).toBe(true);
    expect(result.value.shots[0]?.scene.source).toContain('export function build');
    expect(result.value.words?.words.length).toBeGreaterThan(0);
  });

  it('reports a missing scene and invalid words', async () => {
    const missing = await loadDemoManifest(demoDir);
    expect(missing.ok).toBe(false);

    await copyFile(path.join(examplesDir, DEMO_SCENE_FILE), path.join(demoDir, DEMO_SCENE_FILE));
    await writeFile(path.join(demoDir, DEMO_WORDS_FILE), '{"version": 1, "words": "nope"}');
    const invalid = await loadDemoManifest(demoDir);
    expect(!invalid.ok && invalid.error).toContain('words.json is invalid');
  });
});
