/**
 * Dramaturgy (PLAN.md#12.25–12.27): project switches, the storyboard `interrupt` marker and its
 * rules, the interrupt report, loops.json and its ⚠ analysis, moment proposals and their effects.
 */
import { describe, expect, it } from 'vitest';
import { projectOpenLoops, projectPatternInterrupts, projectRevealMoments } from './dramaturgy.js';
import {
  buildInterruptReport,
  cameraMovesIn,
  interruptDirective,
  interruptKindProblem,
  interruptRange,
  targetInterruptRate,
} from './interrupts.js';
import { analyzeLoops, loopsFileSchema, type LoopsFile } from './loops.js';
import {
  mergeMoments,
  momentMixEffects,
  momentRenderEffects,
  momentsFileSchema,
  proposeMoments,
  tensionPeaks,
  type Moment,
} from './moments.js';
import { projectFileSchema } from './project.js';
import { storyboardShotSchema } from './storyboard.js';

const PROJECT = {
  version: 1,
  title: 'T',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 1,
};

describe('dramaturgy switches', () => {
  it('read a missing switch as off and accept auto', () => {
    const old = projectFileSchema.parse(PROJECT);
    expect(projectPatternInterrupts(old)).toBe('off');
    expect(projectOpenLoops(old)).toBe('off');
    expect(projectRevealMoments(old)).toBe('off');
    const next = projectFileSchema.parse({
      ...PROJECT,
      patternInterrupts: 'auto',
      openLoops: 'auto',
      revealMoments: 'auto',
    });
    expect([
      projectPatternInterrupts(next),
      projectOpenLoops(next),
      projectRevealMoments(next),
    ]).toEqual(['auto', 'auto', 'auto']);
    expect(projectFileSchema.safeParse({ ...PROJECT, openLoops: 'on' }).success).toBe(false);
  });
});

const shot = (id: string, t0: number, t1: number, extra: Record<string, unknown> = {}) => ({
  id,
  t0,
  t1,
  treatment: 'metaphor-object' as const,
  intent: 'x',
  scene: `scenes/${id}.js`,
  ...extra,
});

