import { readFileSync } from 'node:fs';
import path from 'node:path';
import { missingPropsFileSchema } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { loggingMissingProps, mergeMissingProps, MISSING_PROPS_FILE } from './missing-props.js';
import { TempProjects } from './testing/fixtures.js';

const projects = new TempProjects();
afterEach(() => {
  projects.dispose();
});

const SHOT = {
  id: 's07',
  t0: 0,
  t1: 2,
  treatment: 'metaphor-object',
  intent: 'A prism splits light.',
  scene: 'scenes/s07.js',
} as const;

describe('missing props', () => {
  it('merges names per prop with the shots that use a fallback', () => {
    const first = mergeMissingProps(undefined, ['prism'], 's07', '2026-10-02T10:00:00.000Z');
    const second = mergeMissingProps(first, ['prism', 'abacus'], 's02', '2026-10-02T11:00:00.000Z');
    expect(second.entries).toEqual([
      {
        name: 'abacus',
        shots: ['s02'],
        firstSeenAt: '2026-10-02T11:00:00.000Z',
        lastSeenAt: '2026-10-02T11:00:00.000Z',
      },
      {
        name: 'prism',
        shots: ['s02', 's07'],
        firstSeenAt: '2026-10-02T10:00:00.000Z',
        lastSeenAt: '2026-10-02T11:00:00.000Z',
      },
    ]);
  });

  it('the handler logs to .reelforge/missing-props.json and keeps the shot (skipped)', async () => {
    const dir = projects.create();
    const lines: string[] = [];
    const handler = loggingMissingProps(
      dir,
      createLogger((line) => lines.push(line)),
    );
    const decisions = await Promise.all([
      handler(['prism'], SHOT),
      handler(['lens'], { ...SHOT, id: 's08' }),
    ]);
    expect(decisions).toEqual(['skipped', 'skipped']);
    const file = missingPropsFileSchema.parse(
      JSON.parse(readFileSync(path.join(dir, ...MISSING_PROPS_FILE.split('/')), 'utf8')),
    );
    expect(file.entries.map((entry) => [entry.name, entry.shots])).toEqual([
      ['lens', ['s08']],
      ['prism', ['s07']],
    ]);
    expect(lines.some((line) => line.includes('the kit is missing prism'))).toBe(true);
  });
});
