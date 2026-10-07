/**
 * World architecture (PLAN.md#13.1, ADR-029): a world's looks appear only while its style is
 * active and are then the only ones offered (exclusive), an experimental look only where a scope
 * asks for it, and adding a world changes nothing for the built-in styles (catalog, markdown,
 * ctx.kit).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { kitCatalogMarkdown } from '../catalog-markdown.js';
import { createKit, kitCatalog } from '../kit.js';
import {
  extraLookDefinitions,
  getLook,
  isWorldStyle,
  listLooks,
  lookInScope,
  lookMetaSchema,
  LOOKS,
  voxelLook,
  type Look,
} from '../looks/index.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import { TEST_WORLD, TEST_WORLD_ID, testWorldLook } from '../testing/test-world.js';
import {
  defineWorld,
  isUnwiredWorldStyle,
  WORLDS,
  worldLooks,
  type World,
  type WorldDefinition,
} from './index.js';

/** The built-in styles (engine presets); the kit has no engine dependency. */
const BUILT_IN_STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
const STYLES_OF_TODAY = [undefined, ...BUILT_IN_STYLES];
const WITH_TEST_WORLD: readonly Look[] = [...LOOKS, ...worldLooks([TEST_WORLD])];
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');

function ids(looks: readonly Look[]): string[] {
  return looks.map((look) => look.id);
}

function propNames(looks: readonly Look[], style: string | undefined): string[] {
  const { api } = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(5),
    looks,
    style,
  });
  return Object.keys(api.props);
}

function world(overrides: Partial<World> = {}): World {
  return defineWorld({ ...TEST_WORLD, ...overrides });
}

describe('look scope', () => {
  it('offers unscoped looks everywhere and scoped ones only in their styles', () => {
    const scoped = { ...testWorldLook, experimental: false };
    expect(lookInScope(scoped)).toBe(false);
    expect(lookInScope(scoped, { style: 'noir-voxel' })).toBe(false);
    expect(lookInScope(scoped, { style: TEST_WORLD_ID })).toBe(true);
    for (const look of listLooks()) {
      for (const style of STYLES_OF_TODAY) expect(lookInScope(look, { style })).toBe(true);
    }
  });

  it('hides experimental looks unless the scope asks for them', () => {
    expect(lookInScope(testWorldLook, { style: TEST_WORLD_ID })).toBe(false);
    expect(lookInScope(testWorldLook, { style: TEST_WORLD_ID, experimental: true })).toBe(true);
    expect(lookInScope(testWorldLook, { experimental: true })).toBe(false);
    expect(lookInScope({ ...testWorldLook, available: false }, { style: TEST_WORLD_ID })).toBe(
      false,
    );
  });

  it('validates styles and experimental in the look metadata', () => {
    expect(lookMetaSchema.safeParse(testWorldLook).success).toBe(true);
    expect(lookMetaSchema.safeParse({ ...testWorldLook, styles: [] }).success).toBe(false);
    expect(lookMetaSchema.safeParse({ ...testWorldLook, styles: ['Test World'] }).success).toBe(
      false,
    );
  });
});

