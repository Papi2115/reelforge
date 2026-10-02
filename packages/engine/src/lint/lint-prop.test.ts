import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintModule, lintPropModule } from './lint-prop.js';
import { extractPropMeta } from './prop-meta.js';
import { isPropModulePath } from './prop-rules.js';

const FRIDGE = readFileSync(
  path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'kit-ext', 'fridge.js'),
  'utf8',
);
const FILE = 'kit-ext/props/fridge.js';

function rules(source: string, filename = FILE): string[] {
  return lintPropModule(source, { filename }).map(
    (diagnostic) => `${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}`,
  );
}

const MINIMAL = (body: string, meta = `name: 'lamp', description: 'A desk lamp with a shade'`) =>
  `export const prop = { ${meta}, build(ctx, params) { ${body} } };\n`;

describe('prop module lint', () => {
  it('accepts the reference fridge', () => {
    expect(lintPropModule(FRIDGE, { filename: FILE })).toEqual([]);
  });

  it('applies the scene determinism rules', () => {
    const found = rules(
      MINIMAL('const x = Math.random(); return ctx.kit.voxel.group();'),
      'kit-ext/props/lamp.js',
    );
    expect(found).toEqual([expect.stringMatching(/^error no-random: Math\.random\(\)/)]);
    expect(
      rules(`import x from 'three';\n${MINIMAL('return x;')}`, 'kit-ext/props/lamp.js')[0],
    ).toMatch(/no-import/);
  });

  it('checks the contract: export, build, literal metadata, valid params', () => {
    expect(rules('export const meta = {};', 'kit-ext/props/lamp.js')).toEqual([
      'error prop-contract: The prop module does not export `prop`.',
      'warning prop-contract: The engine only reads `prop`; `meta` is ignored.',
    ]);
    const computed = rules(
      MINIMAL('return null;', `name: 'lamp', description: 'A desk lamp ' + 'with a shade'`),
      'kit-ext/props/lamp.js',
    );
    expect(computed[0]).toMatch(/`prop.description` must be a literal value/);
    const noBuild = rules(
      "export const prop = { name: 'lamp', description: 'A desk lamp with a shade' };",
      'kit-ext/props/lamp.js',
    );
    expect(noBuild).toEqual(['error prop-contract: `prop.build(ctx, params)` is missing.']);
    const badParam = rules(
      MINIMAL(
        'return null;',
        "name: 'lamp', description: 'A desk lamp with a shade', params: { glow: { type: 'number', default: 2, max: 1, description: 'x' } }",
      ),
      'kit-ext/props/lamp.js',
    );
    expect(badParam[0]).toMatch(/params.glow: default must be within min..max/);
    const extra = rules(
      MINIMAL('return null;', "name: 'lamp', description: 'A desk lamp with a shade', helper: 1"),
      'kit-ext/props/lamp.js',
    );
    expect(extra[0]).toMatch(/`prop.helper` is not part of the prop contract/);
  });

  it('requires the name to match the file and not shadow a kit prop', () => {
    expect(rules(MINIMAL('return null;'), 'kit-ext/props/desk.js')[0]).toMatch(
      /`prop.name` is "lamp" but the file is desk.js/,
    );
    const shadow = rules(
      MINIMAL('return null;', "name: 'calculator', description: 'Another calculator, mine'"),
      'kit-ext/props/calculator.js',
    );
    expect(shadow).toEqual([
      'error prop-contract: The kit already has kit.props.calculator; a project prop cannot replace it.',
    ]);
  });

  it('forbids module state written by functions', () => {
    const source = `let calls = 0;\nconst cache = {};\n${MINIMAL('calls += 1; cache.last = params; const local = {}; local.x = 1; return null;')}`;
    expect(rules(source, 'kit-ext/props/lamp.js')).toEqual([
      expect.stringMatching(
        /^error no-module-state-in-prop: A function writes the module-level `calls`/,
      ),
      expect.stringMatching(
        /^error no-module-state-in-prop: A function writes the module-level `cache`/,
      ),
    ]);
  });

  it('picks the mode from the path', () => {
    expect(isPropModulePath('kit-ext/props/fridge.js')).toBe(true);
    expect(isPropModulePath('C:\\p\\kit-ext\\props\\fridge.js')).toBe(true);
    expect(isPropModulePath('scenes/s01.js')).toBe(false);
    expect(lintModule(FRIDGE, { filename: FILE })).toEqual([]);
    const asScene = lintModule(FRIDGE, { filename: 'scenes/fridge.js' });
    expect(asScene.some((diagnostic) => diagnostic.rule === 'scene-contract')).toBe(true);
  });
});

describe('extractPropMeta', () => {
  it('reads the metadata without running the module', () => {
    const result = extractPropMeta(FRIDGE, FILE);
    if (!result.ok) throw new Error(result.error);
    expect(result.meta.name).toBe('fridge');
    expect(Object.keys(result.meta.params)).toEqual(['body', 'open']);
    expect(result.meta.anchors).toEqual({ handle: 'front of the lower door handle (door closed)' });
  });

  it('explains unreadable modules', () => {
    expect(extractPropMeta('export const prop = (', FILE)).toMatchObject({ ok: false });
    expect(extractPropMeta('export const x = 1;', FILE)).toEqual({
      ok: false,
      error: 'kit-ext/props/fridge.js does not export `const prop = { ... }`',
    });
  });
});
