/**
 * Demo video for the preview until projects exist (PLAN.md#6.2): the engine's example scene
 * `s00_hello.js` with its words, read from disk by main and inlined into a render manifest (the
 * sandboxed engine never touches the disk, ADR-004).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { renderManifestSchema, wordsFileSchema, type RenderManifest } from '@reelforge/shared';
import { describeError } from './logger.js';

export const DEMO_SCENE_FILE = 's00_hello.js';
export const DEMO_WORDS_FILE = 'words.json';
const DEMO_DURATION_SECONDS = 5;
const DEMO_SEED = 2115;

async function readText(file: string): Promise<Result<string, string>> {
  try {
    return ok(await readFile(file, 'utf8'));
  } catch (error) {
    return err(`cannot read ${file}: ${describeError(error)}`);
  }
}

export async function loadDemoManifest(demoDir: string): Promise<Result<RenderManifest, string>> {
  const source = await readText(path.join(demoDir, DEMO_SCENE_FILE));
  if (!source.ok) return source;
  const wordsText = await readText(path.join(demoDir, DEMO_WORDS_FILE));
  if (!wordsText.ok) return wordsText;

  let wordsJson: unknown;
  try {
    wordsJson = JSON.parse(wordsText.value);
  } catch (error) {
    return err(`${DEMO_WORDS_FILE} is not JSON: ${describeError(error)}`);
  }
  const words = wordsFileSchema.safeParse(wordsJson);
  if (!words.success) return err(`${DEMO_WORDS_FILE} is invalid: ${words.error.message}`);

  const manifest = renderManifestSchema.safeParse({
    version: 1,
    fps: 30,
    seed: DEMO_SEED,
    words: words.data,
    shots: [
      {
        id: 's00',
        t0: 0,
        t1: DEMO_DURATION_SECONDS,
        scene: { file: `scenes/${DEMO_SCENE_FILE}`, source: source.value },
      },
    ],
  });
  if (!manifest.success) return err(`demo manifest is invalid: ${manifest.error.message}`);
  return ok(manifest.data);
}
