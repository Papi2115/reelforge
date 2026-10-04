/**
 * Test support: the ScriptedFrameRenderer's answer for a role lineup (PLAN.md#12.20) without a
 * browser. Frames use the project style's palette colours (the vibe guard passes), one pattern per
 * view, so the repeat of the first view is identical. The role file's `notes` steer it:
 * `render:tall` (2.6 units tall, outside the pack's range), `render:fail` (does not load).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROLE_METRICS_CUE } from '@reelforge/cli/service';
import { resolveStyle } from '@reelforge/engine';
import { castRoleFile, projectFileSchema } from '@reelforge/shared';
import type { ShotRender, ShotRenderRequest } from '../scenes/tools.js';

const WIDTH = 160;
const HEIGHT = 90;
/** Views of the lineup (LINEUP_VIEWS): time t shows view floor(t) % VIEWS. */
const VIEWS = 6;

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function frame(colors: readonly [number, number, number][], view: number): Uint8Array {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    const pixel = offset / 4;
    const x = pixel % WIDTH;
    const y = Math.floor(pixel / WIDTH);
    const color = colors[(Math.floor(x / 8) + Math.floor(y / 8) + view) % colors.length] ?? [
      0, 0, 0,
    ];
    data.set([...color, 255], offset);
  }
  return data;
}

async function readText(dir: string, relative: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(dir, ...relative.split('/')), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** The role id of a generated lineup scene, if `source` is one. */
export function lineupRoleId(source: string): string | undefined {
  return /const ROLE = "([A-Za-z0-9]+)"/.exec(source)?.[1];
}

export async function renderLineup(request: ShotRenderRequest, id: string): Promise<ShotRender> {
  const role = (await readText(request.projectDir, castRoleFile(id))) ?? '';
  if (role.includes('render:fail')) {
    return { ok: false, error: `kit.cast.person(id): unknown person "${id}"`, errors: [] };
  }
  const project = projectFileSchema.parse(
    JSON.parse((await readText(request.projectDir, 'project.json')) ?? '{}'),
  );
  const colors = Object.values(resolveStyle({ style: project.style }).swatches).map(rgb);
  const height = role.includes('render:tall') ? 2.6 : 1.7;
  const metrics = { size: [0.9, height, 0.7], packHeight: [1.4, 1.8] };
  return {
    ok: true,
    width: WIDTH,
    height: HEIGHT,
    frames: request.times.map((t) => ({
      t,
      image: { width: WIDTH, height: HEIGHT, data: frame(colors, Math.floor(t) % VIEWS) },
    })),
    cards: [],
    anchors: [],
    cues: [{ t: 0, name: `${ROLE_METRICS_CUE}${JSON.stringify(metrics)}`, shotId: request.shotId }],
    errors: [],
  };
}
