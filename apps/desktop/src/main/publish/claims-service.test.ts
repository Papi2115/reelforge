import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { claimsFileSchema, defaultAppSettings } from '@reelforge/shared';
import type { ClaudeRunner, ClaudeTurnSpec } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { ClaimsService } from './claims-service.js';

const EXAMPLE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
  'doom-on-a-calculator',
);
const RESEARCH = [
  '## Key facts',
  '- Doom (1993) required 4 MB of RAM — https://doomwiki.org/wiki/Doom',
  '- The TI-84 Plus CE port fits in 61 KB ([Cemetech](https://www.cemetech.net/doom84))',
].join('\n');
const REPLY = JSON.stringify({
  claims: [
    {
      sentence: 3,
      text: 'only 61 KB of memory',
      kind: 'number',
      sources: ['r2'],
      status: 'sourced',
    },
    {
      sentence: 4,
      text: 'The original game needed four megabytes',
      kind: 'number',
      sources: ['r1'],
      status: 'sourced',
    },
    {
      sentence: 8,
      text: 'If it has a screen, it runs Doom',
      kind: 'causal',
      sources: [],
      status: 'unsourced',
    },
  ],
});

let root: string;
let dir: string;
let commits: string[];
let specs: ClaudeTurnSpec[];

function service(reply = REPLY): ClaimsService {
  const claude: ClaudeRunner = {
    run: (spec) => {
      specs.push(spec);
      return Promise.resolve({
        status: 'completed',
        reply,
        sessionId: undefined,
        message: 'ok',
        usage: undefined,
        limit: undefined,
      });
    },
  };
  return new ClaimsService({
    currentProject: () => dir,
    claude,
    settings: defaultAppSettings,
    now: () => new Date('2026-10-04T10:00:00Z'),
    commit: (_dir, message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    log: createLogger(() => undefined),
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge claims ż-'));
  dir = path.join(root, 'Mój film');
  await cp(EXAMPLE, dir, { recursive: true });
  await writeFile(path.join(dir, 'research.md'), RESEARCH);
  commits = [];
  specs = [];
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('ClaimsService', () => {
  it('starts without claims.json and checks sources with one Sonnet turn (read-only stage)', async () => {
    const claims = service();
    expect(await claims.state()).toEqual({
      status: 'ok',
      file: null,
      hasScript: true,
      scriptChanged: false,
      checking: false,
      problem: null,
    });
    const checked = await claims.check();
    if (checked.status !== 'ok') throw new Error(checked.message);
    expect(checked.warnings).toEqual([]);
    expect(checked.state).toMatchObject({ status: 'ok', checking: false, scriptChanged: false });
    expect(specs[0]).toMatchObject({
      stage: 'critic',
      purpose: 'qa',
      model: 'sonnet',
      newSession: true,
    });
    expect(commits).toEqual(['Check sources']);
    const file = claimsFileSchema.parse(
      JSON.parse(await readFile(path.join(dir, 'claims.json'), 'utf8')),
    );
    expect(file.claims.map((claim) => claim.status)).toEqual(['sourced', 'sourced', 'unsourced']);
  });

  it('applies the user’s edits, commits each, and notices a changed script', async () => {
    const claims = service();
    await claims.check();
    const attached = await claims.edit({
      op: 'attach',
      claimId: 'c3',
      source: { kind: 'note', note: 'Common saying of the porting scene' },
    });
    expect(
      attached.status === 'ok' && attached.state.status === 'ok' && attached.state.file?.claims[2],
    ).toMatchObject({
      status: 'sourced',
      sourceIds: ['u1'],
    });
    const confirmed = await claims.edit({ op: 'status', claimId: 'c1', status: 'user-confirmed' });
    expect(confirmed.status).toBe('ok');
    expect(
      await claims.edit({
        op: 'attach',
        claimId: 'c1',
        source: { kind: 'url', url: 'not a link' },
      }),
    ).toMatchObject({
      status: 'error',
    });
    expect(commits).toEqual(['Check sources', 'Sources: attach c3', 'Sources: status c1']);
    await writeFile(path.join(dir, 'script.txt'), 'A different script.');
    expect(await claims.state()).toMatchObject({ status: 'ok', scriptChanged: true });
  });

  it('reports errors without writing anything', async () => {
    expect(await service('no json').check()).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/^Claude's reply was not usable/) as string,
    });
    expect(await service().edit({ op: 'status', claimId: 'c1', status: 'disputed' })).toEqual({
      status: 'error',
      message: 'No valid claims.json yet: run Check sources first.',
    });
    expect(commits).toEqual([]);
  });
});