describe('the test world', () => {
  it('is visible only when its style is active (and experimental looks are asked for)', () => {
    for (const style of STYLES_OF_TODAY) {
      expect(ids(listLooks(WITH_TEST_WORLD, { style, experimental: true }))).toEqual(
        ids(listLooks()),
      );
    }
    expect(ids(listLooks(WITH_TEST_WORLD, { style: TEST_WORLD_ID }))).toEqual([]);
    expect(ids(listLooks(WITH_TEST_WORLD, { style: TEST_WORLD_ID, experimental: true }))).toEqual([
      'test-world-page',
    ]);
  });

  it('is exclusive in its style: no voxel, retro-ui or any other look (ADR-029)', () => {
    const scope = { style: TEST_WORLD_ID, experimental: true };
    expect(isWorldStyle(TEST_WORLD_ID, WITH_TEST_WORLD)).toBe(true);
    for (const style of STYLES_OF_TODAY) expect(isWorldStyle(style, WITH_TEST_WORLD)).toBe(false);
    expect(isWorldStyle(TEST_WORLD_ID)).toBe(false);
    for (const look of listLooks()) {
      expect(lookInScope(look, scope, true), look.id).toBe(false);
      expect(getLook(look.id, WITH_TEST_WORLD, scope), look.id).toBeUndefined();
    }
    expect(getLook('test-world-page', WITH_TEST_WORLD, scope)).toBe(testWorldLook);
    const catalog = kitCatalog([], WITH_TEST_WORLD, scope);
    expect(catalog.looks.map((look) => look.id)).toEqual(['test-world-page']);
    expect(catalog.voxel).toEqual({});
    expect(catalog.cast).toEqual([]);
    expect(catalog.env).toEqual([]);
    expect(catalog.fx).toEqual([]);
    expect(catalog.props.map((entry) => [entry.name, entry.look])).toEqual([
      ['testWorldPage', 'test-world-page'],
    ]);
    const extra = extraLookDefinitions(WITH_TEST_WORLD, scope);
    expect(extra.prop.map((entry) => entry.look)).toEqual(['test-world-page']);
    expect([...extra.env, ...extra.fx]).toEqual([]);
  });

  it('resolves by id, but not in a scope of another style', () => {
    expect(getLook('test-world-page', WITH_TEST_WORLD)).toBe(testWorldLook);
    expect(getLook('test-world-page', WITH_TEST_WORLD, { style: 'noir-voxel' })).toBeUndefined();
    expect(getLook('test-world-page')).toBeUndefined();
  });

  it('binds its definitions into ctx.kit only in its style', () => {
    const today = propNames(LOOKS, undefined);
    for (const style of STYLES_OF_TODAY) expect(propNames(WITH_TEST_WORLD, style)).toEqual(today);
    // The voxel kit's own definitions stay bound (their names are reserved); no other look's.
    expect(propNames(WITH_TEST_WORLD, TEST_WORLD_ID)).toEqual([
      ...propNames([voxelLook], undefined),
      'testWorldPage',
    ]);
  });

  it('joins the catalog only in its style, as its own look section', () => {
    const catalog = kitCatalog([], WITH_TEST_WORLD, { style: TEST_WORLD_ID, experimental: true });
    expect(catalog.looks.at(-1)?.id).toBe('test-world-page');
    expect(catalog.props.at(-1)).toMatchObject({ name: 'testWorldPage', look: 'test-world-page' });
    expect(kitCatalogMarkdown(catalog)).toContain('## Look `test-world-page`: Test world page');
    expect(kitCatalog([], WITH_TEST_WORLD, { style: TEST_WORLD_ID }).looks).toEqual([]);
  });

  it('lets looks of different styles share a definition name', () => {
    const twin = { ...testWorldLook, id: 'twin-page', styles: ['other-world'] };
    const looks = [...WITH_TEST_WORLD, twin];
    expect(() =>
      extraLookDefinitions(looks, { style: TEST_WORLD_ID, experimental: true }),
    ).not.toThrow();
    expect(() =>
      extraLookDefinitions(looks, { style: 'other-world', experimental: true }),
    ).not.toThrow();
  });

  it('lets the looks of one world share a definition object (bound and listed once)', () => {
    const scope = { style: TEST_WORLD_ID, experimental: true };
    const sibling = { ...testWorldLook, id: 'test-world-notes' };
    const extra = extraLookDefinitions([...WITH_TEST_WORLD, sibling], scope);
    expect(extra.prop.map((entry) => [entry.definition.name, entry.look])).toEqual([
      ['testWorldPage', 'test-world-page'],
    ]);
    const [own] = testWorldLook.kit.props ?? [];
    if (own === undefined) throw new Error('the test look has a prop');
    const impostor = { ...sibling, kit: { props: [{ ...own }] } };
    expect(() => extraLookDefinitions([...WITH_TEST_WORLD, impostor], scope)).toThrow(
      /already defined by look "test-world-page"/,
    );
  });
});

