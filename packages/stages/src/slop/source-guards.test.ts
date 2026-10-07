import { describe, expect, it } from 'vitest';
import { sketchbookExamples } from '../testing/slop-fixtures.js';
import { countTraces, MIN_HUMAN_TRACES, uniformTimings } from './source-guards.js';
import { parseScene } from './source-text.js';
import { worldSlopSpec } from './world-labels.js';

const SKETCHBOOK = worldSlopSpec('sketchbook');

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const scene = (body: string): string =>
  `export function build(ctx) {\n  const page = ctx.kit.fx.sketchPage({ size: [960, 540] });\n${body}\n  return { page };\n}\nexport function update(t, state) { state.page.update(t); }\n`;

describe('human traces (Sketchbook)', () => {
  if (SKETCHBOOK === undefined) throw new Error('no Sketchbook spec');

  it('finds at least three in every approved template', () => {
    const short = [...sketchbookExamples()].filter(
      ([, source]) => countTraces(program(source), SKETCHBOOK).total < MIN_HUMAN_TRACES,
    );
    expect(short.map(([name]) => name)).toEqual([]);
  });

  it('counts trace helpers, red corrections and rotated lettering, not the default rotation', () => {
    const traces = countTraces(
      program(
        scene(`  page.tape(10, 10, 60, 20, 4);
  page.write('a', { x: 1, y: 2, rot: -2 });
  page.write('b', { x: 1, y: 2, rot: 0, tool: 'red' });
  page.strip({ y: 156, events: [] });`),
      ),
      SKETCHBOOK,
    );
    expect(traces.total).toBe(6);
    expect([...traces.found.keys()]).toEqual([
      'tape',
      'rot (jittered lettering)',
      "tool: 'red' (correction)",
      'strip',
    ]);
  });
});

describe('stagger variance', () => {
  it('finds nothing in the approved templates', () => {
    const flagged = [...sketchbookExamples()].filter(
      ([, source]) => uniformTimings(program(source)).length > 0,
    );
    expect(flagged.map(([name]) => name)).toEqual([]);
  });

  it('flags four siblings with the same gap, the same duration or a linear loop', () => {
    const gaps = uniformTimings(
      program(
        scene(`  page.write('a', { x: 1, y: 1, at: 1.0 });
  page.write('b', { x: 1, y: 2, at: 1.5 });
  page.write('c', { x: 1, y: 3, at: 2.0 });
  page.write('d', { x: 1, y: 4, at: 2.5 });`),
      ),
    );
    expect(gaps.map((entry) => entry.what)).toEqual([
      'write() calls start at the same gap (0.5 s)',
    ]);
    const durations = uniformTimings(
      program(
        scene(`  page.stroke([0, 0, 9, 9], { at: 0.3, dur: 0.4 });
  page.stroke([0, 0, 9, 9], { at: 0.9, dur: 0.4 });
  page.stroke([0, 0, 9, 9], { at: 1.2, dur: 0.4 });
  page.stroke([0, 0, 9, 9], { at: 2.0, dur: 0.4 });`),
      ),
    );
    expect(durations.map((entry) => entry.what)).toEqual(['stroke() calls all last 0.4 s']);
    const loop = uniformTimings(
      program(
        scene(
          `  for (let i = 0; i < 6; i += 1) page.write('x', { x: i, y: 1, at: 0.5 + i * 0.1 });`,
        ),
      ),
    );
    expect(loop.map((entry) => entry.what)).toEqual([
      '6 items start exactly 0.1 s apart (at: … i × 0.1)',
    ]);
  });

  it('accepts varied gaps, jittered loops, short runs and one-gesture tick runs', () => {
    const varied = scene(`  page.write('a', { x: 1, y: 1, at: 1.0, dur: 0.3 });
  page.write('b', { x: 1, y: 2, at: 1.45, dur: 0.3 });
  page.write('c', { x: 1, y: 3, at: 2.05, dur: 0.5 });
  page.write('d', { x: 1, y: 4, at: 2.4, dur: 0.3 });
  for (let i = 0; i < 6; i += 1) page.stroke([0, 0], { at: 3 + i * 0.1 + ctx.rng() * 0.05 });
  for (let i = 0; i < 3; i += 1) page.stroke([0, 0], { at: 4 + i * 0.2 });
  for (let i = 1; i <= 5; i += 1) page.stroke([0, 0], { at: 5 + i * 0.035, dur: 0.03 });`);
    expect(uniformTimings(program(varied))).toEqual([]);
  });
});
