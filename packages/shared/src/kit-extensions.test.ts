import { describe, expect, it } from 'vitest';
import {
  normalizePropName,
  propExtensionFile,
  propNameOfFile,
  propsReportSchema,
} from './kit-extensions.js';
import { renderManifestSchema } from './render-manifest.js';

describe('normalizePropName', () => {
  it.each([
    ['fridge', 'fridge'],
    ['file-icon', 'fileIcon'],
    ['fileIcon', 'fileIcon'],
    ['Z80 chip', 'z80Chip'],
    ['USB hub', 'usbHub'],
    ['lodówka', 'lodowka'],
    ['Złota łyżka', 'zlotaLyzka'],
    ['3d printer', 'printer3d'],
    ['  coffee_machine ', 'coffeeMachine'],
  ])('%s -> %s', (raw, name) => {
    expect(normalizePropName(raw)).toBe(name);
  });

  it('rejects names without letters or that are too long', () => {
    expect(normalizePropName('---')).toBeUndefined();
    expect(normalizePropName('42')).toBeUndefined();
    expect(normalizePropName('a'.repeat(41))).toBeUndefined();
  });
});

describe('prop module paths', () => {
  it('maps names to kit-ext/props files and back', () => {
    expect(propExtensionFile('fridge')).toBe('kit-ext/props/fridge.js');
    expect(propNameOfFile('kit-ext/props/fridge.js')).toBe('fridge');
    expect(propNameOfFile('kit-ext\\props\\fileIcon.js')).toBe('fileIcon');
    expect(propNameOfFile('kit-ext/props/Bad-Name.js')).toBeUndefined();
    expect(propNameOfFile('scenes/fridge.js')).toBeUndefined();
  });
});

describe('render manifest kit extensions', () => {
  const base = {
    version: 1,
    fps: 30,
    seed: 1,
    shots: [{ id: 's01', t0: 0, t1: 1, scene: { file: 'scenes/s01.js', source: 'x' } }],
  };
  const fridge = {
    name: 'fridge',
    file: 'kit-ext/props/fridge.js',
    source: 'export const prop = {};',
  };

  it('accepts project-local props', () => {
    expect(renderManifestSchema.safeParse({ ...base, kitExtensions: [fridge] }).success).toBe(true);
  });

  it('rejects duplicate and non-camelCase names', () => {
    const duplicate = renderManifestSchema.safeParse({ ...base, kitExtensions: [fridge, fridge] });
    expect(duplicate.error?.issues[0]?.message).toBe('duplicate kit extension "fridge"');
    const bad = renderManifestSchema.safeParse({
      ...base,
      kitExtensions: [{ ...fridge, name: 'my-fridge' }],
    });
    expect(bad.success).toBe(false);
  });
});

describe('props report', () => {
  it('validates a built and a failed prop', () => {
    const record = {
      name: 'fridge',
      status: 'built',
      file: 'kit-ext/props/fridge.js',
      description: 'a kitchen fridge',
      shots: ['s01'],
      attempts: 1,
      sheet: '.reelforge/frames/props/fridge/qa-1.png',
      findings: [],
      notes: [],
      updatedAt: '2026-10-02T10:00:00.000Z',
    };
    const report = {
      version: 1,
      updatedAt: '2026-10-02T10:00:00.000Z',
      props: [record, { ...record, name: 'printer', status: 'failed', findings: ['blank'] }],
    };
    expect(propsReportSchema.parse(report).props).toHaveLength(2);
    expect(propsReportSchema.safeParse({ ...report, version: 2 }).success).toBe(false);
  });
});
