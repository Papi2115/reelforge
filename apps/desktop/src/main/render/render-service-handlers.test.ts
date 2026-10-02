import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decodePng } from '@reelforge/engine/raster';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RenderPool } from './render-pool.js';
import { createRenderServiceHandlers, upscaleNearest } from './render-service-handlers.js';
import { ServiceError } from './render-service.js';
import { FAKE_GPU, fakeFrame, fakeTargets } from './testing/fake-render-target.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);

let base: string;
let projectDir: string;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'rf service ż '));
  projectDir = path.join(base, 'my project');
  await cp(FIXTURE, projectDir, { recursive: true });
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

function setup(): {
  handlers: ReturnType<typeof createRenderServiceHandlers>;
  targets: ReturnType<typeof fakeTargets>;
  pool: RenderPool;
} {
  const targets = fakeTargets();
  const pool = new RenderPool(targets.open);
  return { handlers: createRenderServiceHandlers(pool), targets, pool };
}

describe('render service handlers', () => {
  it('frames: the CLI isolated manifest, frames at local times as PNG, card QA, shot anchors', async () => {
    const { handlers, targets, pool } = setup();
    const response = await handlers.frames({ projectDir, shot: 's02', at: [0, 2.5], cards: true });
    expect(response.shot).toEqual({
      id: 's02',
      file: 'scenes/s02_calc.js',
      t0: 2.2,
      t1: 7.5,
      standalone: false,
    });
    const target = targets.opened[0];
    // Padding shot + s02 at its timeline place (exactly what the Playwright path loads).
    expect(target?.loads[0]?.shots.map((shot) => shot.id)).toEqual(['pad-s02', 's02']);
    expect(target?.frames).toEqual([2.2, 4.7]);
    if (!response.result.ok) throw new Error(response.result.error);
    expect(response.result).toMatchObject({ width: 640, height: 360, gpu: FAKE_GPU, cards: [] });
    expect(response.result.anchors.map((anchor) => anchor.shotId)).toEqual(['s02']);
    expect(response.result.cues.map((cue) => cue.shotId)).toEqual(['s02']);
    const png = decodePng(Buffer.from(response.result.frames[1]?.png ?? '', 'base64'));
    expect(png.data).toEqual(fakeFrame(4.7));
    await pool.close();
  });

  it('frames: files output under .reelforge/frames and export-preset upscaling', async () => {
    const { handlers, pool } = setup();
    const files = await handlers.frames({ projectDir, shot: 's01', at: [1], output: 'files' });
    if (!files.result.ok) throw new Error(files.result.error);
    const file = files.result.frames[0]?.file ?? '';
    expect(file).toBe(path.join(projectDir, '.reelforge', 'frames', 's01', 's01_t1.000.png'));
    expect(decodePng(await readFile(file)).data).toEqual(fakeFrame(1));
    const big = await handlers.frames({ projectDir, shot: 's01', at: [1], preset: '1080p30' });
    if (!big.result.ok) throw new Error(big.result.error);
    const image = decodePng(Buffer.from(big.result.frames[0]?.png ?? '', 'base64'));
    expect([image.width, image.height]).toEqual([1920, 1080]);
    expect(Array.from(image.data.subarray(0, 4))).toEqual(Array.from(fakeFrame(1).subarray(0, 4)));
    await pool.close();
  });

  it('a scene that fails to load is a result with its console errors', async () => {
    const { handlers, pool } = setup();
    await writeFile(path.join(projectDir, 'scenes', 's02_calc.js'), '// FAIL_LOAD\n');
    const response = await handlers.cards({ projectDir, shot: 's02' });
    expect(response.result).toEqual({
      ok: false,
      error: '[shot s02] build() threw: boom',
      errors: ['Uncaught TypeError: boom'],
    });
    await pool.close();
  });

  it('a scene that throws while rendering a frame is a result, not a renderer failure', async () => {
    const { handlers, targets, pool } = setup();
    const file = path.join(projectDir, 'scenes', 's02_calc.js');
    await writeFile(file, `// FAIL_FRAME\n${await readFile(file, 'utf8')}`);
    const response = await handlers.frames({ projectDir, shot: 's02', at: [0, 2.5] });
    expect(response.result).toEqual({
      ok: false,
      error: 'rendering t=2.50s: [shot s02] update(4.7) threw TypeError: x is undefined',
      errors: ['Uncaught TypeError: x is undefined'],
    });
    expect(targets.opened).toHaveLength(1);
    expect(targets.opened[0]?.alive).toBe(true);
    await pool.close();
  });

  it('a crashed renderer is a 502 and the next request gets a fresh window', async () => {
    const { handlers, targets, pool } = setup();
    await writeFile(path.join(projectDir, 'scenes', 'crash.js'), '// CRASH\n');
    const crash = await handlers
      .anchors({ projectDir, scene: 'scenes/crash.js' })
      .catch((error: unknown) => error);
    expect(crash).toBeInstanceOf(ServiceError);
    expect(crash).toMatchObject({ kind: 'renderer', status: 502 });
    const anchors = await handlers.anchors({ projectDir, shot: 's01' });
    expect(anchors.result.ok).toBe(true);
    expect(targets.opened).toHaveLength(2);
    await pool.close();
  });

  it('maps the CLI planning errors: unknown shot (422), time outside the shot (400)', async () => {
    const { handlers, pool } = setup();
    await expect(handlers.cards({ projectDir, shot: 's09' })).rejects.toMatchObject({
      kind: 'project',
      status: 422,
      fix: expect.stringContaining('s01, s02') as unknown,
    });
    await expect(handlers.frames({ projectDir, shot: 's01', at: [3] })).rejects.toMatchObject({
      kind: 'usage',
      status: 400,
    });
    await expect(
      handlers.frames({ projectDir, scene: '../outside.js', at: [0] }),
    ).rejects.toMatchObject({ kind: 'usage' });
    await pool.close();
  });

  it('standalone scenes render from t=0 for the requested duration', async () => {
    const { handlers, targets, pool } = setup();
    await writeFile(path.join(projectDir, 'scenes', 'draft.js'), 'export function build() {}\n');
    const response = await handlers.frames({
      projectDir,
      scene: 'scenes/draft.js',
      duration: 6,
      at: [5.5],
    });
    expect(response.shot).toMatchObject({ id: 'draft', t0: 0, t1: 6, standalone: true });
    expect(targets.opened[0]?.frames).toEqual([5.5]);
    await pool.close();
  });

  it('load: the whole project (preview manifest) with every anchor', async () => {
    const { handlers, pool } = setup();
    const response = await handlers.load({ projectDir });
    if (!response.result.ok) throw new Error(response.result.error);
    expect(response.result.shots).toEqual(['s01', 's02']);
    expect(response.result.anchors).toHaveLength(2);
    await rm(path.join(projectDir, 'storyboard.json'));
    await expect(handlers.load({ projectDir })).rejects.toMatchObject({ kind: 'project' });
    await pool.close();
  });

  it('serves requests one at a time in one warm window', async () => {
    const { handlers, targets, pool } = setup();
    await Promise.all([
      handlers.frames({ projectDir, shot: 's01', at: [0] }),
      handlers.frames({ projectDir, shot: 's02', at: [0] }),
      handlers.anchors({ projectDir, shot: 's01' }),
    ]);
    expect(targets.opened).toHaveLength(1);
    expect(targets.opened[0]?.loads.map((manifest) => manifest.shots.at(-1)?.id)).toEqual([
      's01',
      's02',
      's01',
    ]);
    await pool.close();
  });
});

describe('upscaleNearest', () => {
  it('repeats every pixel factor x factor times', () => {
    const image = { width: 2, height: 1, data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) };
    const scaled = upscaleNearest(image, 2);
    expect([scaled.width, scaled.height]).toEqual([4, 2]);
    expect(Array.from(scaled.data)).toEqual([
      1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 7, 8, 1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 5, 6, 7,
      8,
    ]);
    expect(upscaleNearest(image, 1)).toBe(image);
  });
});
