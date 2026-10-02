import { describe, expect, it } from 'vitest';
import { scenesReportSchema, syncReportSchema } from './index.js';

const STAMP = '2026-10-02T10:00:00.000Z';

describe('scenesReportSchema', () => {
  it('accepts a shot record with findings and critic verdicts', () => {
    const parsed = scenesReportSchema.safeParse({
      version: 1,
      updatedAt: STAMP,
      shots: [
        {
          shotId: 's07',
          scene: 'scenes/s07.js',
          status: 'warning',
          findings: [
            {
              source: 'missing-prop',
              severity: 'warning',
              fatal: false,
              message: 'missing prop: prism',
            },
          ],
          fixIterations: 0,
          missingProps: ['prism'],
          critic: [{ verdict: 'ok', note: 'fine' }],
          contactSheet: '.reelforge/frames/qa/s07/build-r0.png',
          notes: [],
          updatedAt: STAMP,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects unknown statuses and finding sources', () => {
    const record = {
      shotId: 's01',
      scene: 'scenes/s01.js',
      status: 'done',
      findings: [{ source: 'vibes', severity: 'error', fatal: false, message: 'x' }],
      fixIterations: 0,
      missingProps: [],
      critic: [],
      notes: [],
      updatedAt: STAMP,
    };
    const parsed = scenesReportSchema.safeParse({ version: 1, updatedAt: STAMP, shots: [record] });
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual([
      'shots.0.status',
      'shots.0.findings.0.source',
    ]);
  });
});

describe('syncReportSchema', () => {
  it('accepts matched, free and failed shots', () => {
    const parsed = syncReportSchema.safeParse({
      version: 1,
      createdAt: STAMP,
      toleranceMs: 150,
      shots: [
        {
          shotId: 's01',
          t0: 0,
          t1: 2,
          events: [
            {
              kind: 'sfx',
              label: 'hit',
              t: 0.7,
              spokenT: 0.6,
              phrase: 'one lands',
              deltaMs: 100,
              verdict: 'ok',
            },
            {
              kind: 'cue',
              label: 'whoosh',
              t: 1.9,
              spokenT: null,
              phrase: null,
              deltaMs: null,
              verdict: 'free',
            },
          ],
          problems: 0,
          maxDeltaMs: 100,
        },
        {
          shotId: 's02',
          t0: 2,
          t1: 4,
          events: [],
          problems: 0,
          maxDeltaMs: null,
          error: 'no scene',
        },
      ],
      summary: { shots: 2, events: 2, ok: 1, problems: 0, failedShots: 1 },
    });
    expect(parsed.success).toBe(true);
  });
});
