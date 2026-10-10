/**
 * The Grim Ink fonts exception (PLAN.md#14.18, ADR-005 addendum) in the lint: `ink.text` is a
 * kit call and passes, raw canvas text (`fillText`, `strokeText`, a `font =`) and `document` stay
 * forbidden in people / places modules and in scenes.
 */
import { describe, expect, it } from 'vitest';
import { lintInkModule } from './lint-ink-module.js';
import { lintScene } from './lint-scene.js';

const FILE = 'kit-ext/places/room.js';
const place = (body: string): string =>
  `export const place = { id: 'room', name: 'Room', bounds: [1920, 1080], draw(g, ink, t, opts) { ${body} } };`;

const errors = (source: string): string[] =>
  lintInkModule(source, { filename: FILE }, 'places')
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => diagnostic.message);

describe('ink.text in the lint', () => {
  it('lets a module letter through ink.text, never through the canvas', () => {
    expect(errors(place("ink.text('LEDGER', { role: 'ledger', x: 400, y: 300 });"))).toEqual([]);
    expect(errors(place("g.fillText('LEDGER', 400, 300);")).join('\n')).toMatch(/font/);
    expect(errors(place("g.font = '20px Georgia';")).join('\n')).toMatch(/font/);
    expect(errors(place('const c = document.createElement("canvas");'))).not.toEqual([]);
  });

  it('lets a scene call env.ink.text and still forbids document', () => {
    const scene = (body: string): string => `export const meta = { id: 's01', title: 'T' };
export function build(ctx) { return { stage: ctx.kit.fx.inkStage() }; }
export function update(t, s) { s.stage.paint(t, (g, env) => { ${body} }); }`;
    const sceneErrors = (body: string): string[] =>
      lintScene(scene(body), { filename: 'scenes/s01.js' })
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.rule);
    expect(sceneErrors("env.ink.text('OPTIONAL', { role: 'poster', x: 960, y: 300 });")).toEqual(
      [],
    );
    expect(sceneErrors('document.title = "x";')).not.toEqual([]);
  });
});
