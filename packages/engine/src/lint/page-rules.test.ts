import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LintDiagnostic } from './diagnostics.js';
import { lintScene } from './lint-scene.js';

const META = "export const meta = { id: 's01', title: 'Hook', treatment: 'kinetic-text' };";
const UPDATE = 'export function update(t, state) { state.page.update(t); }';
const CREATE =
  'const page = ctx.kit.fx.sketchPage({ size: [960, 540], duration: ctx.shot.duration });';
const kitRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'kit');

function scene(buildBody: string, moduleCode = ''): string {
  return [META, moduleCode, `export function build(ctx) {\n${buildBody}\n}`, UPDATE].join('\n');
}

const notAdded = (source: string): LintDiagnostic[] =>
  lintScene(source, { filename: 'scenes/s01.js' }).filter(
    (diagnostic) => diagnostic.rule === 'kit-page-not-added',
  );

function sceneFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return sceneFiles(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

describe('kit-page-not-added lint', () => {
  it('rejects the real-run blank page: a sketchPage drawn on but never added', () => {
    const found = notAdded(
      scene(`${CREATE}\npage.write('5 MONTHS', { x: 300, y: 200, size: 150 });\nreturn { page };`),
    );
    expect(found).toEqual([
      {
        rule: 'kit-page-not-added',
        severity: 'error',
        line: 4,
        column: 14,
        message:
          '`page` (kit.fx.sketchPage) is never added to the scene, so every frame renders blank.',
        fix: 'Call ctx.scene.add(page) in build(), right after creating it.',
      },
    ]);
  });

  it.each([
    ['ctx.scene.add', `${CREATE}\nctx.scene.add(page);\nreturn { page };`, ''],
    [
      'destructured scene',
      `const { scene } = ctx;\n${CREATE}\nscene.add(page);\nreturn { page };`,
      '',
    ],
    [
      'a group',
      `${CREATE}\nconst g = new ctx.THREE.Group();\ng.add(page);\nctx.scene.add(g);\nreturn { page };`,
      '',
    ],
    ['inline', 'ctx.scene.add(ctx.kit.fx.sketchPage({ size: [960, 540] }));\nreturn {};', ''],
    ['an alias', `${CREATE}\nconst sheet = page;\nctx.scene.add(sheet);\nreturn { page };`, ''],
    [
      'through state',
      `const state = {};\n${CREATE}\nstate.page = page;\nctx.scene.add(state.page);\nreturn state;`,
      '',
    ],
    [
      'a helper that adds',
      `${CREATE}\nmount(ctx, page);\nreturn { page };`,
      'function mount(ctx, p) { ctx.scene.add(p); }',
    ],
    [
      'a factory helper',
      'const page = makePage(ctx);\nctx.scene.add(page);\nreturn { page };',
      'function makePage(ctx) { const page = ctx.kit.fx.sketchPage({ size: [960, 540] }); return page; }',
    ],
  ])('accepts a page added via %s', (_name, body, moduleCode) => {
    expect(notAdded(scene(body, moduleCode))).toEqual([]);
  });

  it('still flags a page passed only to a helper that never adds', () => {
    const helper = 'function farmer(p) { p.figure({ x: 1, y: 2, h: 200 }); }';
    expect(notAdded(scene(`${CREATE}\nfarmer(page);\nreturn { page };`, helper))).toHaveLength(1);
  });

  it('has no false positives on the kit example scenes', () => {
    const flagged = sceneFiles(path.join(kitRoot, 'examples')).flatMap((file) =>
      notAdded(readFileSync(file, 'utf8')).map((entry) => `${file}:${String(entry.line)}`),
    );
    expect(flagged).toEqual([]);
  });
});
