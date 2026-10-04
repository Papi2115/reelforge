import type { KitCatalog } from '@reelforge/kit';
import { SFX_CATEGORY, SFX_RECIPES } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import { describeKitName, exampleCall, formatCatalog, typeSummary } from './kit-docs.js';

const calculator = {
  kind: 'prop' as const,
  name: 'calculator',
  description: 'Graphing calculator with a screen.',
  params: {
    type: 'object',
    properties: {
      screen: { type: 'string', enum: ['off', 'doom'], description: 'What the screen shows' },
      size: { type: 'number', default: 1 },
      at: { type: 'array', prefixItems: [{ type: 'number' }, { type: 'number' }] },
    },
    required: ['screen'],
  },
  anchors: { screen: 'centre of the screen' },
};

const catalog: KitCatalog = {
  version: '9.9.9',
  looks: [],
  voxel: { box: { signature: 'box([sx, sy, sz], color) -> model', description: 'Solid box.' } },
  env: [],
  props: [calculator],
  fx: [],
};

describe('kit-docs formatting', () => {
  it('summarizes JSON Schema types', () => {
    expect(typeSummary({ enum: ['a', 'b'] })).toBe('"a"|"b"');
    expect(typeSummary({ type: 'array', items: { type: 'integer' } })).toBe('int[]');
    expect(typeSummary({ anyOf: [{ type: 'number' }, { type: 'string' }] })).toBe('number|string');
  });

  it('lists every function on one line with params', () => {
    const text = formatCatalog(catalog);
    expect(text).toContain('kit 9.9.9');
    expect(text).toContain('kit.voxel.box([sx, sy, sz], color) -> model — Solid box.');
    expect(text).toContain(
      'kit.props.calculator({ screen: "off"|"doom", size?: number = 1, at?: [number, number] }) — Graphing calculator with a screen.',
    );
    expect(text).toContain('kit.env: (none yet)');
  });

  it('marks entries of looks other than voxel, listed only in mixed projects (ADR-009)', () => {
    const tagged: KitCatalog = {
      ...catalog,
      props: [
        { ...calculator, look: 'voxel' },
        { ...calculator, name: 'crtMonitor', look: 'retro-ui' },
      ],
    };
    const text = formatCatalog(tagged, { lookMode: 'mixed' });
    expect(text).toContain('kit.props.calculator({ screen: "off"|"doom", size?: number = 1');
    expect(text).not.toContain('(look voxel)');
    expect(text).toContain('  kit.props.crtMonitor (look retro-ui) — Graphing calculator');
    expect(formatCatalog(tagged)).not.toContain('crtMonitor');
  });

  it('describes a function by any of its names, with anchors and an example', () => {
    for (const name of ['calculator', 'props.calculator', 'kit.props.calculator']) {
      expect(describeKitName(catalog, name)).toContain('screen — centre of the screen');
    }
    expect(exampleCall(calculator)).toBe(
      'const calculator = kit.props.calculator({ screen: "off", size: 1 });',
    );
    expect(describeKitName(catalog, 'box')).toBe(
      'kit.voxel.box([sx, sy, sz], color) -> model\n  Solid box.',
    );
    expect(() => describeKitName(catalog, 'env.calculator')).toThrow(/no kit function/);
  });

  it('answers the scene-context names scene authors ask for (camera, text, ...)', () => {
    const camera = describeKitName(catalog, 'camera');
    expect(camera).toContain('pushIn({ dist: [start, end]');
    expect(camera).toContain('orbit({ radius, degrees: [start, end]');
    expect(describeKitName(catalog, 'ctx.camera')).toBe(camera);
    const text = describeKitName(catalog, 'text');
    // Generated from the engine schemas: the real option names and defaults.
    expect(text).toMatch(
      /title\(text, \{ id\?: string, at\?: number = 0, .*pos\?: \[number, number\] = \[0\.5,0\.5\]/,
    );
    expect(text).toMatch(
      /lowerThird\(primary, secondary \| null, \{ .*side\?: "left"\|"right" = "left"/,
    );
    expect(text).toMatch(/kinetic\(words: .*perWordDelay\?: number = 0\.25/);
    expect(describeKitName(catalog, 'ease')).toContain('easeOutBack');
    // Every built-in SFX from the pipeline's source of truth, with its variants and use.
    const sfx = describeKitName(catalog, 'sfx');
    for (const name of SFX_RECIPES) expect(sfx).toContain(`  ${name} (${SFX_CATEGORY[name]}; `);
    expect(sfx).toContain('whoosh (motion; fast/slow/up/down/air): ');
    const all = describeKitName(catalog, 'ctx');
    for (const part of [
      'ctx.camera',
      'ctx.text',
      'ctx.anchor',
      'ctx.sfx.at',
      'ctx.rng',
      'ctx.ease',
      'ctx.ambient',
    ]) {
      expect(all).toContain(part);
    }
    const ambient = describeKitName(catalog, 'ctx.ambient');
    expect(describeKitName(catalog, 'ambient')).toBe(ambient);
    expect(ambient).toContain('tone(name) -> the palette swatch name');
    expect(ambient).toContain('never hard-code one background for every shot');
    const assets = describeKitName(catalog, 'ctx.assets');
    expect(describeKitName(catalog, 'assets')).toBe(assets);
    expect(all).toContain(assets);
    for (const part of ['image(ref,', 'build() only', 'has(ref)', 'photoFrame', 'never execute']) {
      expect(assets).toContain(part);
    }
    expect(formatCatalog(catalog)).toContain('reelforge kit-docs ctx');
    expect(() => describeKitName(catalog, 'cam')).toThrow(/scene context: ctx, camera, text/);
  });

  it('documents ctx.annotate from the engine schemas, with targets and when to use what', () => {
    const annotate = describeKitName(catalog, 'annotate');
    expect(describeKitName(catalog, 'ctx.annotate')).toBe(annotate);
    expect(annotate).toMatch(/Target: a kit object .*\{ card: "<ctx\.text card id>"/);
    expect(annotate).toMatch(
      /arrow\(\{ .*target: Target, from\?: Target, curve\?: "straight"\|"curved"\|"elbow"/,
    );
    expect(annotate).toMatch(/badge\(\{ value: int\|"check"\|"cross"\|"!"\|"\?"/);
    for (const type of [
      'callout',
      'ring',
      'bracket',
      'pin',
      'underline',
      'highlight',
      'stamp',
      'dimension',
      'spotlight',
    ]) {
      expect(annotate).toContain(`  ${type}({ `);
    }
    expect(annotate).toContain('a definition / "what is X" -> callout');
    expect(describeKitName(catalog, 'ctx')).toContain('ctx.annotate');
  });
});
