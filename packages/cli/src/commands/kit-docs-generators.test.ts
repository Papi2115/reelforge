/**
 * `reelforge kit-docs generators` (real run Game B2 #2: 8 of 14 world-assets checks failed on
 * guessed generator options): every generator of each world with every option's allowed values,
 * read from the kit's schemas, each text under the kit-docs output limit.
 */
import { kitCatalog, LOOKS } from '@reelforge/kit';
import { WORLD_ASSET_WORLDS } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { describeGenerators, generatorsTopic, valueText } from './kit-docs-generators.js';
import { describeWorldAssets, kitDocsScope } from './kit-docs-world.js';
import { describeKitName } from './kit-docs.js';

const LIMIT = 28_000;

describe.each(WORLD_ASSET_WORLDS)('kit-docs generators of %s', (world) => {
  it('lists every generator with its options under the output limit', () => {
    const text = describeGenerators(world);
    expect(text.length).toBeLessThan(LIMIT);
    expect(text).toContain(`generators of ${world} for the asset files (assets/${world}/*.json)`);
    expect(text).toMatch(/^colour \(an option typed colour takes one of these\): /m);
    // No option without its allowed values.
    expect(text).not.toMatch(/\?: any\b/);
    expect(text).not.toContain('9007199254740991');
  });

  it('gives one generator option by option, and names the known ones for a typo', () => {
    const all = describeGenerators(world);
    // A generator line is the one followed by its indented options line.
    const first = /^([a-z-]+): [^\n]*\n {2}/m.exec(all)?.[1];
    if (first === undefined) throw new Error('no generator line');
    const one = describeGenerators(world, first);
    expect(one).toContain(`${world} generator ${first}: `);
    expect(one).toContain('options (name?: allowed values = default; ? = may be left out):');
    expect(() => describeGenerators(world, `${first}x`)).toThrow(/did you mean/);
  });
});

describe('kit-docs generators values', () => {
  it('names the values the real run guessed wrong (Game B2)', () => {
    const b2 = describeGenerators('game-b2');
    expect(b2).toContain(
      'kind: deciduous|conifer|palm|bush|grass|flowers|mushrooms|cactus|seaweed|reeds',
    );
    expect(b2).toContain('seed?: int 0..1000000 = 1');
    expect(b2).toContain('horns?: none|antlers|horns|tusks = "none"');
    expect(b2).toContain('leaf?: ramp = "leaf"');
    expect(b2).toMatch(/^ramp \(an option typed ramp takes one of these\): warm, leaf, /m);
    expect(b2).toContain('ramp step like leaf.2');
  });

  it('shows each world its own selector', () => {
    expect(describeGenerators('game-b1')).toContain(
      'tree: generated: { "<id>": { "kind": "tree", ... } } (a sprite)',
    );
    expect(describeGenerators('game-b1')).toContain('size?: 1|2|4');
    expect(describeGenerators('comic')).toContain('person: characters | props | backdrops');
    expect(describeGenerators('comic')).not.toMatch(/; x: number/);
    const sketch = describeGenerators('sketchbook');
    expect(sketch).toContain('figure: a figure: "kind": "figure"');
    expect(sketch).toContain('"draw": "bird"');
    expect(sketch).toContain('action?: perch|fly');
  });

  it('formats ranges, lists, objects and records', () => {
    const lists = { colour: ['ink', 'red'] };
    expect(valueText({ type: 'number', minimum: 0.5, maximum: 2 }, lists)).toBe('number 0.5..2');
    expect(valueText({ type: 'number', exclusiveMinimum: 0 }, lists)).toBe('number >0..');
    expect(valueText({ enum: ['red', 'ink'] }, lists)).toBe('colour');
    expect(valueText({ anyOf: [{ const: 1 }, { const: 2 }] }, lists)).toBe('1|2');
    expect(
      valueText({ type: 'array', items: { enum: ['a', 'b'] }, minItems: 1, maxItems: 3 }, lists),
    ).toBe('a|b[] (1-3 items)');
    expect(
      valueText(
        { type: 'object', properties: { skin: { enum: ['ink', 'red'] } }, required: [] },
        lists,
      ),
    ).toBe('{ skin?: colour }');
    expect(valueText({ type: 'object', additionalProperties: { type: 'string' } }, lists)).toBe(
      '{ "<name>": string }',
    );
  });

  it('is a kit-docs topic, pointed at by world-assets; nothing outside a world', () => {
    expect(generatorsTopic('generators')).toEqual({});
    expect(generatorsTopic('generators.plant')).toEqual({ name: 'plant' });
    expect(generatorsTopic('generator')).toBeUndefined();
    const catalog = kitCatalog([], LOOKS, kitDocsScope('game-b2', true));
    expect(describeKitName(catalog, 'generators', { style: 'game-b2' })).toContain(
      'generators of game-b2',
    );
    expect(describeKitName(catalog, 'generators.icon', { style: 'game-b2' })).toContain(
      'game-b2 generator icon: icons: { "gen": "icon", ... }',
    );
    expect(describeWorldAssets('game-b2', undefined)).toContain('reelforge kit-docs generators');
    expect(describeGenerators('voxel-pixel-crisp640')).toContain('only world projects');
  });
});
