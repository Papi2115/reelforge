import { describe, expect, it } from 'vitest';
import { rendererCsp } from './csp.js';

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((directive) => {
      const [name = '', ...sources] = directive.split(' ');
      return [name, sources];
    }),
  );
}

describe('rendererCsp', () => {
  it('locks production down to the app origin without inline code or eval', () => {
    const policy = directives(rendererCsp());
    expect(policy.get('default-src')).toEqual(["'none'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
    expect(policy.get('style-src')).toEqual(["'self'"]);
    expect(policy.get('connect-src')).toEqual(["'self'"]);
    expect(policy.get('frame-src')).toEqual(["'self'"]);
    expect(policy.get('media-src')).toEqual(['reelforge-media:']);
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'blob:', 'reelforge-media:']);
    expect(rendererCsp()).not.toContain('unsafe-eval');
    expect(rendererCsp()).not.toContain('http');
  });

  it('allows the Vite dev server websocket and inline preamble in dev only', () => {
    const policy = directives(rendererCsp({ devServerOrigin: 'http://127.0.0.1:5173' }));
    expect(policy.get('connect-src')).toEqual(["'self'", 'ws://127.0.0.1:5173']);
    expect(policy.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(rendererCsp({ devServerOrigin: 'http://127.0.0.1:5173' })).not.toContain('unsafe-eval');
  });
});
