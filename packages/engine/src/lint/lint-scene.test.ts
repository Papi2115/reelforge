import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasErrors, type LintDiagnostic, type LintRule } from './diagnostics.js';
import { lintScene } from './lint-scene.js';

const META = "export const meta = { id: 's01', title: 'Test', treatment: 'title-card' };";

/** A contract-valid scene with the given build body, update body and module-level code. */
function scene(buildBody: string, updateBody = '', moduleCode = ''): string {
  return [
    META,
    moduleCode,
    `export function build(ctx) {\n${buildBody}\nreturn {};\n}`,
    `export function update(t, state, ctx) {\n${updateBody}\n}`,
  ].join('\n');
}

function lint(source: string): LintDiagnostic[] {
  return lintScene(source, { filename: 'scenes/s01.js' });
}

function errorRules(source: string): LintRule[] {
  return lint(source)
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.rule);
}

const engineRoot = path.resolve(import.meta.dirname, '..', '..');

describe('lintScene: forbidden APIs (flagged)', () => {
  const cases: [string, string, LintRule][] = [
    ['Math.random()', 'const x = Math.random();', 'no-random'],
    ['aliased Math.random', 'const r = Math.random; r();', 'no-random'],
    ['destructured random', 'const { random } = Math; random();', 'no-random'],
    ['renamed destructured random', 'const { random: rnd } = Math; rnd();', 'no-random'],
    ['aliased Math object', 'const M = Math; M.random();', 'no-random'],
    ['computed string key', "Math['random']();", 'no-random'],
    ['template key', 'Math[`random`]();', 'no-random'],
    ['optional call', 'Math.random?.();', 'no-random'],
    ['sequence alias', '(0, Math).random();', 'no-random'],
    ['crypto.getRandomValues', 'crypto.getRandomValues(new Uint32Array(1));', 'no-random'],
    ['new Date', 'const d = new Date();', 'no-wall-clock'],
    ['Date.now', 'const now = Date.now();', 'no-wall-clock'],
    ['globalThis[Date]', "const now = globalThis['Date'].now();", 'no-wall-clock'],
    ['aliased global Date', 'const D = globalThis.Date; new D();', 'no-wall-clock'],
    ['destructured Date', 'const { Date: D } = globalThis;', 'no-wall-clock'],
    ['performance.now', 'const ms = performance.now();', 'no-wall-clock'],
    ['requestAnimationFrame', 'requestAnimationFrame(() => {});', 'no-timers'],
    ['setTimeout', 'setTimeout(() => {}, 100);', 'no-timers'],
    ['setInterval', 'setInterval(() => {}, 100);', 'no-timers'],
    ['setImmediate', 'setImmediate(() => {});', 'no-timers'],
    ['aliased setTimeout', 'const later = setTimeout; later(() => {}, 1);', 'no-timers'],
    ['window.setTimeout', 'window.setTimeout(() => {}, 1);', 'no-timers'],
    ['fetch', "fetch('https://example.com');", 'no-network'],
    ['XMLHttpRequest', 'const xhr = new XMLHttpRequest();', 'no-network'],
    ['WebSocket', "const ws = new WebSocket('ws://localhost');", 'no-network'],
    ['eval', "eval('1 + 1');", 'no-eval'],
    ['indirect eval', "(0, eval)('1');", 'no-eval'],
    ['new Function', "const f = new Function('return 1');", 'no-eval'],
    ['constructor chain', "({}).constructor.constructor('return 1')();", 'no-eval'],
    ['process', 'const env = process.env;', 'no-node'],
    ['require', "const fs = require('fs');", 'no-node'],
    ['Buffer', "Buffer.from('x');", 'no-node'],
    ['__dirname', 'const dir = __dirname;', 'no-node'],
    ['window', 'const w = window.innerWidth;', 'no-host-globals'],
    ['document', "document.createElement('div');", 'no-host-globals'],
    ['globalThis', 'const g = globalThis;', 'no-host-globals'],
    ['self', "self.postMessage('x');", 'no-host-globals'],
    ['devicePixelRatio', 'const ratio = devicePixelRatio;', 'no-host-globals'],
    ['localStorage', "localStorage.getItem('k');", 'no-storage'],
    ['style.transition', "ctx.el.style.transition = 'opacity 1s';", 'no-css-animation'],
    ['style.animationName', "ctx.el.style.animationName = 'spin';", 'no-css-animation'],
    [
      'cssText animation',
      "ctx.el.style.cssText = 'color: red; animation: spin 1s infinite';",
      'no-css-animation',
    ],
    [
      'style.setProperty',
      "ctx.el.style.setProperty('animation-name', 'spin');",
      'no-css-animation',
    ],
    [
      'setAttribute style',
      "ctx.el.setAttribute('style', 'transition: all 1s');",
      'no-css-animation',
    ],
    [
      '@keyframes string',
      'const css = `@keyframes spin { to { opacity: 0 } }`;',
      'no-css-animation',
    ],
  ];

  it.each(cases)('%s', (_name, code, rule) => {
    expect(errorRules(scene(code))).toContain(rule);
  });

  it('flags forbidden APIs in update() and at module level too', () => {
    expect(errorRules(scene('', 'const x = Math.random();'))).toEqual(['no-random']);
    expect(errorRules(scene('', '', 'const started = Date.now();'))).toEqual(['no-wall-clock']);
  });

  it('reports the position of the offending code (1-based)', () => {
    const source = `${META}\nexport function build(ctx) {\n  return { x: Math.random() };\n}\nexport function update() {}`;
    const [diagnostic] = lint(source);
    expect(diagnostic).toMatchObject({ rule: 'no-random', line: 3, column: 15, severity: 'error' });
  });

  it('writes messages and fixes an LLM can act on', () => {
    const [random] = lint(scene('Math.random();'));
    expect(random?.message).toMatch(/Math\.random\(\) is non-deterministic/);
    expect(random?.fix).toMatch(/Use ctx\.rng\(\) instead — it is seeded per shot/);
    const [timer] = lint(scene('setTimeout(() => {}, 1);'));
    expect(timer?.fix).toMatch(/function of t inside update\(\)/);
    const [global] = lint(scene("globalThis['Date'];"));
    expect(global?.message).toMatch(/^globalThis\.Date: `Date` reads the wall clock/);
  });

  it('warns about computed Math members it cannot check', () => {
    const diagnostics = lint(scene("const name = 'sin'; Math[name](1);"));
    expect(diagnostics.map((item) => [item.rule, item.severity])).toEqual([
      ['no-dynamic-global-member', 'warning'],
    ]);
  });
});

