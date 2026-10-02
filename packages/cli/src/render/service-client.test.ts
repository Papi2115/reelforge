/**
 * The render-service path of the CLI against a fake service (node:http on loopback): env parsing,
 * typed errors (usage / project / auth / timeout / unreachable / protocol) and the rendering
 * commands end to end with frames coming from the service instead of Playwright.
 */
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { decodePng, encodePng } from '@reelforge/engine/raster';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectError, UsageError } from '../errors.js';
import { planServiceShot } from '../service/plan.js';
import {
  RENDER_SERVICE_VERSION,
  RENDER_TOKEN_ENV,
  RENDER_URL_ENV,
  type ShotRenderResponse,
} from '../service/protocol.js';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { RenderServiceClient, RenderServiceError, renderServiceFromEnv } from './service-client.js';

const TOKEN = 'test-token-0123456789';

interface Recorded {
  readonly route: string;
  readonly auth: string | undefined;
  readonly body: unknown;
}

type Handler = (body: unknown, response: ServerResponse) => Promise<void> | void;

let server: Server;
let url = '';
const recorded: Recorded[] = [];
const handlers = new Map<string, Handler>();

/** A frame with some structure (not blank): diagonal colour bands. */
function syntheticFrame(width: number, height: number, seed: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data.set([(x + seed) % 256, (y * 2) % 256, ((x + y) * 3) % 256, 255], offset);
    }
  }
  return data;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text === '' ? undefined : (JSON.parse(text) as unknown);
}

