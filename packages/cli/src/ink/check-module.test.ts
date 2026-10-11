/**
 * The validators in the build loop (PLAN.md#14.18): `reelforge people-preview` and the build
 * step's QA print the same compact list of `validateCharacter` findings, so a build or fix turn
 * sees the failures that would turn its person into a placeholder (the real run's champion:
 * `hand-in-head` in the jig, `contact-miss` in the handshake).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VALIDATOR_MAX_LINES, checkInkModule, validatorLines } from './check-module.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'c-cam');
const BAKER = readFileSync(path.join(EXAMPLES, 'people', 'nightBaker.js'), 'utf8');
const BAKER_HEAD = 'head: { x: [0, 26, 49, 0], top: -872, bottom: -614, hw: 86 }';
const FILE = 'kit-ext/people/nightBaker.js';

function linesOf(source: string): string[] {
  const check = checkInkModule('people', FILE, source);
  if (!check.ok) throw new Error(check.error);
  return validatorLines(check.report?.findings ?? []);
}

describe('validators in the people preview', { timeout: 60_000 }, () => {
  it('lists a deliberately broken person by rule, errors first, with the fix', () => {
    expect(BAKER).toContain(BAKER_HEAD);
    // A face guard that stops above the chin: palms land inside the head in the jig.
    const shallow = linesOf(BAKER.replace(BAKER_HEAD, BAKER_HEAD.replace('-614', '-720')));
    expect(shallow[0]).toMatch(/^validators: \d+ error case\(s\)/);
    const handInHead = shallow.find((line) => line.includes('hand-in-head'));
    expect(handInHead).toMatch(/^ {2}ERROR hand-in-head \(\d+ cases\), first at view .*pose jig/);
    expect(handInHead).toContain('; fix: ');
    // A guard box over the chest pushes every palm off its goal: the handshake misses.
    const chest = 'head: { x: [0, 0, 0, 0], top: -900, bottom: -300, hw: 200 }';
    const missing = linesOf(BAKER.replace(BAKER_HEAD, chest));
    expect(missing.some((line) => /^ {2}ERROR contact-miss/.test(line))).toBe(true);
    for (const lines of [shallow, missing]) {
      expect(lines.length).toBeLessThanOrEqual(VALIDATOR_MAX_LINES);
      const levels = lines.slice(1).map((line) => line.trim().split(' ')[0]);
      // errors before warnings
      expect(levels.join(',')).toMatch(/^(ERROR,?)*(warn,?)*$/);
    }
  });

  it('says ok for the kit example and keeps its warnings visible', () => {
    const lines = linesOf(BAKER);
    expect(lines.every((line) => !line.includes('ERROR'))).toBe(true);
    expect(lines[0]).toMatch(/^validators: (ok|0 error)/);
  });

  it('folds many cases of one rule into one line', () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      code: 'hand-in-head' as const,
      severity: 'error' as const,
      view: index,
      pose: 'jig',
      message: 'm',
      fix: 'f',
      measured: 1,
      limit: 0,
    }));
    expect(validatorLines(many)).toEqual([
      'validators: 40 error case(s), 0 warning case(s), by rule:',
      '  ERROR hand-in-head (40 cases), first at view 0, pose jig: m; fix: f',
    ]);
    expect(validatorLines([])).toEqual(['validators: ok (no findings)']);
  });
});
