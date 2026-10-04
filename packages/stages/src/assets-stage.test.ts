/**
 * The Assets stage (PLAN.md#12.10) per research mode on fake-claude. The fake turn's `reelforge`
 * commands really run (in-process, as the runtime Claude's Bash tool would) against a local source
 * server that counts every request, so the research-mode guard decides for real.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { approveProposalItems, readCatalogue } from '@reelforge/cli/assets';
import {
  runAssetCommand,
  startAssetServer,
  type AssetCommandRun,
  type AssetTestServer,
} from '@reelforge/cli/assets-testing';
import type { ResearchMode } from '@reelforge/shared';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ASSETS_REVIEW_REASON, RESEARCH_OFF } from './assets-gate.js';
import type { ClaudeRunner } from './claude.js';
import { canRun } from './gating.js';
import { StageRunner } from './runner.js';
import { FakeClaudeHarness } from './testing/fake-claude.js';
import { TestProjects, goldenFile, readProject, writeProject } from './testing/project.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
let server: AssetTestServer;

beforeEach(async () => {
  server = await startAssetServer();
});
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
  await server.close();
});
afterAll(() => {
  projects.dispose();
});

const STAMP = '2026-10-04T13:00:00.000Z';

/** The golden storyboard with two asset needs on the Newton shot. */
function storyboardWithNeeds(): string {
  const storyboard = JSON.parse(goldenFile('storyboard.json')) as {
    shots: Record<string, unknown>[];
  };
  const needs = [
    { id: 'newton-portrait', kind: 'image', description: 'portrait of Isaac Newton' },
    { id: 'prism-photo', kind: 'image', description: 'a glass prism', query: 'glass prism' },
  ];
  const shots = storyboard.shots.map((shot) =>
    shot['id'] === 's07_newton' ? { ...shot, assetNeeds: needs } : shot,
  );
  return JSON.stringify({ ...storyboard, shots }, null, 2);
}

/**
 * One turn per entry: runs its `reelforge` commands for real, then plays the fake-claude turn with
 * those Bash calls in its transcript.
 */
function scriptedClaude(
  harness: FakeClaudeHarness,
  turns: readonly (readonly (readonly string[])[])[],
  runs: AssetCommandRun[],
): ClaudeRunner {
  let index = 0;
  return {
    run: async (spec, options) => {
      const commands = turns[index] ?? [];
      index += 1;
      const done: AssetCommandRun[] = [];
      for (const argv of commands) {
        done.push(await runAssetCommand(spec.projectDir, server.runtime(), argv));
      }
      runs.push(...done);
      harness.setScript({
        version: 1,
        sequence: [
          {
            scenario: 'tools-write',
            reply: 'Done.',
            writes: [],
            toolCalls: done.map((run) => ({
              name: 'Bash',
              input: { command: `reelforge ${run.argv.join(' ')}` },
              output: run.text,
              isError: run.code !== 0,
            })),
          },
        ],
      });
      return harness.runner.run(spec, options);
    },
  };
}

async function setup(
  name: string,
  mode: ResearchMode | undefined,
  turns: readonly (readonly (readonly string[])[])[],
  sources?: readonly string[],
) {
  const dir = await projects.create(name, ['script.txt', 'timing/words.json']);
  writeProject(dir, 'storyboard.json', storyboardWithNeeds());
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  delete project['researchMode'];
  if (mode !== undefined) project['researchMode'] = mode;
  if (sources !== undefined) project['researchSources'] = sources;
  writeProject(dir, 'project.json', JSON.stringify(project, null, 2));
  const harness = new FakeClaudeHarness([]);
  harnesses.push(harness);
  const runs: AssetCommandRun[] = [];
  const runner = new StageRunner({
    projectDir: dir,
    claude: scriptedClaude(harness, turns, runs),
    guard: harness.guard,
    git: projects.git,
    assets: server.runtime(),
  });
  return { dir, harness, runner, runs };
}

const fileRequests = (): string[] =>
  server.requests.filter((request) => request.startsWith('/files/'));