/** Answers like the app: the plan comes from the same server-side planner. */
async function renderLikeTheApp(body: unknown, response: ServerResponse): Promise<void> {
  const request = body as { projectDir: string; shot?: string; scene?: string; at?: number[] };
  const { plan } = await planServiceShot(request, request.at ?? []);
  const reply: ShotRenderResponse = {
    version: RENDER_SERVICE_VERSION,
    shot: { id: plan.id, file: plan.file, t0: plan.t0, t1: plan.t1, standalone: plan.standalone },
    result: {
      ok: true,
      width: 640,
      height: 360,
      style: 'voxel-pixel-crisp640',
      gpu: 'ANGLE (fake GPU)',
      frames: (request.at ?? []).map((t, index) => ({
        t,
        width: 640,
        height: 360,
        png: encodePng({ width: 640, height: 360, data: syntheticFrame(640, 360, index) }).toString(
          'base64',
        ),
      })),
      cards: [],
      anchors: [{ shotId: plan.id, phrase: '61 KB', nth: 1, t: 4.1, tEnd: 4.6 }],
      cues: [{ shotId: plan.id, name: 'hit', t: 4.12 }],
      errors: [],
    },
  };
  json(response, 200, reply);
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const route = new URL(request.url ?? '/', 'http://localhost').pathname;
    void readBody(request).then(async (body) => {
      recorded.push({ route, auth: request.headers.authorization, body });
      const handler = handlers.get(route);
      if (handler === undefined) {
        json(response, 404, { error: { kind: 'not-found', message: `no route ${route}` } });
        return;
      }
      await handler(body, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
  recorded.length = 0;
  handlers.clear();
  handlers.set('/health', (_body, response) => {
    json(response, 200, {
      ok: true,
      service: 'reelforge-render',
      version: RENDER_SERVICE_VERSION,
      projectDir: project.root,
    });
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await project.remove();
});

describe('renderServiceFromEnv', () => {
  it('is undefined without the URL and validates URL + token', () => {
    expect(renderServiceFromEnv({})).toBeUndefined();
    expect(renderServiceFromEnv({ [RENDER_URL_ENV]: url, [RENDER_TOKEN_ENV]: TOKEN })).toEqual({
      url,
      token: TOKEN,
    });
    expect(() => renderServiceFromEnv({ [RENDER_URL_ENV]: url })).toThrow(/TOKEN is missing/);
    expect(() =>
      renderServiceFromEnv({ [RENDER_URL_ENV]: 'http://example.com:80', [RENDER_TOKEN_ENV]: 'x' }),
    ).toThrow(/loopback/);
    expect(() =>
      renderServiceFromEnv({ [RENDER_URL_ENV]: 'https://127.0.0.1:1', [RENDER_TOKEN_ENV]: 'x' }),
    ).toThrow(/loopback/);
  });
});

describe('RenderServiceClient', () => {
  it('sends the bearer token and validates replies', async () => {
    const client = new RenderServiceClient({ url, token: TOKEN });
    expect(await client.health()).toMatchObject({ ok: true, projectDir: project.root });
    expect(recorded[0]).toMatchObject({ route: '/health', auth: `Bearer ${TOKEN}` });
  });

  it('maps service errors to UsageError / typed project errors', async () => {
    handlers.set('/frames', (_body, response) => {
      json(response, 400, { error: { kind: 'usage', message: 'at: too many times' } });
    });
    handlers.set('/cards', (_body, response) => {
      json(response, 403, {
        error: { kind: 'forbidden', message: 'not the open project', fix: 'run it in the project' },
      });
    });
    handlers.set('/anchors', (_body, response) => {
      json(response, 200, { version: 99 });
    });
    const client = new RenderServiceClient({ url, token: TOKEN });
    const target = { projectDir: project.root, shot: 's01' };
    await expect(client.frames({ ...target, at: [0] })).rejects.toBeInstanceOf(UsageError);
    const forbidden = await client.cards(target).catch((error: unknown) => error);
    expect(forbidden).toBeInstanceOf(RenderServiceError);
    expect(forbidden).toMatchObject({ kind: 'forbidden', fix: 'run it in the project' });
    await expect(client.anchors(target)).rejects.toMatchObject({ kind: 'protocol' });
    await expect(client.load(project.root)).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('times out and reports an unreachable service', async () => {
    handlers.set('/health', () => undefined);
    const slow = new RenderServiceClient({ url, token: TOKEN }, { healthTimeoutMs: 200 });
    await expect(slow.health()).rejects.toMatchObject({ kind: 'timeout' });
    const gone = new RenderServiceClient({ url: 'http://127.0.0.1:9', token: TOKEN });
    const error = await gone.health().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProjectError);
    expect(error).toMatchObject({ kind: 'unreachable' });
  });
});

describe('rendering commands through the render service', () => {
  beforeEach(() => {
    handlers.set('/frames', renderLikeTheApp);
    handlers.set('/anchors', renderLikeTheApp);
    vi.stubEnv(RENDER_URL_ENV, url);
    vi.stubEnv(RENDER_TOKEN_ENV, TOKEN);
  });

  it('frames: writes the service frames as PNGs at the usual paths', async () => {
    const run = await runCli(project.root, 'frames', '--shot', 's02', '--at', '0,2.5', '--json');
    expect(run.stderr).toBe('');
    expect(run.code).toBe(0);
    const report = JSON.parse(run.stdout) as { frames: { t: number; file: string }[] };
    expect(report.frames.map((frame) => frame.t)).toEqual([0, 2.5]);
    expect(report.frames[1]?.file).toMatch(/s02[\\/]s02_t2\.500\.png$/);
    const image = decodePng(await readFile(report.frames[1]?.file ?? ''));
    expect(image.data).toEqual(syntheticFrame(640, 360, 1));
    const frames = recorded.find((entry) => entry.route === '/frames');
    expect(frames?.body).toEqual({
      projectDir: project.root,
      shot: 's02',
      scene: 'scenes/s02_calc.js',
      at: [0, 2.5],
      cards: true,
    });
  });

  it('frames --scene: a standalone scene is sent with its duration', async () => {
    await project.write(
      'scenes/draft.js',
      await readFile(`${project.root}/scenes/s01_title.js`, 'utf8'),
    );
    const run = await runCli(project.root, 'frames', '--scene', 'scenes/draft.js', '--at', '1');
    expect(run.code).toBe(0);
    expect(run.stdout).toContain('rendered standalone from t=0');
    const frames = recorded.find((entry) => entry.route === '/frames');
    expect(frames?.body).toMatchObject({ scene: 'scenes/draft.js', duration: 5, at: [1] });
  });

  it('anchors: a build-only dry run through /anchors', async () => {
    const run = await runCli(project.root, 'anchors', '--shot', 's02');
    expect(run.stdout).toContain('"61 KB"');
    expect(recorded.map((entry) => entry.route)).toEqual(['/health', '/anchors']);
  });
});
