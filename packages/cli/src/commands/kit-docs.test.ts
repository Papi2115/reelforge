import type { KitCatalog } from '@reelforge/kit';
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
});
