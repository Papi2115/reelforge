/**
 * The Grim Ink quality-lab films (PLAN.md#14.17, docs/worlds/c-cam-lab-report.md):
 * `packages/kit/examples/c-cam/lab/<id>/` holds what the real pipeline produced when the Coder
 * played the model (direction, storyboard, people and places modules, scenes). They double as
 * few-shot references, so they must stay valid: the plan and the storyboard parse, every module
 * passes the ink-module lint and the step's own check (validators, signature gag), every scene
 * passes the scene lint and draws only the film's own people and places.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { hasErrors, lintInkModule, lintScene } from '@reelforge/engine';
import { directionFileSchema, storyboardFileSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { checkInkModule } from './load.js';

const LAB = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'c-cam', 'lab');
const FILMS = readdirSync(LAB);
const read = (...parts: string[]): string => readFileSync(path.join(LAB, ...parts), 'utf8');
const files = (film: string, folder: string): string[] =>
  readdirSync(path.join(LAB, film, folder)).filter((name) => name.endsWith('.js'));
const ids = (film: string, folder: string): Set<string> =>
  new Set(files(film, folder).map((name) => name.replace(/\.js$/, '')));

describe.each(FILMS)('lab film %s', { timeout: 60_000 }, (film) => {
  it('has a direction plan and a storyboard that parse', () => {
    const plan = directionFileSchema.parse(JSON.parse(read(film, 'direction.json')));
    const board = storyboardFileSchema.parse(JSON.parse(read(film, 'storyboard.json')));
    expect(board.shots.length).toBeGreaterThan(1);
    expect(new Set(plan.cast.map((person) => person.id))).toEqual(ids(film, 'people'));
  });

  it('has clean people and places modules', () => {
    for (const kind of ['people', 'places'] as const) {
      for (const name of files(film, kind)) {
        const file = `kit-ext/${kind}/${name}`;
        const source = read(film, kind, name);
        expect(lintInkModule(source, { filename: file }, kind), file).toEqual([]);
        const check = checkInkModule(kind, file, source);
        expect(check.ok, file).toBe(true);
        const findings = check.ok ? (check.report?.findings ?? []) : [];
        const codes = findings.filter((entry) => entry.severity === 'error').map((e) => e.code);
        expect(codes, file).toEqual([]);
        expect(findings.map((entry) => entry.code)).not.toContain('no-signature-gag');
      }
    }
  });

  it("has scenes that lint clean and draw only the film's own people and places", () => {
    const people = ids(film, 'people');
    const places = ids(film, 'places');
    for (const name of files(film, 'scenes')) {
      const source = read(film, 'scenes', name);
      expect(hasErrors(lintScene(source, { filename: `scenes/${name}` })), name).toBe(false);
      for (const [, id] of source.matchAll(/ctx\.kit\.people\.(\w+)/g)) {
        expect(people.has(id ?? ''), `${name}: people.${String(id)}`).toBe(true);
      }
      for (const [, id] of source.matchAll(/ctx\.kit\.places\.(\w+)/g)) {
        expect(places.has(id ?? ''), `${name}: places.${String(id)}`).toBe(true);
      }
    }
  });
});
