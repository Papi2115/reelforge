/**
 * Test support: a FrameRenderer double for the scene stage's orchestration tests (limits,
 * resume, concurrency, cancel) without a browser. It reads the scene file and obeys markers:
 * `// render:blank` (uniform frames), `// render:fail` (scene does not load), `// render:overlap`
 * (an overlapping-cards diagnostic), `// render:timeout` (the renderer timed out twice); otherwise
 * frames are colourful. A role lineup is answered by scripted-lineup.ts. A standalone prop
 * turntable reads the prop module instead: `// render:fail` (does not load), `// render:floating`
 * (a part floats), otherwise a good prop. Rendering of real scenes is covered by the Playwright
 * tests.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CardDiagnostic } from '@reelforge/engine';
import { METRICS_CUE } from '@reelforge/cli/service';
import { propExtensionFile, storyboardFileSchema } from '@reelforge/shared';
import type { FrameRenderer, ShotRender, ShotRenderRequest } from '../scenes/tools.js';
import { lineupRoleId, renderLineup } from './scripted-lineup.js';

const WIDTH = 160;
const HEIGHT = 90;

function frame(blank: boolean, t: number): Uint8Array {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    const value = blank ? [20, 20, 40] : [(x * 3 + t * 10) % 256, (y * 5) % 256, (x + y) % 256];
    data.set([...value, 255], offset);
  }
  return data;
}

function overlap(shotId: string): CardDiagnostic {
  return {
    rule: 'card-overlap',
    severity: 'error',
    shotId,
    cards: ['a', 'b'],
    t0: 0,
    t1: 1,
    message: `cards "a" and "b" overlap during t=0.00–1.00 s of shot ${shotId}`,
    fix: 'Move one card.',
  };
}

export class ScriptedFrameRenderer implements FrameRenderer {
  readonly calls: ShotRenderRequest[] = [];
  active = 0;
  maxActive = 0;

  /** `delayMs`: time a render takes (makes overlapping jobs observable). */
  constructor(private readonly delayMs = 20) {}

  async renderShot(request: ShotRenderRequest, signal: AbortSignal): Promise<ShotRender> {
    this.calls.push(request);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      if (signal.aborted) throw new Error('aborted');
      return await this.render(request);
    } finally {
      this.active -= 1;
    }
  }

  private async renderTurntable(request: ShotRenderRequest, scene: string): Promise<ShotRender> {
    const turntable = await readFile(path.join(request.projectDir, ...scene.split('/')), 'utf8');
    const role = lineupRoleId(turntable);
    if (role !== undefined) return renderLineup(request, role);
    const name = /const NAME = "([A-Za-z0-9]+)"/.exec(turntable)?.[1] ?? '';
    const file = propExtensionFile(name);
    const source = await readFile(path.join(request.projectDir, ...file.split('/')), 'utf8');
    if (source.includes('// render:fail')) {
      return {
        ok: false,
        error: `${file}: prop.build(ctx, params) must return a kit object`,
        errors: [],
      };
    }
    const metrics = {
      size: [0.9, 1.8, 0.8],
      meshes: 2,
      voxels: 900,
      floatingParts: source.includes('// render:floating') ? ['part 2 floats at y=2.00'] : [],
    };
    return {
      ok: true,
      width: WIDTH,
      height: HEIGHT,
      // Views repeat every 4 s: the repeat of the first view is identical (determinism check).
      frames: request.times.map((t) => ({
        t,
        image: { width: WIDTH, height: HEIGHT, data: frame(false, t % 4) },
      })),
      cards: [],
      anchors: [],
      cues: [{ t: 0, name: `${METRICS_CUE}${JSON.stringify(metrics)}`, shotId: request.shotId }],
      errors: [],
    };
  }

  private async render(request: ShotRenderRequest): Promise<ShotRender> {
    if (request.standalone !== undefined) {
      return this.renderTurntable(request, request.standalone.scene);
    }
    const storyboard = storyboardFileSchema.parse(
      JSON.parse(await readFile(path.join(request.projectDir, 'storyboard.json'), 'utf8')),
    );
    const shot = storyboard.shots.find((candidate) => candidate.id === request.shotId);
    if (shot === undefined)
      return { ok: false, error: `unknown shot ${request.shotId}`, errors: [] };
    const scene = request.scene ?? shot.scene;
    const source = await readFile(path.join(request.projectDir, ...scene.split('/')), 'utf8');
    if (source.includes('// render:fail')) {
      return { ok: false, error: `[shot ${shot.id}] build() threw: scripted failure`, errors: [] };
    }
    if (source.includes('// render:timeout')) {
      const error = 'the frame renderer did not answer (load) within 180000 ms';
      return { ok: false, timedOut: true, error, errors: [] };
    }
    const blank = source.includes('// render:blank');
    return {
      ok: true,
      width: WIDTH,
      height: HEIGHT,
      frames: request.times.map((t) => ({
        t,
        image: { width: WIDTH, height: HEIGHT, data: frame(blank, t) },
      })),
      cards: request.cards && source.includes('// render:overlap') ? [overlap(shot.id)] : [],
      anchors: [],
      cues: [],
      errors: [],
    };
  }
}
