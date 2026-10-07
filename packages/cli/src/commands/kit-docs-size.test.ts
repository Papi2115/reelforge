/**
 * kit-docs output sizes (real run v2.0): Claude Code saves a Bash output above ~30,000 characters
 * to a file the scene turns cannot read, so every kit-docs text the scene prompt points at must
 * stay under 28,000 characters; the voxel-only index stays the 1.x text.
 */
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { kitCatalog, listLooks, LOOKS, voxelLook, type KitCatalogEntry } from '@reelforge/kit';
import type { LookMode } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { CTX_TOPICS } from './ctx-docs.js';
import { formatCatalog } from './kit-docs-index.js';
import { entryLine, shortDescription } from './kit-docs-lines.js';
import { sliceNames } from './kit-docs-slices.js';
import { describeKitName } from './kit-docs.js';
import { suggestNames } from './suggest.js';

const LIMIT = 28_000;
const MODES: readonly LookMode[] = ['voxel-only', 'mixed'];

/** A project prop as big as the real run's (10 props = 4 KB in the index). */
function projectProp(index: number): KitCatalogEntry {
  const names = ['body', 'screen', 'open', 'glow', 'scale', 'label', 'tilt'];
  return {
    kind: 'prop',
    name: `projectProp${String(index)}`,
    origin: 'project',
    description: `Project prop ${String(index)}: what it is, its size (~1 x 1.2 x 0.8 units) and when a shot uses it. Front faces +z; the lid opens by open(k); call update(t) every frame when it animates, e.g. blinking lights.`,
    params: {
      type: 'object',
      properties: Object.fromEntries(
        names.map((name) => [name, { type: 'string', default: 'heroTrim', description: 'x' }]),
      ),
    },
    anchors: { lid: 'top of the lid' },
  };
}

/** Available look ids, voxel first (the 2.0 looks, then the 2.3 ones). */
const LOOK_IDS = listLooks().map((look) => look.id);
const PROPS = Array.from({ length: 12 }, (_, index) => projectProp(index));
// The 2.x looks (world looks are scoped to their own style and never in these indexes).
const BUILT_IN_LOOKS = LOOKS.filter((look) => look.id !== 'voxel' && look.styles === undefined);
const LOOK_NAMES = BUILT_IN_LOOKS.flatMap((look) => [
  ...(look.kit.env ?? []),
  ...(look.kit.props ?? []),
  ...(look.kit.fx ?? []),
  ...(look.kit.templates ?? []),
]);