describe('interrupt marker and rules', () => {
  it('is an optional, additive storyboard field', () => {
    expect(storyboardShotSchema.safeParse(shot('s01', 0, 4)).success).toBe(true);
    const marked = shot('s02', 4, 8, { interrupt: { kind: 'scale-shift', note: 'zoom out' } });
    expect(storyboardShotSchema.parse(marked).interrupt?.kind).toBe('scale-shift');
    expect(
      storyboardShotSchema.safeParse(shot('s02', 4, 8, { interrupt: { kind: 'boom', note: 'x' } }))
        .success,
    ).toBe(false);
  });

  it('allows 1-2 per minute (scaled) and more at high tension', () => {
    expect(interruptRange(180)).toEqual({ min: 3, max: 6 });
    expect(interruptRange(30)).toEqual({ min: 0, max: 1 });
    expect(targetInterruptRate(0)).toBe(1);
    expect(targetInterruptRate(1)).toBe(2);
    expect(targetInterruptRate(undefined)).toBe(1.5);
  });

  it('checks the kind against the look pair', () => {
    expect(interruptKindProblem('look-switch', { from: 'voxel', to: 'retro-ui' })).toBeUndefined();
    expect(interruptKindProblem('look-switch', { from: 'voxel', to: 'voxel' })).toContain(
      'different look',
    );
    expect(
      interruptKindProblem('enter-screen', { from: 'diorama', to: 'retro-ui' }),
    ).toBeUndefined();
    expect(interruptKindProblem('enter-screen', { from: 'diorama', to: 'blueprint' })).toContain(
      'retro-ui',
    );
    expect(interruptKindProblem('scale-shift', { from: 'retro-ui', to: 'voxel' })).toBeUndefined();
    expect(interruptKindProblem('perspective-shift', { from: 'voxel', to: 'blueprint' })).toContain(
      'camera move',
    );
  });

  it('finds the 12.28 camera moves in a scene source (orbit move, not the rig)', () => {
    const source = `ctx.camera.dollyZoom({ from: 6, to: 3, t0: 0, t1: 1 });
      ctx.camera.orbit({ radius: 5, degrees: [0, 90] })(t);
      ctx.camera.rackFocus({ from: 2, to: 5, t0: 1, t1: 2 });`;
    expect(cameraMovesIn(source)).toEqual(['dollyZoom', 'rackFocus']);
    expect(cameraMovesIn('ctx.camera.orbit({ degrees: 40, t0: 1, t1: 3 })')).toEqual(['orbit']);
  });

  it('reports planned vs realised per minute', () => {
    const shots = [
      shot('s01', 0, 20, { look: 'voxel' }),
      shot('s02', 20, 40, {
        look: 'retro-ui',
        transitionIn: { type: 'glitch', duration: 0.7, style: 'crt-zoom' },
        interrupt: { kind: 'enter-screen', note: 'into the CRT' },
      }),
      shot('s03', 40, 70, {
        look: 'voxel',
        interrupt: { kind: 'scale-shift', note: 'the room shrinks' },
      }),
      shot('s04', 70, 100, {
        look: 'voxel',
        interrupt: { kind: 'perspective-shift', note: 'orbit' },
      }),
    ];
    const sources = new Map([
      ['s03', 'ctx.camera.dollyZoom({ from: 8, to: 3, t0: 0, t1: 1 })'],
      ['s04', 'ctx.camera.pushIn({ dist: [7, 5] })(t)'],
    ]);
    const report = buildInterruptReport(shots, sources);
    expect(report).toMatchObject({ planned: 3, realised: 2, durationS: 100 });
    expect(report.perMinute).toEqual([
      { minute: 0, planned: 2, realised: 2 },
      { minute: 1, planned: 1, realised: 0 },
    ]);
    expect(report.shots.map((entry) => entry.realisedBy)).toEqual([
      'transition crt-zoom',
      'camera dollyZoom',
      null,
    ]);
  });

  it('turns a marker into a scene-build directive with the camera API', () => {
    const marked = shot('s03', 40, 70, { interrupt: { kind: 'scale-shift', note: 'shrinks' } });
    expect(interruptDirective(marked, undefined)).toContain('ctx.camera.dollyZoom');
    expect(interruptDirective(shot('s01', 0, 4), undefined)).toBe('');
  });
});

const LOOPS: LoopsFile = {
  version: 1,
  loops: [
    {
      id: 'why-red',
      question: 'why does red bend the least?',
      openedAt: { t: 4, shotId: 's01', phrase: 'show you' },
      plannedCloseAt: { t: 30, shotId: 's04' },
      closedAt: { t: 31, shotId: 's04', phrase: 'violet' },
      foreshadowed: true,
      status: 'closed',
    },
    {
      id: 'the-secret',
      question: 'what is the secret?',
      openedAt: { t: 10 },
      plannedCloseAt: { t: 50 },
      foreshadowed: false,
      status: 'open',
    },
    {
      id: 'backwards',
      question: 'who came first?',
      openedAt: { t: 40 },
      plannedCloseAt: { t: 45 },
      closedAt: { t: 20, shotId: 's99' },
      foreshadowed: false,
      status: 'closed',
    },
  ],
};

describe('open loops', () => {
  it('validates loops.json (unique ids)', () => {
    expect(loopsFileSchema.safeParse(LOOPS).success).toBe(true);
    const duplicate = { ...LOOPS, loops: [LOOPS.loops[0], LOOPS.loops[0]] };
    expect(loopsFileSchema.safeParse(duplicate).success).toBe(false);
  });

  it('warns: never closed, closed without a foreshadow, closed before it opens', () => {
    const words = [
      { text: 'show', t: 4 },
      { text: 'you', t: 4.3 },
      { text: 'violet', t: 31.2 },
    ];
    const shots = [
      { id: 's01', t0: 0, t1: 20 },
      { id: 's04', t0: 20, t1: 60 },
    ];
    const warnings = analyzeLoops(LOOPS, { shots, words });
    expect(warnings.map((warning) => [warning.loopId, warning.code])).toEqual([
      ['the-secret', 'loop-unclosed'],
      ['backwards', 'loop-close-before-open'],
      ['backwards', 'loop-no-foreshadow'],
      ['backwards', 'loop-unknown-shot'],
    ]);
    expect(warnings.every((warning) => warning.message.startsWith('⚠ loop'))).toBe(true);
  });
});

