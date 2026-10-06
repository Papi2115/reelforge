import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WORLDS } from '@reelforge/kit';
import type { ProjectFile } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { goldenFrames } from '../testing/slop-fixtures.js';
import { loadAntiSlop, sameCompositionFindings, slopShotFindings } from './guards.js';

const dir = mkdtempSync(path.join(tmpdir(), 'reelforge slop '));
writeFileSync(path.join(dir, 'script.txt'), 'A year has 365 days.');
writeFileSync(path.join(dir, 'research.md'), 'The Julian calendar, 45 BC.');
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const project = (style: string, antiSlopGuards?: boolean): ProjectFile => ({
  version: 1,
  title: 't',
  language: 'en',
  style,
  fps: 30,
  seed: 1,
  ...(antiSlopGuards === undefined ? {} : { antiSlopGuards }),
});

async function load(style: string, world: boolean, antiSlopGuards?: boolean) {
  const loaded = await loadAntiSlop({
    projectDir: dir,
    project: project(style, antiSlopGuards),
    world: world ? WORLDS.find((entry) => entry.id === 'sketchbook') : undefined,
    words: { version: 1, words: [{ text: 'equinox', t: 0, tEnd: 0.4 }] },
    assets: [],
  });
  if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
  return loaded.value;
}

describe('the antiSlopGuards switch', () => {
  it('is on by default for a world style and off for the built-in styles', async () => {
    expect(await load('voxel-pixel-crisp640', false)).toBeUndefined();
    expect(await load('voxel-pixel-crisp640', false, true)).toBeDefined();
    expect(await load('sketchbook', true, false)).toBeUndefined();
    const world = await load('sketchbook', true);
    expect(world?.spec).toBeDefined();
    expect(world?.accent).toEqual([0xd8, 0x34, 0x2b]);
    expect([...(world?.vocabulary.words ?? [])]).toEqual(
      expect.arrayContaining(['year', 'julian', 'equinox']),
    );
    expect(world?.vocabulary.numbers).toEqual(expect.arrayContaining([365, 45]));
  });

  it('adds nothing when off (legacy projects unchanged)', () => {
    const findings = slopShotFindings(undefined, {
      source: `export function build(ctx) { ctx.text.title('LOREM IPSUM'); return {}; }`,
      shot: { scene: 'scenes/s01.js', treatment: 'map' },
      frames: [],
    });
    expect(findings).toEqual([]);
  });

  it('reports slop as warnings that never ask for a fix', async () => {
    const setup = await load('sketchbook', true);
    const findings = slopShotFindings(setup, {
      source: `export function build(ctx) { ctx.text.title('LOREM IPSUM'); return {}; }`,
      shot: { scene: 'scenes/s01.js', treatment: 'map' },
      frames: [],
    });
    expect(findings.map((entry) => [entry.source, entry.severity, entry.fatal])).toEqual([
      ['slop', 'warning', false],
      ['slop', 'warning', false],
    ]);
  });
});

describe('same composition', () => {
  const [image] = goldenFrames(/^look-sketch-story-gregory-t7\.6\.png$/).values();
  if (image === undefined) throw new Error('no golden');
  const frame = { t: 2, image };

  it('flags the later of two consecutive shots with one layout', () => {
    const found = sameCompositionFindings([
      { shot: { id: 's01' }, frame },
      { shot: { id: 's02' }, frame },
      { shot: { id: 's03' }, frame: undefined },
    ]);
    expect([...found.keys()]).toEqual(['s02']);
    expect(found.get('s02')?.[0]?.message).toMatch(/^same composition as s01/);
  });

  it('leaves a continuity link or a continued sentence alone', () => {
    const found = sameCompositionFindings([
      { shot: { id: 's01' }, frame },
      { shot: { id: 's02', continuity: { kind: 'shared-object', object: 'calendar' } }, frame },
      { shot: { id: 's03', continues: true }, frame },
    ]);
    expect(found.size).toBe(0);
  });
});
