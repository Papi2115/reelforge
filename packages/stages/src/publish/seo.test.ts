import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fallbackPublishSeo } from '@reelforge/pipeline';
import {
  publishSeoFileSchema,
  publishSeoIssues,
  storyboardFileSchema,
  wordsFileSchema,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_DIR } from '../testing/example-film.js';
import { FakeClaudeHarness, writes, type Step } from '../testing/fake-claude.js';
import { generatePublishSeo, readPublishSeo } from './seo.js';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const STRETCH = 10;
const read = (file: string): string => readFileSync(path.join(EXAMPLE_DIR, file), 'utf8');
/** The example film stretched to about 5 minutes (enough for 5–8 chapters). */
const SHOTS = storyboardFileSchema
  .parse(JSON.parse(read('storyboard.json')))
  .shots.map((shot) => ({ ...shot, t0: shot.t0 * STRETCH, t1: shot.t1 * STRETCH }));
const WORDS_FILE = wordsFileSchema.parse(JSON.parse(read(path.join('timing', 'words.json'))));
const WORDS = WORDS_FILE.words.map((word) => ({
  ...word,
  t: word.t * STRETCH,
  tEnd: word.tEnd * STRETCH,
}));
const DURATION = SHOTS.at(-1)?.t1 ?? 0;

/** A reply that passes every rule (chapters on the film's cuts), told apart by its title. */
const GOOD = {
  ...fallbackPublishSeo({
    title: 'Doom on a calculator',
    script: read('script.txt'),
    channel: { genre: 'tech-explainer' },
    shots: SHOTS,
    durationS: DURATION,
    words: WORDS,
  }),
  title: 'How Doom Runs on a Graphing Calculator',
};
const BAD = { ...GOOD, chapters: [{ t: 3, title: 'Intro' }] };

let dir: string;
let harness: FakeClaudeHarness | undefined;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'rf seo żółw '));
  mkdirSync(path.join(dir, 'timing'));
  for (const file of ['project.json', 'script.txt']) {
    copyFileSync(path.join(EXAMPLE_DIR, file), path.join(dir, file));
  }
  writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ version: 1, shots: SHOTS }));
  writeFileSync(
    path.join(dir, 'timing', 'words.json'),
    JSON.stringify({ ...WORDS_FILE, words: WORDS }),
  );
});

afterEach(async () => {
  await harness?.dispose();
  harness = undefined;
  rmSync(dir, { recursive: true, force: true });
});

function run(steps: readonly Step[] | null): ReturnType<typeof generatePublishSeo> {
  harness = steps === null ? undefined : new FakeClaudeHarness(steps);
  return generatePublishSeo({
    projectDir: dir,
    claude: harness?.runner ?? null,
    model: 'sonnet',
    channel: { name: 'Voxplain', genre: 'tech-explainer', tags: ['retro games'] },
    now: () => NOW,
  });
}

describe('generatePublishSeo (fake-claude)', () => {
  it("writes Claude's tags and chapters to publish/seo.json in one read-only turn", async () => {
    const result = await run([writes({}, JSON.stringify(GOOD))]);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.fallbackReason).toBeNull();
    expect(result.value.file).toMatchObject({
      version: 1,
      source: 'claude',
      model: 'sonnet',
      generatedAt: NOW.toISOString(),
      title: GOOD.title,
    });
    expect(await readPublishSeo(dir)).toEqual(result.value.file);
    expect(harness?.specs).toHaveLength(1);
    expect(harness?.specs[0]).toMatchObject({ stage: 'critic', newSession: true, model: 'sonnet' });
    const prompt = harness?.specs[0]?.prompt ?? '';
    expect(prompt).toContain('- name: Voxplain');
    expect(prompt).toContain('- genre: Tech explainer');
    expect(prompt).toContain('0 (0:00) · Doom runs on almost anything.');
  });

  it('repairs an invalid answer once, without questions', async () => {
    const result = await run([writes({}, JSON.stringify(BAD)), writes({}, JSON.stringify(GOOD))]);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.file.source).toBe('claude');
    expect(harness?.specs[1]?.prompt).toContain("did not pass the app's checks");
    expect(harness?.specs[1]?.prompt).toContain('without asking questions');
  });

  it('falls back to the deterministic tags and chapters when the answers stay invalid', async () => {
    const result = await run([writes({}, JSON.stringify(BAD)), writes({}, 'not json')]);
    if (!result.ok) throw new Error(result.error);
    const { file, fallbackReason } = result.value;
    expect(fallbackReason).toMatch(/did not pass the checks/);
    expect(file.source).toBe('fallback');
    expect(file.model).toBeUndefined();
    expect(publishSeoIssues(file, { durationS: DURATION })).toEqual([]);
    expect(file.tags.twoWord).toContain('retro games');
  });

  it('falls back without a turn when Claude is unavailable or not logged in', async () => {
    const none = await run(null);
    expect(none.ok && none.value.file.source).toBe('fallback');
    expect(none.ok && none.value.fallbackReason).toBe('Claude is not available.');
    const blocked = await run(['not-logged-in']);
    expect(blocked.ok && blocked.value.file.source).toBe('fallback');
    const stored = publishSeoFileSchema.parse(
      JSON.parse(readFileSync(path.join(dir, 'publish', 'seo.json'), 'utf8')),
    );
    expect(stored.source).toBe('fallback');
  });

  it('needs a storyboard', async () => {
    rmSync(path.join(dir, 'storyboard.json'));
    const result = await run(null);
    expect(result).toEqual({
      ok: false,
      error: 'Tags and timestamps need a storyboard: run the Storyboard stage first.',
    });
  });
});