describe('Assets stage, research mode ask', () => {
  it('pauses for review, then fetches only what the user approved (no Claude turn)', async () => {
    const { dir, harness, runner, runs } = await setup('assets ask', 'ask', [
      [
        ['assets', 'search', '--query', 'isaac newton', '--kind', 'image'],
        ['assets', 'propose', '--ids', 'wikimedia:105654713,nasa:jsc2007e034221'],
        ['fetch-asset', '--source', 'wikimedia', '--id', '105654713'],
      ],
    ]);
    const research = await runner.run({ stage: 'assets' });
    expect(research.ok).toBe(true);
    if (!research.ok) return;
    expect(research.value.metrics).toMatchObject({ awaitingReview: true, candidates: 2 });
    expect(research.value.message).toBe('Asset package ready: 2 candidates to review');
    const prompt = harness.specs[0]?.prompt ?? '';
    expect(prompt).toContain('Research mode of this project: `ask`');
    expect(prompt).toContain('- s07_newton · newton-portrait (image): portrait of Isaac Newton');
    expect(prompt).toContain('do NOT fetch anything');
    expect(harness.specs[0]?.stage).toBe('storyboard');
    // Claude cannot fetch (nor approve) its own proposal.
    expect(runs.map((run) => run.code)).toEqual([0, 0, 1]);
    expect(runs[2]?.text).toContain('is not approved by the user');
    expect(existsSync(path.join(dir, 'assets.json'))).toBe(false);

    const waiting = await runner.snapshot();
    expect(waiting.research).toEqual({ mode: 'ask', needs: 2, pendingReviews: 1 });
    expect(canRun('scenes', waiting).reasons).toContain(ASSETS_REVIEW_REASON);

    await approveProposalItems(dir, 1, ['wikimedia:105654713'], STAMP);
    const before = fileRequests().length;
    const fetched = await runner.run({ stage: 'assets', action: 'fetch-approved' });
    expect(fetched.ok && fetched.value.message).toBe('Downloaded 1 approved asset');
    expect(harness.specs).toHaveLength(1);
    expect(fileRequests().length).toBe(before + 1);
    const catalogue = await readCatalogue(dir);
    expect(catalogue.assets.map((asset) => [asset.id, asset.approved, asset.mode])).toEqual([
      ['wm-105654713', true, 'ask'],
    ]);
    const ready = await runner.snapshot();
    expect(ready.research.pendingReviews).toBe(0);
    expect(canRun('scenes', ready).ready).toBe(true);
  });

  it('rejecting the whole package lets Scenes built go on with kit visuals', async () => {
    const { dir, runner } = await setup('assets reject', 'ask', [
      [['assets', 'propose', '--ids', 'nasa:jsc2007e034221']],
    ]);
    expect((await runner.run({ stage: 'assets' })).ok).toBe(true);
    await approveProposalItems(dir, 1, [], STAMP);
    const fetched = await runner.run({ stage: 'assets', action: 'fetch-approved' });
    expect(fetched.ok && fetched.value.message).toBe(
      'Nothing approved to download: the shots use kit visuals',
    );
    expect(canRun('scenes', await runner.snapshot()).ready).toBe(true);
    // Only the proposal's thumbnail was ever downloaded.
    expect(fileRequests()).toHaveLength(1);
    expect(existsSync(path.join(dir, 'assets.json'))).toBe(false);
  });
});

describe('Assets stage, research mode allowlist', () => {
  it('fetches only from the selected sources, verified licences only', async () => {
    const { dir, harness, runner, runs } = await setup(
      'assets allowlist',
      'allowlist',
      [
        [
          ['assets', 'propose', '--ids', 'nasa:jsc2007e034221'],
          ['fetch-asset', '--source', 'wikimedia', '--id', '105654713'],
          ['fetch-asset', '--source', 'nasa', '--id', 'jsc2007e034221', '--as', 'prism-photo'],
        ],
      ],
      ['nasa'],
    );
    const result = await runner.run({ stage: 'assets' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(harness.specs[0]?.prompt).toContain('only these sources: nasa');
    expect(runs.map((run) => run.code)).toEqual([1, 1, 0]);
    expect(runs[1]?.text).toContain('source "wikimedia" is not allowed here');
    expect(server.requests.some((request) => request.startsWith('/wikimedia'))).toBe(false);
    expect(result.value).toMatchObject({
      message: 'Fetched 1 asset',
      changed: true,
      warnings: [],
      metrics: { fetched: 1, unverified: 0, awaitingReview: false },
    });
    const catalogue = await readCatalogue(dir);
    expect(
      catalogue.assets.map((asset) => [asset.id, asset.source, asset.licence.verified]),
    ).toEqual([['prism-photo', 'nasa', true]]);
  });
});

describe('Assets stage, research mode full-auto', () => {
  it('flags assets with an unverified licence', async () => {
    const { runner } = await setup('assets full auto', 'full-auto', [
      [
        ['fetch-asset', '--url', `${server.base}/files/newton.png`, '--as', 'newton-portrait'],
        ['fetch-asset', '--source', 'nasa', '--id', 'jsc2007e034221'],
      ],
    ]);
    const result = await runner.run({ stage: 'assets' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).toBe('Fetched 2 assets (1 ⚠ unverified licence)');
    expect(result.value.metrics).toMatchObject({ fetched: 2, unverified: 1 });
    expect(result.value.warnings).toEqual([
      '⚠ newton-portrait: licence unverified (web); check it before publishing',
    ]);
  });
});

describe('Assets stage, research mode off (and projects without researchMode)', () => {
  it('does not exist: no Claude turn, Scenes built never waits, zero requests', async () => {
    const { dir, harness, runner } = await setup('assets off', undefined, [
      [['assets', 'search', '--query', 'newton']],
    ]);
    const snapshot = await runner.snapshot();
    expect(snapshot.research).toEqual(RESEARCH_OFF);
    expect(canRun('assets', snapshot).reasons).toEqual([
      'Asset research is off for this project (Project settings → Research assets).',
    ]);
    expect(canRun('scenes', snapshot).ready).toBe(true);
    const result = await runner.run({ stage: 'assets' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('not-ready');
    expect(harness.specs).toEqual([]);
    // Even a direct attempt through the CLI makes no request at all.
    for (const argv of [
      ['assets', 'search', '--query', 'newton'],
      ['fetch-asset', '--source', 'nasa', '--id', 'jsc2007e034221'],
      ['fetch-asset', '--url', `${server.base}/files/x.png`],
    ]) {
      expect((await runAssetCommand(dir, server.runtime(), argv)).code).toBe(1);
    }
    expect(server.requests).toEqual([]);
    expect(readFileSync(path.join(dir, 'project.json'), 'utf8')).not.toContain('researchMode');
  });
});
