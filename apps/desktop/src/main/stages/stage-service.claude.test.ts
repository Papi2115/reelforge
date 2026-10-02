/**
 * The real Script stage through the app's wiring: the ClaudeService's shared SessionManager
 * (sharedClaudeRunner), its LimitGuard and the StageService, with tools/fake-claude writing
 * research.md, beats.md and script.txt (never the real CLI).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { err, ok, PipelineStateStore } from '@reelforge/claude-bridge';
import { fakeClaudeLauncher, type FakeClaudeScript } from '@reelforge/fake-claude';
import { defaultAppSettings } from '@reelforge/shared';
import { StageRunner } from '@reelforge/stages';
import { afterEach, describe, expect, it } from 'vitest';
import type { StagesState } from '../../shared/stages-contract.js';
import { ClaudeService } from '../claude/claude-service.js';
import { createLogger } from '../logger.js';
import { StageService } from './stage-service.js';
import { sharedClaudeRunner } from './stage-runtime.js';
import { TempProjects, until } from './testing/fixtures.js';

const GOLDEN = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'prompts',
  'evals',
  'cases',
  'en-short-prism',
  'project',
);
const golden = (file: string): string => readFileSync(path.join(GOLDEN, file), 'utf8');

const projects = new TempProjects();
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  projects.dispose();
});

function parentEnv(script: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  return { ...env, FAKE_CLAUDE_SCRIPT: script };
}

function claudeService(script: FakeClaudeScript | undefined, dir: string): ClaudeService {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'rf stage claude '));
  const sidecar = path.join(scratch, 'script.json');
  writeFileSync(sidecar, JSON.stringify(script ?? { version: 1, sequence: [] }));
  const service = new ClaudeService({
    setup: () =>
      Promise.resolve(
        script === undefined
          ? err({ kind: 'not-connected', message: 'Claude Code is not installed.' })
          : ok({ launcher: fakeClaudeLauncher(), env: parentEnv(sidecar), permissions: {} }),
      ),
    settings: defaultAppSettings,
    currentProject: () => dir,
    renderEnv: () => undefined,
    commit: () => Promise.resolve(ok({ status: 'nothing-to-commit' as const })),
    push: () => undefined,
    log: createLogger(() => undefined),
    exitGraceMs: 2_000,
  });
  cleanups.push(async () => {
    await service.dispose();
    rmSync(scratch, { recursive: true, force: true });
  });
  return service;
}

function stageService(claude: ClaudeService, pushes: StagesState[]): StageService {
  const store = new PipelineStateStore();
  const service = new StageService({
    createRunner: (projectDir) =>
      new StageRunner({
        projectDir,
        claude: sharedClaudeRunner(() => claude.sessionManager()),
        guard: claude.guard,
        store,
        autocommit: false,
      }),
    store,
    guard: claude.guard,
    push: (state) => pushes.push(state),
    log: createLogger(() => undefined),
    pushDelayMs: 0,
  });
  cleanups.push(() => service.dispose());
  return service;
}

describe('StageService with fake-claude', { timeout: 60_000 }, () => {
  it('writes research, beats and script on the shared session manager with live steps', async () => {
    const dir = projects.create();
    const script: FakeClaudeScript = {
      version: 1,
      sequence: [
        {
          scenario: 'tools-write',
          reply: 'Saved research.md.',
          writes: [{ path: 'research.md', content: golden('research.md') }],
        },
        {
          scenario: 'tools-write',
          reply: 'Word count: 84.',
          writes: [
            { path: 'beats.md', content: golden('beats.md') },
            { path: 'script.txt', content: golden('script.txt') },
          ],
        },
      ],
    };
    const claude = claudeService(script, dir);
    const pushes: StagesState[] = [];
    const service = stageService(claude, pushes);
    await service.follow(dir);
    expect(await service.run(['script'])).toMatchObject({ status: 'queued' });
    await until(() => (pushes.at(-1)?.running?.steps.length ?? 0) > 0, 30_000);
    await service.whenIdle();
    expect(claude.sessions).toBeDefined();

    expect(readFileSync(path.join(dir, 'script.txt'), 'utf8')).toBe(golden('script.txt'));
    const steps = pushes.flatMap((state) => state.running?.steps ?? []);
    expect(steps.some((step) => step.type === 'tool' && step.summary.includes('research.md'))).toBe(
      true,
    );
    await until(() => pushes.at(-1)?.running === null);
    const info = (await service.state()).stages.find((candidate) => candidate.stage === 'script');
    expect(info).toMatchObject({
      status: 'done',
      message: '84 words, about 0:34 at 150 wpm',
      hasOutput: true,
      approvedAt: null,
    });
  });

  it('fails as blocked with the connection message when Claude is not set up', async () => {
    const dir = projects.create();
    const claude = claudeService(undefined, dir);
    const service = stageService(claude, []);
    await service.follow(dir);
    await service.run(['script']);
    await service.whenIdle();
    const info = (await service.state()).stages.find((candidate) => candidate.stage === 'script');
    expect(info?.status).toBe('blocked');
    expect(info?.error?.message).toContain('Claude Code is not installed.');
  });
});
