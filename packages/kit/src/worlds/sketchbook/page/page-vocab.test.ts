/**
 * The open-vocabulary page methods (PLAN.md#13.15a) through the real page: draw / doodle / spot /
 * person / crowd / diagram / defineFigure / defineProp / use, the project asset files
 * (`sketchPage({ library })`, `parseSketchAsset`, `checkSketchAssets`) and the validator helper
 * `sketchAssetFindings`. Errors are readable, results deterministic, the page repaints.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { InkCanvas } from '../draw/canvas.js';
import { checkSketchAssets, parseSketchAsset, sketchAssetFindings } from '../vocab/library.js';
import { DIAGRAM_KINDS } from '../vocab/diagrams.js';
import type { FigureHandle } from './api-figure.js';
import type { Drawing } from './api-vocab.js';
import { sketchPageModel } from './sketch-page.js';

interface Page {
  draw(kind: unknown, options?: unknown): Drawing;
  doodle(spec: unknown, options?: unknown): Drawing;
  spot(art: unknown, options?: unknown): Drawing;
  use(id: unknown, options?: unknown): Drawing;
  person(options: unknown): FigureHandle;
  crowd(options: unknown): Drawing;
  diagram(kind: unknown, spec?: unknown): { at: number; end: number };
  defineFigure(id: unknown, look?: unknown): void;
  defineProp(id: unknown, spec?: unknown): void;
  update(t: number): void;
}

function page(params: Record<string, unknown> = {}): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const make = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!make) throw new Error('sketchPage is not bound');
  return make({ size: [960, 540], seed: 21, duration: 9, ...params });
}

function pixels(target: Page, t: number): Uint8Array {
  const model = sketchPageModel(target);
  if (!model) throw new Error('no model');
  const canvas = new InkCanvas(960, 540);
  model.render(canvas, t);
  return canvas.data;
}

const RANGER = {
  version: 1,
  id: 'ranger',
  kind: 'figure',
  description: 'The park ranger',
  spec: { clothes: 'vest', hat: 'brim', holds: 'axe' },
};
const TOWER = {
  version: 1,
  id: 'fire-tower',
  kind: 'prop',
  description: 'Fire lookout',
  spec: { draw: 'building', type: 'tower', h: 140 },
};

describe('page.draw', () => {
  it('draws a generator kind and returns its times and page box', () => {
    const p = page();
    const tree = p.draw('tree', { type: 'pine', x: 300, y: 480, h: 200, at: 1 });
    expect(tree.at).toBe(1);
    expect(tree.end).toBeGreaterThan(1.2);
    const [x, y, w, h] = tree.box;
    expect(y + h).toBeGreaterThan(470);
    expect(h).toBeGreaterThan(180);
    expect(x + w / 2).toBeGreaterThan(260);
    expect(x + w / 2).toBeLessThan(340);
  });

  it('fails with the list of kinds / types / knobs', () => {
    const p = page();
    expect(() => p.draw('dragon', { x: 1, y: 1 })).toThrow(
      /unknown kind "dragon"; kinds are .*beast.*tree/,
    );
    expect(() => p.draw('tree', { x: 1, y: 1, type: 'banyan' })).toThrow(/type.*pine/);
    expect(() => p.draw('beast', { x: 1, y: 1, type: 'dog', action: 'fly' })).toThrow(/action/);
  });

  it('is deterministic: the same page twice paints the same pixels', () => {
    const scene = (): Page => {
      const p = page();
      p.draw('beast', { type: 'fox', x: 300, y: 400, at: 0.2 });
      p.draw('effect', { type: 'rain', x: 600, y: 300, at: 1 });
      return p;
    };
    expect(pixels(scene(), 2)).toEqual(pixels(scene(), 2));
  });
});

describe('page.doodle / page.spot / page.use', () => {
  it('draws the DSL and the spot art; errors name the part', () => {
    const p = page();
    const d = p.doodle(
      { box: [50, 50], parts: [{ circle: [25, 25, 20], fill: 'red' }] },
      { x: 200, y: 300, h: 100 },
    );
    expect(d.box[3]).toBeGreaterThan(70);
    expect(() => p.doodle({ parts: [{ star: [1, 2] }] }, { x: 0, y: 0 })).toThrow(
      /parts\[0\] needs exactly one shape key/,
    );
    const s = p.spot(
      { rows: ['##', '#.'], legend: { '#': 'green' }, px: 10 },
      { x: 500, y: 300, h: 40 },
    );
    expect(s.end).toBeGreaterThan(s.at);
  });

  it('defines a prop once and draws the same thing everywhere (seeded by its id)', () => {
    const a = page();
    const b = page({ seed: 99 });
    for (const p of [a, b]) p.defineProp('lantern', { draw: 'object', type: 'lantern', h: 60 });
    expect(a.use('lantern', { x: 300, y: 300, at: -1 }).box).toEqual(
      b.use('lantern', { x: 300, y: 300, at: -1 }).box,
    );
    expect(() => {
      a.defineProp('lantern', { doodle: { parts: [{ circle: [1, 1, 1] }] } });
    }).toThrow(/already defined/);
    expect(() => {
      a.defineProp('Lantern 2', { doodle: {} });
    }).toThrow(/kebab-case/);
    expect(() => {
      a.defineProp('bad', { sketch: {} });
    }).toThrow(/a prop is \{ doodle/);
    expect(() => a.use('kettle', { x: 0, y: 0 })).toThrow(/no prop "kettle" \(defined: lantern\)/);
  });
});

describe('page.person / page.crowd', () => {
  it('poses, faces and dresses a person; holds a built-in tool or a prop', () => {
    const p = page();
    const right = p.person({
      x: 300,
      y: 450,
      h: 200,
      action: 'point',
      clothes: 'coat',
      hat: 'cap',
      holds: 'axe',
    });
    const left = p.person({ x: 700, y: 450, h: 200, action: 'point', face: -1 });
    expect(right.jointAt('handR', 5)[0]).toBeGreaterThan(right.jointAt('neck', 5)[0] + 40);
    expect(left.jointAt('handR', 5)[0]).toBeLessThan(left.jointAt('neck', 5)[0] - 40);
    p.defineProp('banner', {
      doodle: { box: [20, 40], grip: [0, 40], parts: [{ rect: [0, 0, 20, 30], fill: 'red' }] },
    });
    expect(() => p.person({ x: 1, y: 1, holds: 'banner' })).not.toThrow();
    expect(() => p.person({ x: 1, y: 1, holds: 'flux-capacitor' })).toThrow(
      /holds "flux-capacitor"/,
    );
    expect(() => p.person({ x: 1, y: 1, action: 'dance' })).toThrow(/action/);
    expect(() => p.person({ x: 1, y: 1, hatt: 'cap' })).toThrow(/hatt/);
  });

  it('a defined figure is the same character in every shot; options still override', () => {
    const p = page({ library: [RANGER] });
    const a = p.person({
      like: 'ranger',
      x: 200,
      y: 450,
      action: 'walk',
      mood: [
        { at: 0, mood: 'happy' },
        { at: 2, mood: 'sad' },
      ],
    });
    const b = p.person({ like: 'ranger', x: 600, y: 450, hat: 'none' });
    expect(a.end).toBeGreaterThan(a.at);
    expect(b.end).toBeGreaterThan(b.at);
    expect(() => p.person({ like: 'pirate', x: 1, y: 1 })).toThrow(
      /no figure "pirate" \(defined: ranger\)/,
    );
  });

  it('draws a crowd along a ground line', () => {
    const crowd = page().crowd({ x0: 100, x1: 800, y: 480, count: 10, rows: 2 });
    expect(crowd.box[2]).toBeGreaterThan(600);
  });
});

describe('page.diagram', () => {
  const SPECS: Record<string, unknown> = {
    callout: { x: 300, y: 300, label: 'here', from: [500, 200] },
    timeline: {
      x: 100,
      y: 300,
      w: 700,
      events: [{ label: 'first' }, { label: 'second' }, { label: 'third' }],
      highlight: 2,
    },
    map: {
      x: 100,
      y: 80,
      w: 600,
      h: 400,
      route: [
        [0.1, 0.5],
        [0.9, 0.4],
      ],
      mark: [0.5, 0.5],
      places: [{ label: 'camp', at: [0.2, 0.3] }],
    },
    bars: {
      x: 100,
      y: 450,
      w: 500,
      h: 300,
      bars: [
        { value: 3, label: 'a' },
        { value: 7, label: 'b' },
      ],
      values: true,
      highlight: 1,
    },
    line: {
      x: 100,
      y: 450,
      w: 500,
      h: 300,
      points: [1, 3, 2, 8],
      from: 'then',
      to: 'now',
      highlight: 3,
    },
    pie: {
      x: 400,
      y: 280,
      r: 120,
      slices: [
        { value: 2, label: 'land' },
        { value: 5, label: 'sea' },
      ],
    },
    venn: { x: 400, y: 280, r: 120, sets: [{ label: 'birds' }, { label: 'fliers' }], both: 'most' },
    flow: {
      x: 100,
      y: 250,
      w: 760,
      steps: [{ label: 'seed' }, { label: 'tree' }, { label: 'forest' }],
    },
    stack: { x: 100, y: 120, items: [{ label: 'one' }, { label: 'two' }], bullet: 'check' },
    cutaway: {
      x: 100,
      y: 100,
      w: 500,
      h: 350,
      layers: [
        { label: 'soil', color: 'kraft', depth: 1 },
        { label: 'rock', color: 'graphiteLight', depth: 2 },
      ],
    },
  };

  it('draws every kind from a short spec and repaints', () => {
    expect(Object.keys(SPECS).sort()).toEqual([...DIAGRAM_KINDS].sort());
    for (const kind of DIAGRAM_KINDS) {
      const p = page();
      const drawn = p.diagram(kind, SPECS[kind]);
      expect(drawn.end, kind).toBeGreaterThan(drawn.at);
      expect(() => {
        p.update(drawn.end + 0.5);
      }).not.toThrow();
    }
  });

  it('fails with the list of diagrams and the bad field', () => {
    const p = page();
    expect(() => p.diagram('sankey', {})).toThrow(/diagrams are callout, timeline, map/);
    expect(() => p.diagram('bars', { x: 0, y: 0, w: 100, h: 100, bars: [] })).toThrow(/bars/);
  });
});

describe('project asset files', () => {
  it('validates a file and its name; reports every error of a folder', () => {
    expect(parseSketchAsset(RANGER, 'assets/sketchbook/ranger.json').id).toBe('ranger');
    expect(() => parseSketchAsset(RANGER, 'assets/sketchbook/guard.json')).toThrow(
      /must be named ranger\.json/,
    );
    expect(() =>
      parseSketchAsset({ ...TOWER, spec: { draw: 'castle' } }, 'fire-tower.json'),
    ).toThrow(/unknown kind "castle"/);
    const report = checkSketchAssets([
      { name: 'ranger.json', value: RANGER },
      { name: 'fire-tower.json', value: TOWER },
      { name: 'ranger.js', value: RANGER },
      { name: 'oops.json', value: { version: 2 } },
    ]);
    expect(report.assets.map((asset) => asset.id)).toEqual(['ranger', 'fire-tower']);
    expect(report.errors).toHaveLength(2);
    expect(report.errors[0]).toMatch(/defined twice/);
  });

  it('reaches the page through sketchPage({ library }); a bad entry fails the page', () => {
    const p = page({ library: [RANGER, TOWER] });
    expect(p.use('fire-tower', { x: 100, y: 400 }).box[3]).toBeGreaterThan(120);
    expect(() => page({ library: [{ ...TOWER, kind: 'house' }] })).toThrow(/kind/);
  });

  it('flags ids a scene uses that nobody defined', () => {
    const source = [
      "page.defineProp('kettle', { draw: 'object', type: 'pot' });",
      "page.use('kettle', { x: 1, y: 1 });",
      "page.use('fire-tower', { x: 1, y: 1 });",
      "page.person({ like: 'ranger', holds: 'axe', x: 1, y: 1 });",
      "page.person({ like: 'pirate', holds: 'parrot', x: 1, y: 1 });",
    ].join('\n');
    const findings = sketchAssetFindings(source, ['fire-tower', 'ranger']);
    expect(findings.map((finding) => `${String(finding.line)}:${finding.id}`)).toEqual([
      '5:pirate',
      '5:parrot',
    ]);
    expect(findings[0]?.message).toMatch(/assets\/sketchbook\/pirate\.json/);
  });
});