describe('no harm to the built-in styles', () => {
  const committed = readFileSync(path.join(REPO_ROOT, 'docs', 'kit-catalog.md'), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
  const thumbnails = Object.fromEntries(
    readdirSync(path.join(REPO_ROOT, 'docs', 'kit-catalog'))
      .filter((file) => file.endsWith('.png'))
      .map((file) => [file.slice(0, -'.png'.length), `kit-catalog/${file}`]),
  );

  it.each(STYLES_OF_TODAY.map((style) => [style ?? '(no style)', style] as const))(
    '%s: catalog and docs/kit-catalog.md are byte-identical with a world registered',
    (_label, style) => {
      for (const scope of [{ style }, { style, experimental: true }]) {
        const catalog = kitCatalog([], WITH_TEST_WORLD, scope);
        expect(catalog).toEqual(kitCatalog());
        expect(kitCatalogMarkdown(catalog, { thumbnails })).toBe(committed);
      }
    },
  );

  it('ships only experimental worlds so far: LOOKS adds nothing outside their styles', () => {
    expect(WORLDS.map((entry) => entry.id)).toEqual(['sketchbook', 'comic', 'game-b2']);
    expect(WORLDS.every((entry) => entry.experimental)).toBe(true);
    const builtIn = LOOKS.filter((look) => look.styles === undefined);
    expect(builtIn.every((look) => look.experimental !== true)).toBe(true);
    expect(LOOKS.slice(0, builtIn.length)).toEqual(builtIn);
    const worldIds = WORLDS.map((entry) => entry.id);
    for (const look of LOOKS.slice(builtIn.length)) {
      expect(look.experimental, look.id).toBe(true);
      expect(look.styles, look.id).toHaveLength(1);
      expect(worldIds, look.id).toContain(look.styles?.[0]);
    }
  });
});

describe('defineWorld', () => {
  it('accepts the test world', () => {
    expect(TEST_WORLD.looks).toEqual([testWorldLook]);
    expect(Object.isFrozen(TEST_WORLD)).toBe(true);
  });

  it('rejects broken worlds', () => {
    expect(() => world({ id: 'Test World' })).toThrow(/invalid world "Test World": id/);
    expect(() => world({ looks: [] })).toThrow(/at least one look/);
    expect(() => world({ looks: [{ ...testWorldLook, styles: ['other'] }] })).toThrow(
      /must list "test-world" in styles/,
    );
    expect(() => world({ looks: [{ ...testWorldLook, experimental: false }] })).toThrow(
      /experimental world must be experimental/,
    );
    expect(() => world({ style: { ...TEST_WORLD.style, id: 'other' } })).toThrow(
      /style\.id is "other"/,
    );
    expect(() => world({ fonts: { display: '', mono: 'mono' } })).toThrow(/fonts\.display/);
    expect(() => world({ experimental: false, wired: false })).toThrow(
      /not experimental must be wired/,
    );
  });

  it('leaves a world unwired unless it says so', () => {
    const { id, label, description, experimental, style, fonts, soundPalette, looks } = TEST_WORLD;
    const definition: WorldDefinition = {
      id,
      label,
      description,
      experimental,
      style,
      fonts,
      soundPalette,
      looks,
    };
    expect(defineWorld(definition).wired).toBe(false);
    expect(world({ wired: true }).wired).toBe(true);
  });
});

describe('wired worlds (PLAN.md#13)', () => {
  it('wires only Sketchbook so far; the other worlds are render-only', () => {
    expect(WORLDS.filter((entry) => entry.wired).map((entry) => entry.id)).toEqual(['sketchbook']);
    expect(isUnwiredWorldStyle('sketchbook')).toBe(false);
    expect(isUnwiredWorldStyle('comic')).toBe(true);
    expect(isUnwiredWorldStyle('game-b2')).toBe(true);
    for (const style of STYLES_OF_TODAY) expect(isUnwiredWorldStyle(style)).toBe(false);
    expect(isUnwiredWorldStyle(TEST_WORLD_ID, [TEST_WORLD])).toBe(true);
    expect(isUnwiredWorldStyle(TEST_WORLD_ID, [world({ wired: true })])).toBe(false);
  });
});
