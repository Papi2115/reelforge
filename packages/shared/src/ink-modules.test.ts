import { describe, expect, it } from 'vitest';
import { INK_MODULE_LIMITS, inkModuleIdSchema } from './ink-modules.js';
import {
  kitExtensionFile,
  kitExtensionKind,
  kitExtensionOfFile,
  kitExtensionSchema,
} from './kit-extensions.js';
import { renderManifestSchema } from './render-manifest.js';

const SHOT = {
  id: 's01',
  t0: 0,
  t1: 2,
  scene: { file: 'scenes/s01.js', source: 'export const meta = {};' },
};

describe('project module kinds (PLAN.md#14.8)', () => {
  it('maps kinds to folders and back', () => {
    expect(kitExtensionFile('people', 'nightBaker')).toBe('kit-ext/people/nightBaker.js');
    expect(kitExtensionOfFile('kit-ext\\places\\bakery.js')).toEqual({
      kind: 'places',
      name: 'bakery',
    });
    expect(kitExtensionOfFile('kit-ext/people/Night-Baker.js')).toBeUndefined();
    expect(kitExtensionOfFile('kit-ext/things/x.js')).toBeUndefined();
    expect(kitExtensionKind({})).toBe('props');
    expect(kitExtensionKind({ kind: 'people' })).toBe('people');
  });

  it('keeps old manifests valid and checks names per kind', () => {
    const fridge = { name: 'fridge', file: 'kit-ext/props/fridge.js', source: 'x' };
    expect(kitExtensionSchema.parse(fridge)).toEqual(fridge);
    const base = { version: 1, fps: 24, seed: 1, shots: [SHOT] };
    const same = { ...fridge, file: 'kit-ext/people/fridge.js', kind: 'people' };
    expect(renderManifestSchema.safeParse({ ...base, kitExtensions: [fridge, same] }).success).toBe(
      true,
    );
    const twice = renderManifestSchema.safeParse({ ...base, kitExtensions: [same, same] });
    expect(twice.success).toBe(false);
    expect(twice.error?.issues[0]?.message).toBe('duplicate kit extension "people/fridge"');
    const props = renderManifestSchema.safeParse({ ...base, kitExtensions: [fridge, fridge] });
    expect(props.error?.issues[0]?.message).toBe('duplicate kit extension "fridge"');
    expect(kitExtensionSchema.safeParse({ ...fridge, kind: 'things' }).success).toBe(false);
  });

  it('has camelCase ids and limits', () => {
    expect(inkModuleIdSchema.safeParse('nightBaker').success).toBe(true);
    expect(inkModuleIdSchema.safeParse('night-baker').success).toBe(false);
    expect(INK_MODULE_LIMITS).toEqual({ maxModules: 64, maxBytes: 163840, maxLines: 450 });
  });
});
