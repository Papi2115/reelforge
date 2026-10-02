/**
 * `reelforge://app/` serves the built renderer from disk. A privileged standard + secure scheme
 * gives the renderer a real origin (CSP 'self', module scripts) without file:// or a localhost
 * server.
 */
import { readFile } from 'node:fs/promises';
import { protocol, type Session } from 'electron';
import { resolveAppAsset } from './app-asset.js';
import { describeError, type Logger } from './logger.js';
import { APP_SCHEME } from './navigation-policy.js';
import { MEDIA_SCHEME } from '../shared/player-contract.js';

/**
 * Must run before `app.whenReady()`. Also registers the project-media scheme (media-protocol.ts):
 * `stream` lets `<audio>` play and seek through range requests.
 */
export function registerAppSchemePrivileged(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
    },
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, stream: true },
    },
  ]);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function serveAppProtocol(session: Session, rendererDir: string, log: Logger): void {
  session.protocol.handle(APP_SCHEME, async (request) => {
    const asset = resolveAppAsset(rendererDir, request.url);
    if (!asset.ok) {
      log.warn(asset.error);
      return new Response('Bad request', { status: 400 });
    }
    try {
      const body = await readFile(asset.value.file);
      return new Response(body, {
        headers: {
          'content-type': asset.value.contentType,
          'x-content-type-options': 'nosniff',
          'cache-control': 'no-cache',
        },
      });
    } catch (error) {
      if (isMissingFile(error)) return new Response('Not found', { status: 404 });
      log.error(`cannot serve ${request.url}: ${describeError(error)}`);
      return new Response('Internal error', { status: 500 });
    }
  });
}
