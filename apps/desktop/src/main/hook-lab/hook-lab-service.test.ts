/**
 * Hook lab service (PLAN.md#12.16): generate through a fake ClaudeRunner, pick → script.txt
 * replaced, editor flushed first, one `Hook lab: …` commit, the pipeline refreshed, later stages
 * stale; refused while the Script stage runs; discard keeps the script.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import { defaultAppSettings } from '@reelforge/shared';
import type { ClaudeRunner, ClaudeTurnSpec } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { HookLabService } from './hook-lab-service.js';

const OPENING =
  'Here is a quick experiment you can try at home. Take a glass of water and shine a flashlight through it.';
const SCRIPT = `${OPENING}\n\nWhite light is a mix of many colors. Newton described it in 1672.\n`;
const RESEARCH = '- Newton described splitting sunlight in 1672 — https://example.org/opticks\n';
const HOOKS = [
  [
    'cold-open',
    'A beam of white light hits a plain glass of water on a kitchen table, and suddenly a small rainbow glows on the wall behind it. No prism, no lab, no special equipment. Just a flashlight, a glass and a dark room. So where do those colours come from?',
  ],
  [
    'question',
    'What if the plain white light from your flashlight was secretly hiding every colour of the rainbow? You can find out tonight with nothing more than a glass of water, a table and a dark room. Shine the light through the glass and watch what the water quietly reveals on the wall.',
  ],
  [
    'shocking-fact',
    'In 1672, Isaac Newton showed that white light is not one colour at all. It is a mix of many, and anything that bends light can pull them apart. Water does it too, and you can see it yourself at home tonight with a flashlight, a glass of water and a dark room.',
  ],
] as const;
const REPLY = JSON.stringify({
  hooks: HOOKS.map(([style, text]) => ({
    style,
    text,
    firstVisual: 'A beam of light',
    claimsToSource: style === 'shocking-fact',
  })),
});

let dir: string;
let specs: ClaudeTurnSpec[];
let commits: string[];
let events: string[];
let busy: boolean;
let store: PipelineStateStore;

function service(): HookLabService {
  const claude: ClaudeRunner = {
    run: (spec) => {
      specs.push(spec);
      return Promise.resolve({
        status: 'completed',
        reply: REPLY,
        sessionId: undefined,
        message: 'ok',
        usage: undefined,
        limit: undefined,
      });
    },
  };
  return new HookLabService({
    currentProject: () => dir,
    claude,
    settings: defaultAppSettings,
    store,
    scriptBusy: () => busy,
    flushScript: () => {
      events.push('flush');
      return Promise.resolve();
    },
    commit: (_dir, message) => {
      commits.push(message);
      events.push('commit');
      return Promise.resolve(true);
    },
    afterChange: () => {
      events.push('refresh');
    },
    now: () => new Date('2026-10-04T10:00:00.000Z'),
    log: createLogger(() => undefined),
  });
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rf hook lab ż '));
  await writeFile(path.join(dir, 'script.txt'), SCRIPT);
  await writeFile(path.join(dir, 'research.md'), RESEARCH);
  await mkdir(path.join(dir, '.reelforge'), { recursive: true });
  store = new PipelineStateStore();
  await store.setStage(dir, 'script', 'done', 'ok');
  await store.setStage(dir, 'storyboard', 'done', 'ok');
  specs = [];
  commits = [];
  events = [];
  busy = false;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('HookLabService', () => {
  it('generates, picks with a commit and a refresh, marks later stages stale', async () => {
    const lab = service();
    const empty = await lab.state();
    expect(empty.status === 'ok' && empty.view).toMatchObject({
      opening: OPENING,
      set: null,
      history: 0,
      voiceover: false,
      lockedShots: [],
    });
    const generated = await lab.generate();
    expect(generated.status).toBe('ok');
    if (generated.status !== 'ok') return;
    expect(generated.view.generating).toBe(false);
    expect(generated.view.set?.variants.map((variant) => variant.style)).toEqual([
      'cold-open',
      'question',
      'shocking-fact',
    ]);
    expect(specs.map((spec) => [spec.stage, spec.model, spec.purpose])).toEqual([
      ['critic', 'sonnet', 'qa'],
    ]);

    events = [];
    const picked = await lab.pick({ number: 1, index: 2 });
    expect(picked).toMatchObject({
      status: 'ok',
      message: "Opening 2 (Question) is now the script's opening.",
      invalidated: ['storyboard'],
      warnings: [],
    });
    expect(events).toEqual(['flush', 'commit', 'refresh']);
    expect(commits).toEqual(['Hook lab: opening 2 (Question)']);
    const script = await readFile(path.join(dir, 'script.txt'), 'utf8');
    expect(script.startsWith(HOOKS[1][1])).toBe(true);
    expect(script.endsWith('Newton described it in 1672.\n')).toBe(true);
    const state = await store.read(dir);
    expect(state.ok && state.value.stages['storyboard']?.stale).toBe(true);
    expect(picked.status === 'ok' && picked.view.set?.decision?.kind).toBe('pick');
  });

  it('refuses while the script is written and keeps the script on discard', async () => {
    const lab = service();
    busy = true;
    expect(await lab.generate()).toEqual({
      status: 'error',
      message: 'The script is being written: wait or stop it.',
    });
    busy = false;
    expect((await lab.generate()).status).toBe('ok');
    busy = true;
    expect((await lab.pick({ number: 1, index: 1 })).status).toBe('error');
    busy = false;
    const kept = await lab.discard(1);
    expect(kept).toMatchObject({ status: 'ok', message: 'Kept the current opening.' });
    expect(await readFile(path.join(dir, 'script.txt'), 'utf8')).toBe(SCRIPT);
    expect(commits).toEqual([]);
  });
});
