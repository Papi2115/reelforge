/**
 * The c-cam-build prompt (PLAN.md#14.11) and the coarse check of the modules it asks for: one Opus
 * turn per person or place, the kit's two examples embedded verbatim (with the rule never to
 * reuse their content), the fix section naming the module, and the module shape check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPrompt, promptVariables, renderOutputPaths, renderPrompt } from '../catalog.js';
import { validateInkModuleSource } from './c-cam-build.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'c-cam');
const example = (relative: string): string =>
  readFileSync(path.join(EXAMPLES, relative), 'utf8').replaceAll('\r\n', '\n').trimEnd();
const BAKER = example('people/nightBaker.js');
const ROOM = example('places/bakeryBackRoom.js');

const VARS = {
  folder: 'people',
  id: 'tollClerk',
  noun: 'person',
  binding: 'person',
  person: true,
  brief: "the bridge's toll clerk; axis: a neck as long as his arm",
  shots: 's02: cast: tollClerk | place: tollBooth. The clerk counts coins.',
  narration: 's02: "Every coin was counted twice."',
  style: 'One uneven ink line, muddy flat colour.',
  contract: 'export const person = { … }',
} as const;

describe('c-cam-build prompt', () => {
  it('is an Opus turn writing one module, with the kit examples embedded verbatim', () => {
    const prompt = loadPrompt('c-cam-build');
    expect(prompt).toMatchObject({ version: 1, model: 'opus' });
    expect(prompt.template).toContain(BAKER);
    expect(prompt.template).toContain(ROOM);
    expect(promptVariables('c-cam-build').required).toEqual(
      expect.arrayContaining(['folder', 'id', 'noun', 'brief', 'narration', 'style', 'contract']),
    );
    const paths = renderOutputPaths('c-cam-build', { folder: 'places', id: 'tollBooth' });
    expect(paths.ok && paths.value).toEqual(['kit-ext/places/tollBooth.js']);
  });

  it('shows the person example to a person turn only and names the module in a fix', () => {
    const person = renderPrompt('c-cam-build', VARS);
    if (!person.ok) throw new Error(JSON.stringify(person.error));
    expect(person.value).toContain('Build `kit-ext/people/tollClerk.js` by hand');
    expect(person.value).toContain(BAKER);
    expect(person.value).not.toContain(ROOM);
    expect(person.value).toContain('never reuse its content');
    expect(person.value).not.toContain('This is fix');
    const place = renderPrompt('c-cam-build', {
      ...VARS,
      folder: 'places',
      id: 'tollBooth',
      noun: 'place',
      binding: 'place',
      person: false,
      place: true,
      findings: '- lint errors: …',
      attempt: 2,
    });
    if (!place.ok) throw new Error(JSON.stringify(place.error));
    expect(place.value).toContain(ROOM);
    expect(place.value).not.toContain(BAKER);
    expect(place.value).toContain('This is fix 2 of `kit-ext/places/tollBooth.js`');
    expect(place.value).toContain('reelforge places-preview tollBooth');
  });
});

describe('validateInkModuleSource', () => {
  it('accepts the kit examples', () => {
    expect(validateInkModuleSource(BAKER, 'people', 'nightBaker').issues).toEqual([]);
    expect(validateInkModuleSource(ROOM, 'places', 'bakeryBackRoom').issues).toEqual([]);
  });

  it('reports a wrong export, id, missing drawing and non-determinism', () => {
    const bad = "export const place = { id: 'other', paint() { return Math.random(); } };";
    expect(validateInkModuleSource(bad, 'people', 'clerk').issues.map((i) => i.code)).toEqual([
      'ink-export',
      'ink-id',
      'ink-function',
      'ink-function',
      'ink-forbidden',
    ]);
  });
});
