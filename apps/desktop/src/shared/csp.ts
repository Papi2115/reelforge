/**
 * Content-Security-Policy of the renderer document (injected as a <meta> tag at build/dev time).
 * The sandboxed engine frame carries its own, stricter policy (ADR-004).
 */
import { MEDIA_SCHEME } from './player-contract.js';
export interface CspOptions {
  /** Vite dev server origin (e.g. `http://127.0.0.1:5173`); undefined for production builds. */
  readonly devServerOrigin?: string | undefined;
}

export function rendererCsp(options: CspOptions = {}): string {
  const dev = options.devServerOrigin;
  const directives: Record<string, string[]> = {
    'default-src': ["'none'"],
    // Dev: the React refresh preamble is an inline module script.
    'script-src': dev === undefined ? ["'self'"] : ["'self'", "'unsafe-inline'"],
    // Dev: Vite injects CSS as <style> elements.
    'style-src': dev === undefined ? ["'self'"] : ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    // The player's <audio> master clock streams project audio from main (PLAN.md#6.4).
    'media-src': [`${MEDIA_SCHEME}:`],
    'connect-src': dev === undefined ? ["'self'"] : ["'self'", toWebSocketOrigin(dev)],
    // The engine frame (engine/engine-frame.html) is served from the app's own origin.
    'frame-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

function toWebSocketOrigin(httpOrigin: string): string {
  const url = new URL(httpOrigin);
  return `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
}
