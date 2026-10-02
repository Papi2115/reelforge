import { mkdtemp, rm } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RENDER_SERVICE_VERSION, type ShotRenderResponse } from '@reelforge/cli/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import type { RenderServiceHandlers } from './render-service-handlers.js';
import {
  ServiceError,
  startRenderService,
  tokenMatches,
  type RenderService,
} from './render-service.js';

const rendered: ShotRenderResponse = {
  version: RENDER_SERVICE_VERSION,
  shot: { id: 's01', file: 'scenes/s01.js', t0: 0, t1: 2, standalone: false },
  result: { ok: false, error: 'not rendered in this test', errors: [] },
};

let base: string;
let projectDir: string | undefined;
let service: RenderService;
let calls: string[];
let token: string;
let failWith: Error | undefined;

beforeEach(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'rf http ż '));
  projectDir = path.join(base);
  calls = [];
  failWith = undefined;
  const respond = (name: string): Promise<ShotRenderResponse> => {
    calls.push(name);
    return failWith === undefined ? Promise.resolve(rendered) : Promise.reject(failWith);
  };
  const handlers: RenderServiceHandlers = {
    load: () => Promise.reject(new Error('not in this test')),
    frames: () => respond('frames'),
    cards: () => respond('cards'),
    anchors: () => respond('anchors'),
  };
  service = await startRenderService({
    handlers,
    projectDir: () => projectDir,
    log: createLogger(() => undefined),
  });
  token = service.env().REELFORGE_RENDER_TOKEN ?? '';
});

afterEach(async () => {
  await service.close();
  await rm(base, { recursive: true, force: true });
});

interface Reply {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Record<string, string | string[] | undefined>;
}

/** Raw HTTP (fetch would not let the test set Host / Origin freely). */
function send(
  method: string,
  route: string,
  headers: Record<string, string>,
  body?: string,
): Promise<Reply> {
  const url = new URL(service.url);
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      { host: url.hostname, port: url.port, path: route, method, headers },
      (response) => {
        let text = '';
        response.setEncoding('utf8').on('data', (chunk: string) => (text += chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: text === '' ? undefined : (JSON.parse(text) as unknown),
            headers: response.headers,
          });
        });
      },
    );
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

const auth = (): Record<string, string> => ({ authorization: `Bearer ${token}` });
const json = (): Record<string, string> => ({ ...auth(), 'content-type': 'application/json' });
const anchors = (body: unknown, headers = json()): Promise<Reply> =>
  send('POST', '/anchors', headers, JSON.stringify(body));

describe('render service HTTP', () => {
  it('listens on loopback and hands out the env for child processes', () => {
    expect(service.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(service.env()).toEqual({
      REELFORGE_RENDER_URL: service.url,
      REELFORGE_RENDER_TOKEN: token,
    });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('answers health and routes to the handlers; never sends CORS headers', async () => {
    const health = await send('GET', '/health', auth());
    expect(health).toMatchObject({
      status: 200,
      body: { ok: true, service: 'reelforge-render', projectDir },
    });
    const reply = await anchors({ projectDir, shot: 's01' });
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(rendered);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    expect(calls).toEqual(['anchors']);
  });

  it('refuses missing/wrong tokens, browser origins and foreign Host headers', async () => {
    expect((await send('GET', '/health', {})).status).toBe(401);
    expect((await send('GET', '/health', { authorization: `Bearer ${token}x` })).status).toBe(401);
    expect((await send('GET', '/health', { authorization: token })).status).toBe(401);
    const browser = await send('GET', '/health', { ...auth(), origin: 'http://127.0.0.1:5173' });
    expect(browser).toMatchObject({ status: 403, body: { error: { kind: 'forbidden' } } });
    expect((await send('GET', '/health', { ...auth(), host: 'evil.example:80' })).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('renders only the open project folder', async () => {
    const other = await anchors({ projectDir: tmpdir(), shot: 's01' });
    expect(other).toMatchObject({ status: 403, body: { error: { kind: 'forbidden' } } });
    expect((await anchors({ projectDir: 'relative', shot: 's01' })).status).toBe(403);
    // Same folder spelled differently (case on Windows, trailing separator) is accepted.
    const spelled =
      process.platform === 'win32' ? (projectDir ?? '').toUpperCase() : `${projectDir ?? ''}/`;
    expect((await anchors({ projectDir: spelled, shot: 's01' })).status).toBe(200);
    projectDir = undefined;
    const closed = await anchors({ projectDir: base, shot: 's01' });
    expect(closed).toMatchObject({
      status: 403,
      body: { error: { message: expect.stringContaining('no project') as unknown } },
    });
  });

  it('validates requests strictly', async () => {
    const bad = await anchors({ projectDir, shot: 's01', extra: true });
    expect(bad).toMatchObject({ status: 400, body: { error: { kind: 'usage' } } });
    expect((await anchors({ projectDir })).status).toBe(400);
    expect(
      (await send('POST', '/frames', json(), JSON.stringify({ projectDir, shot: 's01', at: [] })))
        .status,
    ).toBe(400);
    expect((await send('POST', '/anchors', json(), '{not json')).status).toBe(400);
    expect(
      (await send('POST', '/anchors', auth(), JSON.stringify({ projectDir, shot: 's01' }))).status,
    ).toBe(415);
    expect((await send('GET', '/anchors', auth())).status).toBe(405);
    expect((await send('POST', '/nope', json(), '{}')).status).toBe(404);
    expect((await send('POST', '/__proto__', json(), '{}')).status).toBe(404);
    const huge = await send(
      'POST',
      '/anchors',
      json(),
      JSON.stringify({ projectDir, shot: 'x'.repeat(20_000) }),
    );
    expect(huge).toMatchObject({ status: 413, body: { error: { kind: 'too-large' } } });
    expect(calls).toEqual([]);
  });

  it('turns handler failures into typed errors', async () => {
    failWith = new ServiceError('project', 422, 'unknown shot "s09"', 'use s01');
    expect(await anchors({ projectDir, shot: 's09' })).toMatchObject({
      status: 422,
      body: { error: { kind: 'project', message: 'unknown shot "s09"', fix: 'use s01' } },
    });
    failWith = new Error('kaboom');
    expect(await anchors({ projectDir, shot: 's01' })).toMatchObject({
      status: 500,
      body: { error: { kind: 'internal' } },
    });
  });
});

describe('tokenMatches', () => {
  it('needs the exact bearer token', () => {
    expect(tokenMatches('Bearer abc', 'abc')).toBe(true);
    expect(tokenMatches('Bearer abcd', 'abc')).toBe(false);
    expect(tokenMatches('bearer abc', 'abc')).toBe(false);
    expect(tokenMatches(undefined, 'abc')).toBe(false);
    expect(tokenMatches('Bearer ', '')).toBe(false);
  });
});
