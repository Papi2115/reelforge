/**
 * The app's local render service for the `reelforge` CLI (protocol: @reelforge/cli/service).
 * Hardening: binds 127.0.0.1 only on a random port; random per-launch bearer token compared in
 * constant time; Host header must be the loopback address (DNS rebinding); requests with an
 * Origin header (browsers) are refused and no CORS headers are ever sent; JSON bodies only, at
 * most MAX_REQUEST_BYTES; zod-validated; `projectDir` must be the project open in the app.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import {
  loadRequestSchema,
  MAX_REQUEST_BYTES,
  RENDER_SERVICE_PATHS,
  RENDER_SERVICE_VERSION,
  RENDER_TOKEN_ENV,
  RENDER_URL_ENV,
  shotFramesRequestSchema,
  shotTargetRequestSchema,
  type HealthResponse,
  type ServiceErrorKind,
} from '@reelforge/cli/service';
import type { ExtraEnv } from '@reelforge/claude-bridge';
import type { z } from 'zod';
import { describeError, type Logger } from '../logger.js';
import type { RenderServiceHandlers } from './render-service-handlers.js';

export class ServiceError extends Error {
  constructor(
    readonly kind: ServiceErrorKind,
    readonly status: number,
    message: string,
    readonly fix?: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface RenderServiceOptions {
  readonly handlers: RenderServiceHandlers;
  /** The project open in the app (the only one the service renders). */
  readonly projectDir: () => string | undefined;
  readonly log: Logger;
}

export interface RenderService {
  readonly url: string;
  /** The env vars for child processes (claude -> reelforge CLI). */
  env(): ExtraEnv;
  close(): Promise<void>;
}

function digest(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

/** Constant-time token check (hashes first, so lengths never leak). */
export function tokenMatches(header: string | undefined, token: string): boolean {
  const match = /^Bearer (\S+)$/.exec(header ?? '');
  return timingSafeEqual(digest(match?.[1] ?? ''), digest(token)) && match !== null;
}

async function canonical(dir: string): Promise<string> {
  const real = await realpath(dir).catch(() => path.resolve(dir));
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

/** Refuses any folder but the open project (after resolving links and case on Windows). */
async function assertOpenProject(requested: string, open: string | undefined): Promise<void> {
  if (open === undefined) {
    throw new ServiceError(
      'forbidden',
      403,
      'no project is open in the ReelForge app',
      'tell the user to open the project in the app',
    );
  }
  if (!path.isAbsolute(requested) || (await canonical(requested)) !== (await canonical(open))) {
    throw new ServiceError(
      'forbidden',
      403,
      `the app renders only the open project (${open}), not ${requested}`,
      'run reelforge inside the project folder that is open in the app',
    );
  }
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers['content-length'] ?? '0');
  if (declared > MAX_REQUEST_BYTES)
    throw new ServiceError('too-large', 413, 'request body too large');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES)
      throw new ServiceError('too-large', 413, 'request body too large');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new ServiceError('usage', 400, 'the request body is not valid JSON');
  }
}

function parse<Schema extends z.ZodType>(schema: Schema, body: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '<body>'}: ${issue.message}`)
    .join('; ');
  throw new ServiceError('usage', 400, `invalid request: ${issues}`);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(text);
}

export async function startRenderService(options: RenderServiceOptions): Promise<RenderService> {
  const token = randomBytes(32).toString('hex');
  let host = '';
  const { handlers, log } = options;

  async function route(request: IncomingMessage): Promise<unknown> {
    if (request.headers.origin !== undefined) {
      throw new ServiceError('forbidden', 403, 'browser requests are not accepted');
    }
    if (request.headers.host !== host)
      throw new ServiceError('forbidden', 403, 'unexpected Host header');
    if (!tokenMatches(request.headers.authorization, token)) {
      throw new ServiceError('unauthorized', 401, 'missing or wrong render service token');
    }
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname === RENDER_SERVICE_PATHS.health && request.method === 'GET') {
      const health: HealthResponse = {
        ok: true,
        service: 'reelforge-render',
        version: RENDER_SERVICE_VERSION,
        projectDir: options.projectDir() ?? null,
      };
      return health;
    }
    const routes: Readonly<Record<string, (body: unknown) => Promise<unknown>>> = {
      [RENDER_SERVICE_PATHS.load]: async (body) => {
        const input = parse(loadRequestSchema, body);
        await assertOpenProject(input.projectDir, options.projectDir());
        return handlers.load(input);
      },
      [RENDER_SERVICE_PATHS.frames]: async (body) => {
        const input = parse(shotFramesRequestSchema, body);
        await assertOpenProject(input.projectDir, options.projectDir());
        return handlers.frames(input);
      },
      [RENDER_SERVICE_PATHS.cards]: async (body) => {
        const input = parse(shotTargetRequestSchema, body);
        await assertOpenProject(input.projectDir, options.projectDir());
        return handlers.cards(input);
      },
      [RENDER_SERVICE_PATHS.anchors]: async (body) => {
        const input = parse(shotTargetRequestSchema, body);
        await assertOpenProject(input.projectDir, options.projectDir());
        return handlers.anchors(input);
      },
    };
    const handler = Object.hasOwn(routes, pathname) ? routes[pathname] : undefined;
    if (handler === undefined) throw new ServiceError('not-found', 404, `no endpoint ${pathname}`);
    if (request.method !== 'POST') throw new ServiceError('usage', 405, `${pathname} needs POST`);
    if (!/^application\/json\b/i.test(request.headers['content-type'] ?? '')) {
      throw new ServiceError('usage', 415, 'send a JSON body (content-type: application/json)');
    }
    return handler(await readBody(request));
  }

  const server: Server = createServer((request, response) => {
    route(request).then(
      (body) => {
        send(response, 200, body);
      },
      (error: unknown) => {
        const failure =
          error instanceof ServiceError
            ? error
            : new ServiceError('internal', 500, `render service error: ${describeError(error)}`);
        if (failure.kind === 'internal') log.error(failure.message);
        else if (failure.status !== 400)
          log.warn(`${request.method ?? '?'} ${request.url ?? '?'}: ${failure.message}`);
        // The request may not have been read to the end (refused early): close the connection.
        response.setHeader('connection', 'close');
        send(response, failure.status, {
          error: {
            kind: failure.kind,
            message: failure.message,
            ...(failure.fix === undefined ? {} : { fix: failure.fix }),
          },
        });
      },
    );
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const { port } = server.address() as AddressInfo;
  host = `127.0.0.1:${String(port)}`;
  const url = `http://${host}`;
  log.info(`render service listening on ${url}`);
  return {
    url,
    env: () => ({ [RENDER_URL_ENV]: url, [RENDER_TOKEN_ENV]: token }),
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          log.info('render service stopped');
          resolve();
        });
      }),
  };
}
