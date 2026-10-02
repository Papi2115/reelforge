/**
 * Where the renderer comes from and which URLs it may navigate to / request. Pure functions so
 * the policy is unit-tested without Electron.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { MEDIA_SCHEME } from '../shared/player-contract.js';

export const APP_SCHEME = 'reelforge';
export const APP_HOST = 'app';
/** Origin of the production renderer, served by the `reelforge:` protocol handler. */
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_ENTRY_URL = `${APP_ORIGIN}/index.html`;

/** Set by `pnpm dev` (scripts/dev.ts); ignored in packaged builds. */
export const DEV_SERVER_ENV = 'REELFORGE_DEV_SERVER_URL';

export interface RendererSource {
  readonly url: string;
  /** `scheme://host[:port]` the renderer may navigate within and request from. */
  readonly origin: string;
  readonly dev: boolean;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Compares `scheme://host:port`. Node's URL reports the origin of non-special schemes (like
 * `reelforge:`) as "null", so the origin is rebuilt from protocol and host.
 */
export function originOf(url: string): string | undefined {
  if (!URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  if (parsed.host === '') return undefined;
  return `${parsed.protocol}//${parsed.host}`;
}

export function resolveRendererSource(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): Result<RendererSource, string> {
  const devUrl = env[DEV_SERVER_ENV];
  if (isPackaged || devUrl === undefined || devUrl === '') {
    return ok({ url: APP_ENTRY_URL, origin: APP_ORIGIN, dev: false });
  }
  if (!URL.canParse(devUrl)) return err(`${DEV_SERVER_ENV} is not a URL: ${devUrl}`);
  const parsed = new URL(devUrl);
  if (parsed.protocol !== 'http:' || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    return err(`${DEV_SERVER_ENV} must be an http:// loopback URL, got ${devUrl}`);
  }
  return ok({ url: parsed.href, origin: parsed.origin, dev: true });
}

/** Frames (main window and the engine iframe) may only navigate within the renderer origin. */
export function isAllowedNavigation(url: string, source: RendererSource): boolean {
  return originOf(url) === source.origin;
}

/** Schemes that never reach the network (project media is served from disk by main). */
const LOCAL_SCHEMES = new Set(['blob:', 'data:', 'devtools:', `${MEDIA_SCHEME}:`]);

/**
 * Every request of the app session must stay local: the renderer origin, its dev-server
 * websocket (HMR) and in-memory URLs. Remote content is never loaded.
 */
export function isAllowedRequest(url: string, source: RendererSource): boolean {
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  if (LOCAL_SCHEMES.has(parsed.protocol)) return true;
  const origin = originOf(url);
  if (origin === source.origin) return true;
  return source.dev && origin === source.origin.replace(/^http:/, 'ws:');
}
