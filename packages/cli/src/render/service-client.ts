/**
 * HTTP client of the app's render service (see service/protocol.ts). Failures become the CLI's
 * typed errors: a bad request is a UsageError (exit 2), everything else a RenderServiceError
 * (a ProjectError, exit 1) whose `fix` tells the runtime Claude what to do.
 */
import type { z } from 'zod';
import { describeUnknown, ProjectError, UsageError } from '../errors.js';
import {
  healthResponseSchema,
  loadResponseSchema,
  RENDER_SERVICE_PATHS,
  RENDER_TOKEN_ENV,
  RENDER_URL_ENV,
  serviceErrorBodySchema,
  shotRenderResponseSchema,
  type HealthResponse,
  type LoadResponse,
  type ServiceErrorKind,
  type ShotFramesRequest,
  type ShotRenderResponse,
  type ShotTargetRequest,
} from '../service/protocol.js';

export interface RenderServiceConfig {
  /** `http://127.0.0.1:<port>` */
  readonly url: string;
  readonly token: string;
}

export type RenderServiceErrorKind = ServiceErrorKind | 'unreachable' | 'timeout' | 'protocol';

const TELL_USER =
  'tell the user that the ReelForge app could not render; they may need to reopen the project';

export class RenderServiceError extends ProjectError {
  constructor(
    readonly kind: RenderServiceErrorKind,
    message: string,
    fix: string = TELL_USER,
  ) {
    super(message, fix);
    this.name = 'RenderServiceError';
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

/** The service the app announced to this process, or undefined (render locally). */
export function renderServiceFromEnv(env: NodeJS.ProcessEnv): RenderServiceConfig | undefined {
  const url = env[RENDER_URL_ENV];
  if (url === undefined || url === '') return undefined;
  const token = env[RENDER_TOKEN_ENV];
  if (token === undefined || token === '') {
    throw new RenderServiceError(
      'unauthorized',
      `${RENDER_URL_ENV} is set but ${RENDER_TOKEN_ENV} is missing`,
    );
  }
  const parsed = URL.canParse(url) ? new URL(url) : undefined;
  if (parsed?.protocol !== 'http:' || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new RenderServiceError(
      'protocol',
      `${RENDER_URL_ENV} must be an http:// loopback URL, got "${url}"`,
    );
  }
  return { url: parsed.origin, token };
}

export interface RenderServiceClientOptions {
  /** Per-request limit for health checks (ms, default 5 s). */
  readonly healthTimeoutMs?: number;
  /** Per-request limit for renders (ms, default 3 min: a cold start builds the renderer). */
  readonly renderTimeoutMs?: number;
}

export class RenderServiceClient {
  private readonly healthTimeoutMs: number;
  private readonly renderTimeoutMs: number;

  constructor(
    private readonly config: RenderServiceConfig,
    options: RenderServiceClientOptions = {},
  ) {
    this.healthTimeoutMs = options.healthTimeoutMs ?? 5_000;
    this.renderTimeoutMs = options.renderTimeoutMs ?? 180_000;
  }

  health(): Promise<HealthResponse> {
    return this.call(
      RENDER_SERVICE_PATHS.health,
      undefined,
      healthResponseSchema,
      this.healthTimeoutMs,
    );
  }

  load(projectDir: string): Promise<LoadResponse> {
    return this.call(
      RENDER_SERVICE_PATHS.load,
      { projectDir },
      loadResponseSchema,
      this.renderTimeoutMs,
    );
  }

  frames(request: ShotFramesRequest): Promise<ShotRenderResponse> {
    return this.render(RENDER_SERVICE_PATHS.frames, request);
  }

  cards(request: ShotTargetRequest): Promise<ShotRenderResponse> {
    return this.render(RENDER_SERVICE_PATHS.cards, request);
  }

  anchors(request: ShotTargetRequest): Promise<ShotRenderResponse> {
    return this.render(RENDER_SERVICE_PATHS.anchors, request);
  }

  private render(
    route: string,
    request: ShotFramesRequest | ShotTargetRequest,
  ): Promise<ShotRenderResponse> {
    return this.call(route, request, shotRenderResponseSchema, this.renderTimeoutMs);
  }

  private async call<Schema extends z.ZodType>(
    route: string,
    body: object | undefined,
    schema: Schema,
    timeoutMs: number,
  ): Promise<z.infer<Schema>> {
    let response: Response;
    try {
      response = await fetch(`${this.config.url}${route}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          authorization: `Bearer ${this.config.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new RenderServiceError(
          'timeout',
          `the app's render service did not answer ${route} within ${String(Math.round(timeoutMs / 1000))} s`,
        );
      }
      throw new RenderServiceError(
        'unreachable',
        `the app's render service at ${this.config.url} is not reachable (${describeUnknown(error)})`,
        'tell the user that the ReelForge app is not running or closed the project, then stop rendering',
      );
    }
    const json = await response.json().catch((): unknown => undefined);
    if (!response.ok) throw failure(route, response.status, json);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new RenderServiceError(
        'protocol',
        `the app's render service sent an unexpected reply to ${route}: ${parsed.error.message.slice(0, 300)}`,
      );
    }
    return parsed.data;
  }
}

function failure(route: string, status: number, json: unknown): Error {
  const body = serviceErrorBodySchema.safeParse(json);
  if (!body.success) {
    return new RenderServiceError(
      'protocol',
      `the app's render service answered ${route} with HTTP ${String(status)}`,
    );
  }
  const { kind, message, fix } = body.data.error;
  if (kind === 'usage') return new UsageError(message);
  return new RenderServiceError(kind, message, fix ?? TELL_USER);
}
