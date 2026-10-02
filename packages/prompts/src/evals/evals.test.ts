/**
 * Prompt evals on fake-claude (CI): every case x stage renders, runs through the SessionManager
 * with stage permissions and validates the canned output. No model call, no subscription use.
 */
import os from 'node:os';
import path from 'node:path';
import { fakeClaudeLauncher } from '@reelforge/fake-claude';
import { CuesFileSchema } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import { PROMPT_IDS } from '../catalog.js';
import { listEvalCases } from './cases.js';
import { runEvals, writeEvalReport, type EvalOptions } from './runner.js';
import type { CuesFile } from '@reelforge/pipeline';

const REPORT_FILE = path.join(import.meta.dirname, '..', '..', 'out', 'evals', 'report.fake.json');

function fakeOptions(name: string): EvalOptions<CuesFile> {
  return {
    mode: 'fake',
    launcher: fakeClaudeLauncher(),
    env: process.env,
    workDir: path.join(os.tmpdir(), `rf prompt evals ${name} ${String(process.pid)}`),
    cuesSchema: CuesFileSchema,
    maxTurns: 100,
  };
}

const failures = (report: Awaited<ReturnType<typeof runEvals>>): string[] =>
  report.results
    .filter((result) => result.status === 'fail')
    .map((result) => `${result.caseId}/${result.stage}: ${JSON.stringify(result.issues)}`);

describe('prompt evals (fake-claude)', () => {
  it('has the three required cases', () => {
    expect(listEvalCases()).toEqual(['en-short-prism', 'en-tech-doom', 'pl-history-apollo']);
  });

  it('every stage of every case passes on canned output', { timeout: 120_000 }, async () => {
    const report = await runEvals(fakeOptions('all'));
    writeEvalReport(REPORT_FILE, report);
    expect(failures(report)).toEqual([]);
    expect(report.summary).toMatchObject({ pass: 3 * PROMPT_IDS.length, fail: 0, skipped: 0 });
    expect(report.results.every((result) => result.turnStatus === 'completed')).toBe(true);
  });

  it(
    'reports a storyboard with three same treatments in a row as a failure',
    { timeout: 30_000 },
    async () => {
      const report = await runEvals({
        ...fakeOptions('bad storyboard'),
        cases: ['en-tech-doom'],
        stages: ['storyboard'],
        canned: (_caseId, _stage, golden) => ({
          ...golden,
          writes: golden.writes.map((write) => ({
            ...write,
            content: write.content.replace(
              '"treatment": "montage/transition"',
              '"treatment": "3d-reconstruction"',
            ),
          })),
        }),
      });
      expect(report.summary.fail).toBe(1);
      expect(report.results[0]?.issues.map((entry) => entry.code)).toContain('treatment-run');
    },
  );

  it('reports a missing output file and a wrong MISSING line', { timeout: 30_000 }, async () => {
    const report = await runEvals({
      ...fakeOptions('missing output'),
      cases: ['en-short-prism'],
      stages: ['scene-build'],
      canned: () => ({ reply: 'Built it.\nMISSING: lamp', writes: [] }),
    });
    const codes = report.results[0]?.issues.map((entry) => entry.code);
    expect(codes).toEqual(expect.arrayContaining(['missing-output', 'missing-line']));
  });

  it('stops at the turn cap and reports the rest as skipped', { timeout: 30_000 }, async () => {
    const report = await runEvals({
      ...fakeOptions('cap'),
      cases: ['en-short-prism'],
      stages: ['storyboard', 'critic', 'sound-cues'],
      maxTurns: 1,
    });
    expect(report.results.map((result) => result.status)).toEqual(['pass', 'skipped', 'skipped']);
  });
});