const WORDS = [
  { text: 'It', t: 50, tEnd: 50.2 },
  { text: 'was', t: 50.3, tEnd: 50.5 },
  { text: 'gone.', t: 50.6, tEnd: 51 },
  { text: 'Forever.', t: 51.6, tEnd: 52.2 },
  { text: 'And', t: 52.3, tEnd: 52.5 },
  { text: 'then', t: 52.6, tEnd: 52.9 },
];
const SHOTS = [
  { id: 's01', t0: 0, t1: 48 },
  { id: 's02', t0: 48, t1: 56 },
  { id: 's03', t0: 56, t1: 200 },
];
const CURVE = [
  { t: 0, v: 0.2 },
  { t: 51, v: 0.92 },
  { t: 120, v: 0.3 },
  { t: 200, v: 0.2 },
];

describe('reveal moments', () => {
  it('finds the peaks above the threshold', () => {
    expect(tensionPeaks(CURVE, 3)).toEqual([{ t: 51, v: 0.92 }]);
  });

  it('proposes a silence hit in the pause before the anchored key word (pure)', () => {
    const inputs = {
      shots: SHOTS,
      tension: CURVE,
      words: WORDS,
      anchors: [{ shotId: 's02', t: 51.6 }],
    };
    const proposals = proposeMoments(inputs);
    expect(proposals).toEqual([
      expect.objectContaining({
        kind: 'silence-hit',
        shotId: 's02',
        at: 51.6,
        word: 'Forever.',
        from: 51.02,
        to: 51.6,
        status: 'proposed',
      }),
    ]);
    expect(proposeMoments(inputs)).toEqual(proposals);
    expect(momentsFileSchema.safeParse({ version: 1, moments: proposals }).success).toBe(true);
  });

  it('falls back to slow motion without a pause, never over an anchor', () => {
    const tight = WORDS.map((word) => (word.text === 'gone.' ? { ...word, tEnd: 51.5 } : word));
    const [moment] = proposeMoments({
      shots: SHOTS,
      tension: CURVE,
      words: tight,
      anchors: [
        { shotId: 's02', t: 51.6 },
        { shotId: 's02', t: 53.2 },
      ],
    });
    expect(moment).toMatchObject({ kind: 'slow-motion', from: 51.6, to: 53.15, rate: 0.4 });
  });

  it('merges stored decisions and turns accepted moments into effects', () => {
    const base: Moment = {
      id: 'slow-motion-s02-51600',
      kind: 'slow-motion',
      shotId: 's02',
      at: 51.6,
      word: 'Forever.',
      tension: 0.9,
      from: 51.6,
      to: 53.1,
      rate: 0.4,
      status: 'proposed',
    };
    const flash: Moment = {
      ...base,
      id: 'palette-shift-s02-52600',
      kind: 'palette-shift',
      at: 52.6,
      from: 53.2,
      to: 53.7,
      status: 'accepted',
    };
    const hit: Moment = {
      ...base,
      id: 'silence-hit-s03-60000',
      kind: 'silence-hit',
      shotId: 's03',
      at: 60,
      from: 59.5,
      to: 60,
      status: 'accepted',
    };
    const accepted = { ...base, status: 'accepted' as const };
    const merged = mergeMoments([base], [accepted, flash, hit]);
    expect(merged.map((moment) => moment.status)).toEqual(['accepted', 'accepted', 'accepted']);
    const effects = momentRenderEffects(merged, SHOTS);
    expect(effects.get('s02')).toEqual({
      timeRemap: [{ from: 51.6, to: 53.1, rate: 0.4 }],
      paletteShift: [{ from: 53.2, to: 53.7 }],
    });
    expect(effects.has('s03')).toBe(false);
    expect(momentMixEffects(merged)).toEqual({ silences: [{ from: 59.5, to: 60 }], hits: [60] });
    expect(momentRenderEffects([base], SHOTS).size).toBe(0);
  });
});
