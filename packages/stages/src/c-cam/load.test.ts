/**
 * The step's Node-side checks of a Grim Ink module (PLAN.md#14.11): the kit examples and the
 * placeholders load, keep the contract and (people) pass the validators; a broken module, a
 * contract break, a broken rig and a drawing that never returns are reported, never thrown.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hasErrors, lintInkModule } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import { goldenFile } from '../testing/project.js';
import { checkInkModule } from './load.js';
import { isPlaceholderSource, placeholderSource } from './placeholder.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'c-cam');
const BAKER = readFileSync(path.join(EXAMPLES, 'people', 'nightBaker.js'), 'utf8');
const ROOM = readFileSync(path.join(EXAMPLES, 'places', 'bakeryBackRoom.js'), 'utf8');

const errorsOf = (check: ReturnType<typeof checkInkModule>): string[] =>
  check.ok
    ? (check.report?.findings ?? [])
        .filter((finding) => finding.severity === 'error')
        .map((finding) => `${finding.code}: ${finding.message}`)
    : [check.error];

describe('checkInkModule', { timeout: 60_000 }, () => {
  it('loads the kit examples and runs the validators on the person', () => {
    const baker = checkInkModule('people', 'kit-ext/people/nightBaker.js', BAKER);
    expect(baker.ok && baker.report?.checks['figure-pieces']).toBeGreaterThan(0);
    const room = checkInkModule('places', 'kit-ext/places/bakeryBackRoom.js', ROOM);
    expect(room).toEqual({ ok: true, report: undefined });
  });

  it('writes placeholders that pass the lint, the contract and the validators', () => {
    for (const kind of ['people', 'places'] as const) {
      const file = `kit-ext/${kind}/oldClerk.js`;
      const source = placeholderSource(kind, 'oldClerk', "The clerk's stand-in");
      expect(isPlaceholderSource(source)).toBe(true);
      const lint = lintInkModule(source, { filename: file }, kind);
      expect(hasErrors(lint), JSON.stringify(lint)).toBe(false);
      expect(errorsOf(checkInkModule(kind, file, source))).toEqual([]);
    }
  });

  it("keeps the prompt evals' golden place module valid", () => {
    const file = 'kit-ext/places/workRoom.js';
    const source = goldenFile(file);
    expect(hasErrors(lintInkModule(source, { filename: file }, 'places'))).toBe(false);
    expect(checkInkModule('places', file, source)).toEqual({ ok: true, report: undefined });
  });

  it('reports a syntax error, a contract break, a broken rig and a hang', () => {
    const syntax = checkInkModule('places', 'kit-ext/places/a.js', 'export const place = {');
    expect(syntax.ok).toBe(false);
    const contract = checkInkModule(
      'places',
      'kit-ext/places/b.js',
      "export const place = { id: 'b', name: 'B', bounds: [10, 10], draw() {} };",
    );
    expect(errorsOf(contract).join('\n')).toMatch(/bounds/);
    const stand = placeholderSource('people', 'clerk', 'Clerk');
    const raised = stand.replace('sy: -540,', 'sy: -760,');
    const broken = errorsOf(checkInkModule('people', 'kit-ext/people/clerk.js', raised));
    expect(broken.join('\n')).toMatch(/shoulder/);
    const hang = BAKER.replace('torso(g, ink, view) {', 'torso(g, ink, view) {\n    for (;;) {}');
    const hung = checkInkModule('people', 'kit-ext/people/nightBaker.js', hang, 300);
    expect(hung.ok ? 'loaded' : hung.error).toMatch(/timed out/);
  });
});
