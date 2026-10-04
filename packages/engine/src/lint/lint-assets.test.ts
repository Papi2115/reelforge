/**
 * Scenes cannot fetch or decode pictures themselves (PLAN.md#12.11, ADR-014): media decoders and
 * Three.js loaders are lint errors; the supported route (`ctx.assets.image` + a kit prop) is clean.
 */
import { describe, expect, it } from 'vitest';
import { lintScene } from './lint-scene.js';

const META = "export const meta = { id: 's01', title: 'Asset', treatment: 'montage/transition' };";

function scene(buildBody: string): string {
  return [
    META,
    `export function build(ctx) {\n${buildBody}\nreturn {};\n}`,
    'export function update(t, state, ctx) {}',
  ].join('\n');
}

function errors(source: string) {
  return lintScene(source, { filename: 'scenes/s01.js' }).filter(
    (diagnostic) => diagnostic.severity === 'error',
  );
}

describe('lintScene: scenes do not load or decode pictures', () => {
  const cases: [string, string][] = [
    ['new Image', "const image = new Image(); image.src = 'photo.jpg';"],
    ['createImageBitmap', 'createImageBitmap(ctx.shot);'],
    ['ImageDecoder', "const decoder = new ImageDecoder({ type: 'image/png' });"],
    ['VideoDecoder', 'const decoder = new VideoDecoder({});'],
    ['OffscreenCanvas', 'const canvas = new OffscreenCanvas(64, 64);'],
    ['FileReader', 'const reader = new FileReader();'],
    ['Blob', 'const blob = new Blob([]);'],
    ['Response', 'new Response(null).arrayBuffer();'],
    ['window.Image', 'const image = new window.Image();'],
    ['fetch', "fetch('https://upload.wikimedia.org/x.jpg');"],
    ['TextureLoader', "new ctx.three.TextureLoader().load('photo.jpg');"],
    ['ImageLoader', "new ctx.three.ImageLoader().load('photo.jpg');"],
    ['FileLoader', "new ctx.three.FileLoader().load('data.bin');"],
    ['destructured loader', "const { TextureLoader } = ctx.three; new TextureLoader().load('x');"],
  ];

  it.each(cases)('%s is a no-network error that points at ctx.assets', (_label, body) => {
    const found = errors(scene(body));
    expect(found.map((diagnostic) => diagnostic.rule)).toContain('no-network');
    const decoding = found.find((diagnostic) => diagnostic.rule === 'no-network');
    if (_label !== 'fetch') expect(decoding?.fix).toContain('ctx.assets.image');
  });

  it('accepts the supported route: ctx.assets.image + a kit prop, with a fallback', () => {
    const source = scene(
      [
        "const photo = ctx.assets.has('nasa-apollo') ? ctx.assets.image('nasa-apollo', { crop: 'cover' }) : null;",
        'const prop = photo',
        '  ? ctx.kit.props.photoFrame({ asset: photo, pixels: 64 })',
        "  : ctx.kit.props.monitor({ screen: 'chart' });",
        'ctx.scene.add(prop);',
      ].join('\n'),
    );
    expect(lintScene(source, { filename: 'scenes/s01.js' })).toEqual([]);
  });
});
