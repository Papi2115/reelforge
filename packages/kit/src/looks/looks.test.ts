import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { kitCatalogMarkdown } from '../catalog-markdown.js';
import { ENV_DEFINITIONS } from '../env/index.js';
import { FX_DEFINITIONS } from '../fx/index.js';
import { createKit, kitCatalog } from '../kit.js';
import { PROP_DEFINITIONS } from '../props/index.js';
import { defineFx, defineProp, kitOriginOf } from '../registry.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import {
  defineLook,
  extraLookDefinitions,
  getLook,
  listLooks,
  lookMetaSchema,
  LOOKS,
  VOXEL_LOOK_ID,
  voxelLook,
  type Look,
} from './index.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');

const panel = defineProp({
  name: 'testPanel',
  description: 'A flat test panel.',
  params: z.object({ size: z.int().min(1).default(2).describe('Edge in voxels') }),
  build: (params, tools) =>
    tools.voxel.mesh(tools.voxel.box([params.size, params.size, 1], 'hero')),
});

const sweep = defineFx({
  name: 'testSweep',
  description: 'A test template.',
  params: z.object({}),
  build: (_params, tools) => tools.voxel.mesh(tools.voxel.box([1, 1, 1], 'hero')),
});

/** A test-only second look (never registered outside tests). */
function testLook(overrides: Partial<Look> = {}): Look {
  return defineLook({
    id: 'test-look',
    label: 'Test look',
    description: 'a look that exists only in tests',
    rolls: ['B'],
    treatments: ['ui-mockup'],
    docs: 'Build with kit.props.testPanel.',
    soundPalette: 'test',
    variationBudget: 'test',
    available: true,
    kit: { props: [panel], templates: [sweep] },
    ...overrides,
  });
}

function kitWith(looks: readonly Look[]) {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(3), looks });
}

describe('look registry', () => {
  it('ships voxel as the only available look; the 2.0 stubs wait behind their flags', () => {
    expect(LOOKS.map((look) => look.id)).toEqual(['voxel', 'retro-ui', 'diorama', 'blueprint']);
    expect(listLooks().map((look) => look.id)).toEqual([VOXEL_LOOK_ID]);
    expect(getLook('voxel')).toBe(voxelLook);
    expect(getLook('retro-ui')).toBeUndefined();
    expect(getLook('nope')).toBeUndefined();
    for (const look of LOOKS) expect(lookMetaSchema.safeParse(look).success, look.id).toBe(true);
  });

  it('keeps every look module in a folder named after its id', () => {
    const folders = readdirSync(import.meta.dirname, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(LOOKS.map((look) => look.id).sort());
  });

  it('makes the voxel look exactly the existing kit', () => {
    expect(voxelLook.kit.env).toBe(ENV_DEFINITIONS);
    expect(voxelLook.kit.props).toBe(PROP_DEFINITIONS);
    expect(voxelLook.kit.fx).toBe(FX_DEFINITIONS);
    const extra = extraLookDefinitions();
    expect([...extra.env, ...extra.prop, ...extra.fx]).toEqual([]);
    const { api } = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(3) });
    expect(Object.keys(api.env)).toEqual(ENV_DEFINITIONS.map((definition) => definition.name));
    expect(Object.keys(api.props)).toEqual(PROP_DEFINITIONS.map((definition) => definition.name));
    expect(Object.keys(api.fx)).toEqual(FX_DEFINITIONS.map((definition) => definition.name));
  });

  it('rejects bad metadata and definitions in the wrong slot', () => {
    expect(() => testLook({ id: 'Test Look' })).toThrow(/invalid look "Test Look": id/);
    expect(() => testLook({ rolls: [] })).toThrow(/rolls/);
    expect(() => testLook({ kit: { env: [panel] } })).toThrow(
      /kit\.env lists prop "testPanel" \(expected env\)/,
    );
  });
});

describe('an available second look', () => {
  it('adds its definitions to ctx.kit next to the voxel kit', () => {
    const { api } = kitWith([voxelLook, testLook()]);
    const props = api.props as Readonly<Record<string, (params?: unknown) => THREE.Object3D>>;
    const fx = api.fx as Readonly<Record<string, (params?: unknown) => THREE.Object3D>>;
    expect(Object.keys(api.props)).toEqual([
      ...PROP_DEFINITIONS.map((definition) => definition.name),
      'testPanel',
    ]);
    const made = props['testPanel']?.({ size: 3 });
    expect(made && kitOriginOf(made)?.call).toBe('kit.props.testPanel()');
    expect(fx['testSweep']).toBeTypeOf('function');
    expect(Object.keys(api.env)).toEqual(ENV_DEFINITIONS.map((definition) => definition.name));
  });

  it('is ignored while unavailable', () => {
    const { api } = kitWith([voxelLook, testLook({ available: false })]);
    expect(Object.keys(api.props)).not.toContain('testPanel');
  });

  it('cannot take a name of the voxel kit or of another look', () => {
    const clash = testLook({ kit: { props: [{ ...panel, name: 'calculator' }] } });
    expect(() => kitWith([voxelLook, clash])).toThrow(
      /look "test-look": prop "calculator" is already defined by look "voxel"/,
    );
    expect(() => kitWith([voxelLook, testLook(), testLook({ id: 'other-look' })])).toThrow(
      /prop "testPanel" is already defined by look "test-look"/,
    );
  });

  it('is listed in the catalog, tagged, and gets its own section in the markdown', () => {
    const catalog = kitCatalog([], [voxelLook, testLook()]);
    expect(catalog.looks.map((look) => look.id)).toEqual(['voxel', 'test-look']);
    expect(catalog.props.at(-1)).toMatchObject({ name: 'testPanel', look: 'test-look' });
    expect(catalog.fx.at(-1)).toMatchObject({ name: 'testSweep', look: 'test-look' });
    expect(catalog.props[0]?.look).toBe('voxel');
    const markdown = kitCatalogMarkdown(catalog);
    const section = markdown.indexOf('## Look `test-look`: Test look');
    expect(section).toBeGreaterThan(markdown.indexOf('## Effects'));
    expect(section).toBeLessThan(markdown.indexOf('## Voxel toolbox'));
    expect(markdown.indexOf('### `kit.props.testPanel(params)`')).toBeGreaterThan(section);
    expect(markdown.indexOf('### `kit.fx.testSweep(params)`')).toBeGreaterThan(section);
  });
});

describe('docs/kit-catalog.md', () => {
  it('is unchanged by the look registry (voxel only)', () => {
    const docs = path.join(REPO_ROOT, 'docs');
    const thumbnails = Object.fromEntries(
      readdirSync(path.join(docs, 'kit-catalog'))
        .filter((file) => file.endsWith('.png'))
        .map((file) => [file.slice(0, -'.png'.length), `kit-catalog/${file}`]),
    );
    const committed = readFileSync(path.join(docs, 'kit-catalog.md'), 'utf8').replaceAll(
      '\r\n',
      '\n',
    );
    expect(kitCatalogMarkdown(kitCatalog(), { thumbnails })).toBe(committed);
  });
});