describe('lintScene: imports', () => {
  it.each([
    ['static import', "import * as THREE from 'three';"],
    ['dynamic import', "export async function load() { return import('./helper.js'); }"],
    ['re-export', "export * from './other.js';"],
    ['named re-export', "export { x } from './other.js';"],
    ['import.meta', 'export const url = import.meta.url;'],
  ])('flags %s', (_name, code) => {
    expect(errorRules(scene('', '', code))).toContain('no-import');
  });
});

describe('lintScene: camera API (camera-api)', () => {
  it.each([
    ['unknown member write', 'ctx.camera.fov = 30;'],
    ['guessed method', 'ctx.camera.zoom({ t0: 0, t1: 1 });'],
    ['internal state', 'const f = ctx.camera.focus;'],
  ])('flags %s', (_name, code) => {
    expect(errorRules(scene('', code))).toEqual(['camera-api']);
  });

  it('allows every move and the camera object, and other objects named camera', () => {
    const code = [
      'ctx.camera.set({ position: [0, 2, 8] });',
      'ctx.camera.object.fov = 40;',
      'ctx.camera.rackFocus({ from: 2, to: 6, t0: 0, t1: 1 });',
      'ctx.camera.dollyZoom({ from: 3, to: 8, t0: state.hit, t1: state.hit });',
      "ctx.camera.orbit({ degrees: 40, t0: 0, t1: 2, axis: 'x' });",
      'ctx.camera.parallax({ amount: 2, t0: 0, t1: 3, layers: [{ far: 5, ratio: 1.6 }] });',
      'ctx.camera.shake(ctx.camera.orbit({ radius: 5, degrees: [0, 30] }), { amplitude: 0.1 })(t);',
      'const rig = { camera: { zoom: 1 } }; rig.camera.zoom;',
    ].join('\n');
    expect(lint(scene('', code))).toEqual([]);
  });
});