describe('kit-docs index size', () => {
  it('keeps the voxel-only index to the 1.x text: no entries of other looks', () => {
    const text = formatCatalog(kitCatalog(), { lookMode: 'voxel-only' });
    expect(text.length).toBeLessThan(26_000);
    expect(text).not.toContain('(look ');
    for (const definition of LOOK_NAMES) expect(text).not.toContain(`.${definition.name}(`);
    // Without a budget the voxel-only index is exactly the voxel kit, every entry in full (1.x).
    const unlimited = formatCatalog(kitCatalog(), { lookMode: 'voxel-only', budget: Infinity });
    expect(unlimited).toBe(
      formatCatalog(kitCatalog([], [voxelLook]), { lookMode: 'voxel-only', budget: Infinity }),
    );
    for (const entry of kitCatalog([], [voxelLook]).props) {
      expect(unlimited).toContain(`${entryLine(entry, 'full')}\n`);
    }
    expect(unlimited.split('\n').at(-2)).toMatch(/^camera rigs, ctx\.text options/);
  });

  it('stays under the limit with 12 project props in a mixed project with all four looks', () => {
    const catalog = kitCatalog(PROPS);
    expect(catalog.looks.map((look) => look.id)).toEqual(LOOK_IDS);
    const mixed = formatCatalog(catalog, { lookMode: 'mixed' });
    expect(mixed.length).toBeLessThan(LIMIT);
    for (const definition of LOOK_NAMES) {
      const line = mixed
        .split('\n')
        .find((candidate) => candidate.includes(`.${definition.name} (look `));
      expect(line, definition.name).toBeDefined();
    }
    for (const prop of PROPS) {
      expect(mixed).toContain(
        `  kit.props.${prop.name} (project-local, kit-ext/props) — ${shortDescription(prop.description)}\n`,
      );
    }
    const voxelOnly = formatCatalog(catalog, { lookMode: 'voxel-only' });
    expect(voxelOnly.length).toBeLessThan(26_000);
    expect(voxelOnly).toContain('kit.props.projectProp11(');
  });

  it('ends with a line saying the index was kept short and what shows more', () => {
    const mixed = formatCatalog(kitCatalog(PROPS), { lookMode: 'mixed' }).split('\n').at(-1);
    expect(mixed).toMatch(/^\(kept under 27,500 characters so it is never cut off; /);
    expect(mixed).toContain(
      `reelforge kit-docs props|env|fx|templates|project|${LOOK_IDS.join('|')} --full`,
    );
    expect(mixed).toContain('reelforge kit-docs <name>');
    const voxel = formatCatalog(kitCatalog(), { lookMode: 'voxel-only' }).split('\n').at(-1);
    expect(voxel).toContain('reelforge kit-docs props|env|fx|project --full');
  });

  it('shortens the longest entries first when the kit outgrows the budget', () => {
    const full = formatCatalog(kitCatalog(), { lookMode: 'voxel-only', budget: Infinity });
    const tight = formatCatalog(kitCatalog(), { lookMode: 'voxel-only', budget: 24_000 });
    expect(tight.length).toBeLessThanOrEqual(24_000);
    expect(tight).toContain('kit.props.character({ variant?, pose?, hair?');
    expect(full).toContain('kit.props.character({ variant?: "hero"');
    expect(tight.split('\n').at(-1)).toContain('the longest entries are shortened');
  });
});

describe('every kit-docs text the scene prompt points at fits the Bash output', () => {
  const catalog = kitCatalog(PROPS);

  it('slices (short, --full and every page) in both look modes', () => {
    for (const lookMode of MODES) {
      for (const name of sliceNames(catalog)) {
        for (const full of [false, true]) {
          let page = 1;
          for (;;) {
            const text = describeKitName(catalog, name, { lookMode, full, page });
            expect(text.length, `${name} ${String(full)} ${String(page)}`).toBeLessThan(LIMIT);
            if (!text.includes(`--page ${String(page + 1)}`)) break;
            page += 1;
          }
        }
      }
    }
  });

  it('ctx topics and every single function', () => {
    for (const topic of CTX_TOPICS) {
      expect(describeKitName(catalog, topic).length, topic).toBeLessThan(LIMIT);
    }
    for (const entry of [...catalog.env, ...catalog.props, ...catalog.fx]) {
      expect(describeKitName(catalog, entry.name).length, entry.name).toBeLessThan(LIMIT);
    }
    expect(describeKitName(catalog, 'prop-module').length).toBeLessThan(LIMIT);
  });
});

describe('kit-docs <kind | look>', () => {
  const catalog = kitCatalog(PROPS);

  it('lists a kind one line per entry, every param with --full', () => {
    const props = describeKitName(catalog, 'props', { lookMode: 'mixed' });
    expect(props.split('\n')[0]).toBe('kit.props');
    expect(props).toMatch(
      /^\d+ entries \(one line each; every param: reelforge kit-docs props --full;/m,
    );
    expect(props).toContain('  kit.props.calculator — ');
    expect(props).toContain('  kit.props.retroBrowser (look retro-ui) — ');
    expect(describeKitName(catalog, 'kit.props', { lookMode: 'mixed' })).toBe(props);
    const full = describeKitName(catalog, 'props', { lookMode: 'mixed', full: true });
    expect(full).toContain('  kit.props.calculator({ screen?: "blank"');
    expect(describeKitName(catalog, 'props')).not.toContain('retroBrowser');
    const env = describeKitName(catalog, 'env', { lookMode: 'mixed' });
    expect(env).toContain('kit.env.neonGrid — ');
    expect(env).not.toContain('kit.props.');
    expect(describeKitName(catalog, 'fx', { lookMode: 'mixed' })).toContain(
      'kit.fx.blueprintChart',
    );
  });

  it('lists the templates, the project props and one look', () => {
    const templates = describeKitName(catalog, 'templates', { lookMode: 'mixed' });
    expect(templates).toContain('kit.props.retroBrowser (look retro-ui)');
    expect(templates).toContain('kit.fx.blueprintChart (look blueprint)');
    expect(templates).not.toContain('kit.env.retroDesktop');
    const project = describeKitName(catalog, 'project');
    expect(project).toContain('12 entries');
    expect(project).toContain('kit.props.projectProp0 (project-local, kit-ext/props)');
    expect(describeKitName(kitCatalog(), 'project')).toContain('(none yet; writing one');
    const blueprint = describeKitName(catalog, 'blueprint', { lookMode: 'mixed' });
    expect(blueprint.split('\n')[0]).toMatch(/^look blueprint \(/);
    expect(blueprint).toContain('kit.env.blueprintSheet (look blueprint)');
    expect(blueprint).not.toContain('retro');
    expect(blueprint).not.toContain('note: this project is voxel-only');
    expect(describeKitName(catalog, 'blueprint')).toContain('note: this project is voxel-only');
    const voxel = describeKitName(catalog, 'voxel', { lookMode: 'mixed' });
    expect(voxel).toContain('  kit.voxel.box(');
    expect(voxel).toContain('kit.props.calculator — ');
    expect(voxel).not.toContain('(look ');
    expect(voxel).not.toContain('projectProp');
  });

  it('pages a long slice', () => {
    const options = { lookMode: 'mixed' as const, full: true };
    const first = describeKitName(catalog, 'voxel', options);
    expect(first).toMatch(/entries, page 1 of 2 \(every param/);
    expect(first.split('\n').at(-1)).toBe('more: reelforge kit-docs voxel --full --page 2');
    const second = describeKitName(catalog, 'voxel', { ...options, page: 2 });
    expect(second).toMatch(/page 2 of 2/);
    expect(second).not.toContain('more: ');
    expect(() => describeKitName(catalog, 'voxel', { ...options, page: 3 })).toThrow(
      /has 2 page\(s\); --page 3 does not exist/,
    );
  });

  it('suggests the closest names for a typo', () => {
    expect(() => describeKitName(catalog, 'retroBrowse')).toThrow(/did you mean: retroBrowser/);
    expect(() => describeKitName(catalog, 'bluprint')).toThrow(/did you mean: blueprint/);
    expect(() => describeKitName(catalog, 'kit.props.calculater')).toThrow(
      /did you mean: calculator/,
    );
    expect(() => describeKitName(catalog, 'xyzzy')).toThrow(
      /^no kit function "xyzzy"\nkinds: props, env, fx, templates, project; looks: voxel, retro-ui, diorama, blueprint(?:, [a-z0-9-]+)*; scene context: ctx, camera/,
    );
    expect(() => describeKitName(catalog, 'xyzzy')).toThrow(`looks: ${LOOK_IDS.join(', ')};`);
    expect(suggestNames('prop', ['props', 'project', 'key', 'env'])).toEqual(['props']);
    expect(suggestNames('monkey', ['key', 'money'])).toEqual(['money']);
  });
});

const FRIDGE = readFileSync(
  path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'kit-ext', 'fridge.js'),
  'utf8',
);

describe('reelforge kit-docs in a project', () => {
  let project: TempProject;

  beforeEach(async () => {
    project = await copyFixtureProject();
  });

  afterEach(async () => {
    await project.remove();
  });

  it('reads the look mode from project.json and keeps 12 project props under the limit', async () => {
    const voxelOnly = await runCli(project.root, 'kit-docs');
    expect(voxelOnly.stdout).not.toContain('(look ');
    await mkdir(path.join(project.root, 'kit-ext', 'props'), { recursive: true });
    for (let index = 0; index < 12; index += 1) {
      const name = `fridge${String(index)}`;
      await project.write(
        `kit-ext/props/${name}.js`,
        FRIDGE.replace("name: 'fridge'", `name: '${name}'`),
      );
    }
    await project.edit('project.json', '"fps": 30,', '"fps": 30,\n  "lookMode": "mixed",');
    const mixed = await runCli(project.root, 'kit-docs');
    expect(mixed.code).toBe(0);
    expect(mixed.stdout.length).toBeLessThan(LIMIT);
    expect(mixed.stdout).toContain('kit.props.retroBrowser (look retro-ui) — ');
    expect(mixed.stdout).toContain(
      'kit.props.fridge11 (project-local, kit-ext/props) — Kitchen fridge (~0.9 x 1.8 x 0.8 units), freezer on top, the lower door opens; front faces +z.\n',
    );
    const slice = await runCli(project.root, 'kit-docs', 'project', '--full');
    expect(slice.stdout).toContain('kit.props.fridge0({ body?: string = "heroTrim"');
    const flags = await runCli(project.root, 'kit-docs', '--full');
    expect(flags.code).toBe(2);
    expect(flags.stderr).toContain('--full and --page need a kind or look');
    expect((await runCli(project.root, 'kit-docs', 'props', '--page', 'x')).code).toBe(2);
  });
});
