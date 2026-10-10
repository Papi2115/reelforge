import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { inkModuleKindOfPath, lintInkModule } from './lint-ink-module.js';
import { lintModule } from './lint-prop.js';
import { describeLintErrors, lintManifestKitExtensions } from './manifest.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'c-cam');
const PERSON = readFileSync(path.join(EXAMPLES, 'people', 'nightBaker.js'), 'utf8');
/** The sample without its signature gag (PLAN.md#14.15): a lint warning, not an error. */
const NO_GAG_PERSON = PERSON.replace(/^ {2}signatureGag: \{[^}]*\},\n/m, '');
const PLACE = readFileSync(path.join(EXAMPLES, 'places', 'bakeryBackRoom.js'), 'utf8');
const PERSON_FILE = 'kit-ext/people/nightBaker.js';
const PLACE_FILE = 'kit-ext/places/bakeryBackRoom.js';

function rules(source: string, file: string, kind: 'people' | 'places'): string[] {
  return lintInkModule(source, { filename: file }, kind)
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => `${diagnostic.rule}: ${diagnostic.message}`);
}

const PLACE_HEAD = `export const place = { id: 'room', name: 'Room', bounds: [1920, 1080], draw(g, ink, t, opts) {`;

describe('lint of Grim Ink people / places modules (PLAN.md#14.8)', () => {
  it('passes the sample person and place, also through lintModule by path', () => {
    expect(lintInkModule(PERSON, { filename: PERSON_FILE }, 'people')).toEqual([]);
    expect(lintInkModule(PLACE, { filename: PLACE_FILE }, 'places')).toEqual([]);
    expect(
      lintModule(PERSON, { filename: `C:\\film\\${PERSON_FILE.replaceAll('/', '\\')}` }),
    ).toEqual([]);
    expect(inkModuleKindOfPath('kit-ext/places/room.js')).toBe('places');
    expect(inkModuleKindOfPath('kit-ext/props/room.js')).toBeUndefined();
    expect(inkModuleKindOfPath('kit-ext/people/Bad-Name.js')).toBeUndefined();
  });

  it('reports the scene determinism rules and module state', () => {
    const random = PLACE.replace(
      'const x = ink.time.rnd(0, 2200, 10, i);',
      'const x = Math.random() * 2200;',
    );
    expect(rules(random, PLACE_FILE, 'places')).toEqual([expect.stringMatching(/^no-random/)]);
    const state = `let calls = 0;\n${PLACE_HEAD} calls += 1; } };`;
    expect(rules(state, 'kit-ext/places/room.js', 'places')).toEqual([
      expect.stringMatching(/^no-module-state-in-prop: A function writes the module-level `calls`/),
    ]);
  });

  it('enforces the ink grammar (text, gradients, filters, images) but allows Array.filter', () => {
    const source = `${PLACE_HEAD}
      g.fillText('OPEN', 10, 10);
      const grad = g.createLinearGradient(0, 0, 1, 1);
      g.filter = 'blur(2px)';
      g.drawImage(grad, 0, 0);
      const kept = [1, 2].filter((v) => v > 1);
      g.fillRect(0, 0, kept.length, grad ? 1 : 2);
    } };`;
    const found = rules(source, 'kit-ext/places/room.js', 'places');
    expect(found).toEqual([
      expect.stringMatching(/^ink-grammar: `fillText` is outside the Grim Ink grammar \(text/),
      expect.stringMatching(/^ink-grammar: `createLinearGradient`/),
      expect.stringMatching(/^ink-grammar: `filter`/),
      expect.stringMatching(/^ink-grammar: `drawImage`/),
    ]);
  });

  it('checks the contract: export, id = file name, functions, literal data, length', () => {
    expect(rules(PERSON, 'kit-ext/people/baker.js', 'people')).toEqual([
      expect.stringMatching(/`person.id` is "nightBaker" but the file is baker\.js/),
    ]);
    const headless = PERSON.replace('  head(g, ink, view, face) {', '  face(g, ink, view, face) {');
    expect(rules(headless, PERSON_FILE, 'people')).toEqual([
      expect.stringMatching(/`person.head\(\.\.\.\)` is missing/),
    ]);
    expect(rules('export default {};', PLACE_FILE, 'places')).toEqual([
      expect.stringMatching(/not a default export/),
      expect.stringMatching(/does not export `place`/),
    ]);
    const badBounds = PLACE.replace('bounds: [2200, 1080]', 'bounds: [2200, 10]');
    expect(rules(badBounds, PLACE_FILE, 'places')).toEqual([
      expect.stringMatching(/`place` data is invalid: bounds\.1/),
    ]);
    const computedId = PLACE.replace("id: 'bakeryBackRoom'", 'id: NAME');
    expect(rules(`const NAME = 'x';\n${computedId}`, PLACE_FILE, 'places')).toEqual([
      expect.stringMatching(/`place.id` must be a string literal/),
    ]);
    const long = `${PLACE}${'\n'.repeat(200)}`;
    expect(rules(long, PLACE_FILE, 'places')).toEqual([
      expect.stringMatching(/lines; one person \/ place stays within 250/),
    ]);
  });

  it('warns a person without a signature gag and accepts place options and a foreground', () => {
    expect(NO_GAG_PERSON).not.toBe(PERSON);
    const plain = lintInkModule(NO_GAG_PERSON, { filename: PERSON_FILE }, 'people');
    expect(plain.map((d) => `${d.severity} ${d.message}`)).toEqual([
      expect.stringMatching(/^warning The person has no `signatureGag`/),
    ]);
    const front = `${PLACE_HEAD} ink.rect(0, 0, 10, 10, opts.c || '#000'); }, foreground(g, ink, t, opts) { ink.rect(0, 0, 5, 5, '#111'); } };`;
    expect(lintInkModule(front, { filename: 'kit-ext/places/room.js' }, 'places')).toEqual([]);
    const notFn = `${PLACE_HEAD} }, foreground: 3 };`;
    expect(rules(notFn, 'kit-ext/places/room.js', 'places')).toEqual([
      expect.stringMatching(/`place.foreground` must be a plain synchronous function/),
    ]);
  });

  it('lints manifest people / places only in the Grim Ink style', () => {
    const bad = PLACE.replace('ink.crack(240', 'Date.now(); ink.crack(240');
    const manifest = {
      kitExtensions: [{ name: 'bakeryBackRoom', file: PLACE_FILE, source: bad, kind: 'places' }],
    } as Pick<RenderManifest, 'kitExtensions'>;
    expect(lintManifestKitExtensions({ ...manifest, style: 'crisp' } as RenderManifest)).toEqual(
      [],
    );
    const results = lintManifestKitExtensions({ ...manifest, style: 'c-cam' } as RenderManifest);
    expect(results.map((entry) => entry.shotId)).toEqual(['kit-ext:places/bakeryBackRoom']);
    expect(describeLintErrors(results)).toMatch(
      /\[kit-ext:places\/bakeryBackRoom\]\nkit-ext\/places\/bakeryBackRoom\.js:\d+:\d+ {2}error {2}no-wall-clock/,
    );
  });
});