describe('lintScene: allowed code (not flagged)', () => {
  it.each([
    [
      'example scene s00_hello',
      readFileSync(path.join(engineRoot, 'examples', 's00_hello.js'), 'utf8'),
    ],
    [
      'fixture s01_stripes',
      readFileSync(path.join(engineRoot, 'test', 'fixtures', 's01_stripes.js'), 'utf8'),
    ],
    [
      'camera moves example s03_camera',
      readFileSync(path.join(engineRoot, 'examples', 's03_camera.js'), 'utf8'),
    ],
  ])('%s passes without errors', (_name, source) => {
    expect(errorRules(source)).toEqual([]);
  });

  it.each([
    ['ctx.rng', 'const a = ctx.rng(); const b = ctx.rng.range(0, 1); ctx.rng.pick([1, 2]);'],
    ['Math helpers', 'const v = Math.sin(Math.PI * 0.5) + Math.floor(2.5) + Math.max(1, 2);'],
    ['shadowed Date', 'const Date = { now: () => 0 }; Date.now();'],
    [
      'parameter named performance',
      'const f = (performance) => performance.now(); f({ now: () => 1 });',
    ],
    ['local crypto', 'const crypto = { id: 1 }; crypto.id;'],
    ['property names', "const o = { fetch: 1, Date: 2 }; o.random = 3; o.setTimeout; o['window'];"],
    ['method names', 'class Loader { fetch() { return 1; } } new Loader().fetch();'],
    ['labels', 'window: for (const x of [1]) { break window; }'],
    ['words in strings', "const s = 'Math.random() and Date.now() and Transition: the next era';"],
    ['incremental code in build', 'const m = { x: 0 }; for (let i = 0; i < 3; i += 1) m.x += 1;'],
  ])('%s', (_name, code) => {
    expect(lint(scene(code))).toEqual([]);
  });

  it.each([
    [
      'absolute assignments',
      'state.hero.position.y = Math.sin(t); state.hero.rotation.set(0, t, 0);',
    ],
    [
      'local accumulator',
      'let sum = 0; for (const c of state.cubes) sum += c.size; state.label = sum;',
    ],
    ['loop counters', 'for (let i = 0; i < 3; i++) { state.items[i].x = i * t; }'],
    [
      'fresh local object',
      'const v = new ctx.three.Vector3(); v.x += t; const p = state.p.clone(); p.y *= 2;',
    ],
    ['fresh local array', 'const xs = [1, 2]; xs[0] += t;'],
    ['reassigned parameter', 't *= 2; ctx.camera.set({ position: [t, 1, 1] });'],
    ['rotate on a fresh object', 'const o = new ctx.three.Object3D(); o.rotateY(t);'],
  ])('update(): %s', (_name, code) => {
    expect(lint(scene('', code, 'const SPEED = 2;'))).toEqual([]);
  });
});

describe('lintScene: update() state', () => {
  it.each([
    ['module counter +=', 'frame += 1;', 'let frame = 0;', 'no-module-state-in-update'],
    ['module counter ++', 'frame++;', 'let frame = 0;', 'no-module-state-in-update'],
    ['module last time', 'lastT = t;', 'let lastT = 0;', 'no-module-state-in-update'],
    [
      'module object member',
      'cache.count += 1;',
      'const cache = { count: 0 };',
      'no-module-state-in-update',
    ],
    ['state +=', 'state.angle += 0.1;', '', 'no-incremental-update'],
    [
      'destructured state',
      'const { hero } = state; hero.rotation.y += 0.01;',
      '',
      'no-incremental-update',
    ],
    [
      'for-of element',
      'for (const c of state.cubes) c.position.x -= 0.1;',
      '',
      'no-incremental-update',
    ],
    ['state --', 'state.lives--;', '', 'no-incremental-update'],
    ['rotateY', 'state.hero.rotateY(0.01);', '', 'no-incremental-update'],
    [
      'translateX in a callback',
      'state.cubes.forEach((c) => c.translateX(0.1));',
      '',
      'no-incremental-update',
    ],
  ])('flags %s', (_name, code, moduleCode, rule) => {
    expect(errorRules(scene('', code, moduleCode))).toEqual([rule]);
  });

  it('includes the offending code in the message', () => {
    const [diagnostic] = lint(scene('', 'state.angle += 0.1;'));
    expect(diagnostic?.message).toMatch(
      /^`state\.angle \+= 0\.1` changes a value relative to the previous frame/,
    );
    expect(diagnostic?.fix).toMatch(/absolutely from t/);
  });
});

