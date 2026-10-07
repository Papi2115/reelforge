/**
 * Maps `reelforge://app/<path>` requests to files of the built renderer. Pure (no Electron) so
 * the traversal guard is unit-tested; Windows paths with spaces and non-ASCII letters work.
 */
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { APP_HOST, APP_SCHEME } from './navigation-policy.js';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export interface AppAsset {
  readonly file: string;
  readonly contentType: string;
}

export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

export function resolveAppAsset(rootDir: string, requestUrl: string): Result<AppAsset, string> {
  if (!URL.canParse(requestUrl)) return err(`not a URL: ${requestUrl}`);
  const url = new URL(requestUrl);
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) {
    return err(`not an app URL: ${requestUrl}`);
  }
  let relative: string;
  try {
    relative = decodeURIComponent(url.pathname);
  } catch (error) {
    return err(`malformed path in ${requestUrl}: ${String(error)}`);
  }
  // Backslashes are separators on Windows only; refuse them everywhere for one behaviour.
  if (/[\0\\]/.test(relative)) return err(`NUL or backslash in path: ${requestUrl}`);
  if (relative === '/' || relative === '') relative = '/index.html';
  const root = path.resolve(rootDir);
  const file = path.resolve(root, `.${relative}`);
  const inside = path.relative(root, file);
  if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
    return err(`path escapes the app root: ${requestUrl}`);
  }
  return ok({ file, contentType: contentTypeFor(file) });
}
