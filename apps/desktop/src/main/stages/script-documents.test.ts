import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { briefFileSchema } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import {
  briefFromInput,
  researchSources,
  ScriptDocuments,
  type ScriptDocumentsOptions,
} from './script-documents.js';
import { TempProjects, until } from './testing/fixtures.js';

const projects = new TempProjects();
afterEach(() => {
  projects.dispose();
});

const RESEARCH = `# Research

## Key facts

- White light is a mixture of colours — https://en.wikipedia.org/wiki/Dispersion_(optics)
- Newton described it in 1672 (https://en.wikipedia.org/wiki/Opticks).
- Again: https://en.wikipedia.org/wiki/Opticks

## Open questions

- No source here.
`;

interface Harness {
  readonly docs: ScriptDocuments;
  readonly dir: string;
  readonly store: PipelineStateStore;
  readonly commits: string[];
  /** The paths of each commit (only the files the action wrote). */
  readonly committedPaths: (readonly string[])[];
  busy: boolean;
}

function harness(
  files: Record<string, string> = {},
  options: Partial<ScriptDocumentsOptions> = {},
): Harness {
  const dir = projects.create(files);
  const store = new PipelineStateStore();
  const commits: string[] = [];
  const committedPaths: (readonly string[])[] = [];
  const state: Harness = {
    dir,
    store,
    commits,
    committedPaths,
    busy: false,
    docs: new ScriptDocuments({
      store,
      currentProject: () => dir,
      scriptBusy: () => state.busy,
      commit: (_dir, message, _step, paths) => {
        commits.push(message);
        committedPaths.push(paths);
        return Promise.resolve();
      },
      afterChange: () => undefined,
      log: createLogger(() => undefined),
      commitDelayMs: 30,
      ...options,
    }),
  };
  return state;
}

async function scriptState(h: Harness) {
  const read = await h.store.read(h.dir);
  if (!read.ok) throw new Error(read.error.message);
  return read.value.stages;
}

describe('ScriptDocuments', () => {
  it('lists every distinct research source with its claim', () => {
    expect(researchSources(RESEARCH)).toEqual([
      {
        url: 'https://en.wikipedia.org/wiki/Dispersion_(optics)',
        claim: 'White light is a mixture of colours',
      },
      { url: 'https://en.wikipedia.org/wiki/Opticks', claim: 'Newton described it in 1672' },
    ]);
  });

  it('saves the brief without empty optional fields and commits it', async () => {
    const h = harness();
    expect(
      briefFromInput({
        topic: '  Rainbows ',
        language: 'pl',
        targetMinutes: 2,
        tone: ' ',
        audience: 'kids',
        notes: '',
      }),
    ).toEqual({
      version: 1,
      topic: 'Rainbows',
      language: 'pl',
      targetMinutes: 2,
      audience: 'kids',
    });
    const saved = await h.docs.saveBrief({
      topic: 'Rainbows in a glass of water',
      language: 'en',
      targetMinutes: 0.5,
      tone: 'friendly',
      audience: '',
      notes: '',
    });
    expect(saved.status).toBe('ok');
    const brief = briefFileSchema.parse(
      JSON.parse(readFileSync(path.join(h.dir, 'brief.json'), 'utf8')),
    );
    expect(brief).toEqual({
      version: 1,
      topic: 'Rainbows in a glass of water',
      language: 'en',
      targetMinutes: 0.5,
      tone: 'friendly',
    });
    expect((await h.docs.brief()).brief).toEqual(brief);
    expect(h.commits).toEqual(['Brief: Rainbows in a glass of water']);
    expect(h.committedPaths).toEqual([['brief.json']]);
  });

  it('reads the script view: texts, sources, target and report', async () => {
    const h = harness({ 'script.txt': 'Hello.', 'research.md': RESEARCH });
    const document = await h.docs.script();
    expect(document).toMatchObject({
      script: 'Hello.',
      research: RESEARCH,
      beats: null,
      targetMinutes: 0.5,
      report: null,
    });
    expect(document.sources).toHaveLength(2);
  });

  it('autosaves edits, commits once per pause and marks later stages out of date', async () => {
    const h = harness({ 'script.txt': 'First draft.', 'timing/words.json': '{}' });
    await h.store.setStage(h.dir, 'words', 'done');
    expect(await h.docs.saveScript('First draft.')).toMatchObject({ message: 'No changes.' });
    expect(await h.docs.saveScript('Second draft.')).toEqual({
      status: 'ok',
      message: 'Out of date now: words.',
    });
    await h.docs.saveScript('Third draft.');
    expect(h.docs.dirty).toBe(true);
    expect(readFileSync(path.join(h.dir, 'script.txt'), 'utf8')).toBe('Third draft.');
    await until(() => h.commits.length > 0);
    expect(h.commits).toEqual(['Edit script']);
    // The dirty flag clears just after the commit is recorded: wait instead of racing it.
    await until(() => !h.docs.dirty);
    expect(h.docs.dirty).toBe(false);
    const stages = await scriptState(h);
    expect(stages['script']).toMatchObject({ status: 'done', message: 'edited by hand' });
    expect(stages['words']).toMatchObject({ stale: true, staleReason: 'script changed' });
  });

  it('approves the script; edits keep the approval, an import needs a new one', async () => {
    const h = harness({ 'script.txt': 'Approved words.' });
    expect(await h.docs.approve()).toMatchObject({ status: 'ok' });
    const approvedAt = (await scriptState(h))['script']?.approvedAt;
    expect(approvedAt).toEqual(expect.any(String));
    await h.docs.saveScript('Approved words, edited.');
    expect((await scriptState(h))['script']?.approvedAt).toBe(approvedAt);

    const file = path.join(h.dir, 'from editor.txt');
    writeFileSync(file, `${String.fromCharCode(0xfeff)}Imported words.`, 'utf8');
    expect(await h.docs.importScript(file)).toMatchObject({ status: 'ok' });
    expect(readFileSync(path.join(h.dir, 'script.txt'), 'utf8')).toBe('Imported words.');
    expect((await scriptState(h))['script']).toMatchObject({
      status: 'done',
      message: 'imported from from editor.txt',
    });
    expect((await scriptState(h))['script']?.approvedAt).toBeUndefined();
    expect(h.commits).toEqual(['Edit script', 'Import script from from editor.txt']);
    expect(h.committedPaths).toEqual([['script.txt'], ['script.txt']]);
  });

  it('refuses changes while the script stage runs, and an empty approval', async () => {
    const h = harness();
    expect(await h.docs.approve()).toEqual({
      status: 'error',
      message: 'Write or import a script first.',
    });
    h.busy = true;
    for (const result of [
      await h.docs.saveScript('x'),
      await h.docs.approve(),
      await h.docs.saveBrief({
        topic: 'x',
        language: 'en',
        targetMinutes: 1,
        tone: '',
        audience: '',
        notes: '',
      }),
    ]) {
      expect(result).toMatchObject({ status: 'error' });
    }
  });
});