describe('lintScene: scene contract', () => {
  const BUILD = 'export function build(ctx) { return {}; }';
  const UPDATE = 'export function update(t, state, ctx) {}';

  it.each([
    ['missing meta', `${BUILD}\n${UPDATE}`, /does not export `meta`/],
    [
      'meta without id',
      `export const meta = { title: 'x', treatment: 'map' };\n${BUILD}\n${UPDATE}`,
      /`meta\.id` is missing/,
    ],
    [
      'empty id',
      `export const meta = { id: '', title: 'x', treatment: 'map' };\n${BUILD}\n${UPDATE}`,
      /non-empty string/,
    ],
    [
      'meta not an object',
      `export const meta = 's01';\n${BUILD}\n${UPDATE}`,
      /must be an object literal/,
    ],
    [
      'unknown treatment',
      `export const meta = { id: 's', title: 'x', treatment: 'slideshow' };\n${BUILD}\n${UPDATE}`,
      /"slideshow" is not a known treatment/,
    ],
    ['missing build', `${META}\n${UPDATE}`, /does not export `build\(ctx\)`/],
    ['missing update', `${META}\n${BUILD}`, /does not export `update\(t, state, ctx\)`/],
    [
      'build arity',
      `${META}\nexport function build(ctx, extra) {}\n${UPDATE}`,
      /declares 2 parameters/,
    ],
    [
      'update arity',
      `${META}\n${BUILD}\nexport function update(t, state, ctx, dt) {}`,
      /declares 4 parameters/,
    ],
    ['rest parameters', `${META}\n${BUILD}\nexport function update(...args) {}`, /rest parameters/],
    [
      'async update',
      `${META}\n${BUILD}\nexport async function update(t) {}`,
      /plain synchronous function/,
    ],
    [
      'generator build',
      `${META}\nexport function* build(ctx) {}\n${UPDATE}`,
      /plain synchronous function/,
    ],
    ['update not a function', `${META}\n${BUILD}\nexport const update = 5;`, /must be a function/],
  ])('%s', (_name, source, message) => {
    const errors = lint(source).filter((item) => item.severity === 'error');
    expect(errors.map((item) => item.rule)).toEqual(['scene-contract']);
    expect(errors[0]?.message).toMatch(message);
  });

  it('accepts arrow functions and export lists', () => {
    const source = `${META}
const run = (t, state) => { state.x = t; };
export const build = (ctx) => ({ x: 0 });
export { run as update };`;
    expect(lint(source)).toEqual([]);
  });

  it('applies the update() rules to an update exported by name', () => {
    const source = `${META}
let n = 0;
function step(t) { n += 1; }
export const build = () => ({});
export { step as update };`;
    expect(errorRules(source)).toEqual(['no-module-state-in-update']);
  });

  it('only warns about a missing title/treatment and a default export', () => {
    const diagnostics = lint(
      `export const meta = { id: 's01' };\n${BUILD}\n${UPDATE}\nexport default 1;`,
    );
    expect(hasErrors(diagnostics)).toBe(false);
    expect(diagnostics.map((item) => item.message)).toEqual([
      expect.stringMatching(/`meta\.title` is missing/),
      expect.stringMatching(/`meta\.treatment` is missing/),
      expect.stringMatching(/ignores the default export/),
    ]);
  });
});

describe('lintScene: syntax errors', () => {
  it('reports unparsable source as a single parse error with its position', () => {
    expect(lint('export const meta = {\n  id: ;\n')).toEqual([
      expect.objectContaining({ rule: 'parse-error', severity: 'error', line: 2, column: 7 }),
    ]);
  });

  it('explains that scenes are plain JavaScript (no TypeScript)', () => {
    const [diagnostic] = lint(`${META}\nexport function build(ctx: unknown) {}`);
    expect(diagnostic?.message).toMatch(/^scenes\/s01\.js is not valid JavaScript/);
    expect(diagnostic?.fix).toMatch(/no TypeScript/);
  });
});
