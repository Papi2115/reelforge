/**
 * Hook lab (PLAN.md#12.16) on fake-claude: three openings generated from the finished script
 * (read-only Sonnet turn, validated, stored as .reelforge/hooks/1.json), one repair turn for an
 * unusable reply, pick #2 → script.txt's opening replaced (rest byte for byte), the app's commit,
 * later stages stale, a recorded voice-over → "re-record" warning, locked shots listed and
 * untouched (scenes, locks.json); a changed script refuses an old set.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { promptModel } from '@reelforge/prompts';
import { autocommit } from '@reelforge/project';
import { hookSetSchema, scriptOpening } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { generateHooks } from './hook-lab/generate.js';
import { discardHooks, pickHook, readHookLabState } from './hook-lab/decide.js';
import { setShotsLocked } from './locks.js';
import { FakeClaudeHarness, type Step } from './testing/fake-claude.js';
import { EVAL_CASE_DIR, TestProjects, goldenFile, readProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

interface CannedHooks {
  readonly hooks: readonly { style: string; text: string }[];
}
const CANNED = (
  JSON.parse(readFileSync(path.join(EVAL_CASE_DIR, '..', 'case.json'), 'utf8')) as {
    replies: { hooks: CannedHooks };
  }
).replies.hooks;
const REPLY = JSON.stringify(CANNED);
const QUESTION = CANNED.hooks[1]?.text ?? '';
const SCENE = goldenFile('scenes/s06_red_violet.js');
const LOCKED = ['s01_hook', 's02_glass', 's07_newton'];
const DONE = ['voiceover', 'clean', 'words', 'storyboard', 'scenes'] as const;

async function setup(name: string, steps: readonly Step[]) {
  const dir = await projects.create(name, [
    'brief.json',
    'research.md',
    'beats.md',
    'script.txt',
    'storyboard.json',
    'timing/words.json',
  ]);
  for (const id of ['s01_hook', 's02_glass', 's07_newton']) {
    writeFileSync(path.join(dir, 'scenes', `${id}.js`), SCENE.replace('s06_red_violet', id));
  }
  mkdirSync(path.join(dir, 'audio'), { recursive: true });
  writeFileSync(path.join(dir, 'audio', 'vo.original.wav'), 'RIFF');
  const store = new PipelineStateStore();
  for (const stage of ['script', ...DONE]) await store.setStage(dir, stage, 'done', 'ok');
  const locked = await setShotsLocked(dir, LOCKED, true, new Date('2026-10-04T08:00:00Z'));
  if (!locked.ok) throw new Error(locked.error.message);
  const committed = await autocommit(dir, 'Film', { kind: 'manual', git: projects.git });
  if (!committed.ok) throw new Error(committed.error.message);
  const harness = new FakeClaudeHarness(steps);
  harnesses.push(harness);
  return { dir, harness, store };
}

const now = (): Date => new Date('2026-10-04T10:00:00.000Z');

describe('hook lab', { timeout: 60_000 }, () => {
  it('generates three openings, picks #2, commits, marks later stages stale, keeps locks', async () => {
    const { dir, harness, store } = await setup('hooks pick', [{ scenario: 'ok', reply: REPLY }]);
    const script = readProject(dir, 'script.txt');
    const opening = scriptOpening(script)?.text ?? '';

    const generated = await generateHooks({
      projectDir: dir,
      claude: harness.runner,
      model: promptModel('hooks'),
      now,
    });
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(generated.value.variants.map((variant) => [variant.index, variant.style])).toEqual([
      [1, 'cold-open'],
      [2, 'question'],
      [3, 'shocking-fact'],
    ]);
    expect(generated.value.opening).toBe(opening);
    expect(
      hookSetSchema.parse(JSON.parse(readProject(dir, '.reelforge/hooks/1.json'))).number,
    ).toBe(1);
    // One read-only Sonnet turn (the critic's permissions), the opening and research in it.
    expect(harness.specs.map((spec) => [spec.stage, spec.model, spec.newSession])).toEqual([
      ['critic', 'sonnet', true],
    ]);
    expect(harness.specs[0]?.prompt).toContain(opening);
    expect(harness.specs[0]?.prompt).toContain('Newton described splitting sunlight');
    // Generating changes nothing tracked.
    expect(readProject(dir, 'script.txt')).toBe(script);

    const before = (await projects.history(dir)).length;
    const scenes = LOCKED.map((id) => readProject(dir, `scenes/${id}.js`));
    const locks = readProject(dir, 'locks.json');
    const picked = await pickHook({ projectDir: dir, number: 1, index: 2, store, now });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    const committed = await autocommit(dir, picked.value.commitMessage, {
      kind: 'manual',
      step: 'script',
      git: projects.git,
    });
    expect(committed.ok).toBe(true);

    const updated = readProject(dir, 'script.txt');
    expect(updated.startsWith(QUESTION)).toBe(true);
    expect(updated.slice(QUESTION.length)).toBe(script.slice(opening.length));
    const [head] = await projects.history(dir);
    expect((await projects.history(dir)).length).toBe(before + 1);
    expect(head?.subject).toBe('Hook lab: opening 2 (Question)');
    expect(head?.files.map((file) => file.path)).toEqual(['script.txt']);
    // The existing invalidation of a script change: words and everything after them.
    expect(picked.value.invalidated).toEqual(['words', 'storyboard', 'scenes']);
    const state = await store.read(dir);
    for (const stage of picked.value.invalidated) {
      expect(state.ok && state.value.stages[stage]).toMatchObject({
        stale: true,
        staleReason: 'script changed',
      });
    }
    for (const stage of ['script', 'voiceover', 'clean']) {
      expect(state.ok && state.value.stages[stage]?.stale).toBeUndefined();
    }
    expect(picked.value.voiceover).toBe(true);
    expect(picked.value.lockedShots).toEqual(['s01_hook', 's02_glass']);
    expect(picked.value.warnings).toEqual([
      'You will need to re-record the opening: the voice-over no longer matches the script.',
      expect.stringContaining('s01_hook, s02_glass'),
    ]);
    expect(LOCKED.map((id) => readProject(dir, `scenes/${id}.js`))).toEqual(scenes);
    expect(readProject(dir, 'locks.json')).toBe(locks);
    const stored = hookSetSchema.parse(JSON.parse(readProject(dir, '.reelforge/hooks/1.json')));
    expect(stored.decision).toEqual({ kind: 'pick', index: 2, at: now().toISOString() });
    // A decided set cannot be picked again.
    const again = await pickHook({ projectDir: dir, number: 1, index: 1, store, now });
    expect(!again.ok && again.error.message).toBe('Hook set 1 was already decided.');
  });

  it('repairs an unusable reply once and refuses a set written for another opening', async () => {
    const bad = JSON.stringify({ hooks: CANNED.hooks.slice(0, 2) });
    const { dir, harness, store } = await setup('hooks repair', [
      { scenario: 'ok', reply: bad },
      { scenario: 'ok', reply: REPLY },
    ]);
    const generated = await generateHooks({
      projectDir: dir,
      claude: harness.runner,
      model: 'sonnet',
      now,
    });
    expect(generated.ok).toBe(true);
    expect(harness.specs[1]?.prompt).toContain("A previous answer did not pass the app's checks");
    const state = await readHookLabState(dir, store);
    expect(state.ok && state.value).toMatchObject({
      history: 1,
      stale: false,
      voiceover: true,
      lockedShots: ['s01_hook', 's02_glass'],
    });
    writeFileSync(
      path.join(dir, 'script.txt'),
      `Edited by hand.\n\n${readProject(dir, 'script.txt')}`,
    );
    expect((await readHookLabState(dir, store)).ok).toBe(true);
    const refused = await pickHook({ projectDir: dir, number: 1, index: 1, store, now });
    expect(!refused.ok && refused.error.kind).toBe('not-ready');
    const discarded = await discardHooks({ projectDir: dir, number: 1, store, now });
    expect(discarded.ok && discarded.value.decision?.kind).toBe('discard');
  });

  it('fails clearly when both replies are unusable or there is no script', async () => {
    const { dir, harness } = await setup('hooks fail', [{ scenario: 'ok', reply: 'nope' }]);
    const failed = await generateHooks({
      projectDir: dir,
      claude: harness.runner,
      model: 'sonnet',
      now,
    });
    expect(!failed.ok && failed.error).toContain("Claude's openings did not pass the checks");
    expect(harness.specs).toHaveLength(2);
    writeFileSync(path.join(dir, 'script.txt'), '  \n');
    const empty = await generateHooks({
      projectDir: dir,
      claude: harness.runner,
      model: 'sonnet',
      now,
    });
    expect(!empty.ok && empty.error).toBe('There is no script yet: write the script first.');
  });
});
