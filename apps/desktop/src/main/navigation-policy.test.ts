import { describe, expect, it } from 'vitest';
import {
  APP_ENTRY_URL,
  APP_ORIGIN,
  DEV_SERVER_ENV,
  isAllowedNavigation,
  isAllowedRequest,
  originOf,
  resolveRendererSource,
  type RendererSource,
} from './navigation-policy.js';

const prod: RendererSource = { url: APP_ENTRY_URL, origin: APP_ORIGIN, dev: false };
const dev: RendererSource = {
  url: 'http://127.0.0.1:5173/',
  origin: 'http://127.0.0.1:5173',
  dev: true,
};

describe('resolveRendererSource', () => {
  it('serves the app protocol by default and always when packaged', () => {
    expect(resolveRendererSource({}, false)).toEqual({ ok: true, value: prod });
    const env = { [DEV_SERVER_ENV]: 'http://127.0.0.1:5173/' };
    expect(resolveRendererSource(env, true)).toEqual({ ok: true, value: prod });
  });

  it('uses a loopback dev server in development', () => {
    const env = { [DEV_SERVER_ENV]: 'http://127.0.0.1:5173/' };
    expect(resolveRendererSource(env, false)).toEqual({ ok: true, value: dev });
  });

  it('refuses remote or non-http dev URLs', () => {
    for (const url of [
      'https://example.com/',
      'http://192.168.0.2:5173/',
      'file:///C:/x',
      'nope',
    ]) {
      expect(resolveRendererSource({ [DEV_SERVER_ENV]: url }, false).ok).toBe(false);
    }
  });
});

describe('originOf', () => {
  it('handles the custom scheme that Node reports as an opaque origin', () => {
    expect(originOf('reelforge://app/engine/engine-frame.html')).toBe(APP_ORIGIN);
    expect(originOf('http://127.0.0.1:5173/@vite/client')).toBe('http://127.0.0.1:5173');
    expect(originOf('about:blank')).toBeUndefined();
    expect(originOf('not a url')).toBeUndefined();
  });
});

describe('isAllowedNavigation', () => {
  it('allows only the renderer origin', () => {
    expect(isAllowedNavigation('reelforge://app/index.html', prod)).toBe(true);
    expect(isAllowedNavigation('reelforge://evil/index.html', prod)).toBe(false);
    expect(isAllowedNavigation('https://example.com/', prod)).toBe(false);
    expect(isAllowedNavigation('file:///C:/Windows/win.ini', prod)).toBe(false);
    expect(isAllowedNavigation('http://127.0.0.1:5173/engine/engine-frame.html', dev)).toBe(true);
    expect(isAllowedNavigation('http://127.0.0.1:5174/', dev)).toBe(false);
  });
});

describe('isAllowedRequest', () => {
  it('blocks every remote request', () => {
    expect(isAllowedRequest('https://cdn.example.com/three.js', prod)).toBe(false);
    expect(isAllowedRequest('http://127.0.0.1:5173/', prod)).toBe(false);
    expect(isAllowedRequest('file:///C:/Users/x/secret.txt', prod)).toBe(false);
  });

  it('allows the app origin and in-memory URLs', () => {
    expect(isAllowedRequest('reelforge://app/assets/index.js', prod)).toBe(true);
    expect(isAllowedRequest('blob:null/1b2c', prod)).toBe(true);
    expect(isAllowedRequest('data:image/png;base64,AAAA', prod)).toBe(true);
  });

  it('allows project media (served from disk by main) in prod and dev', () => {
    expect(isAllowedRequest('reelforge-media://project/audio/mix.wav?v=1', prod)).toBe(true);
    expect(isAllowedRequest('reelforge-media://project/audio/mix.wav?v=1', dev)).toBe(true);
  });

  it('allows the dev server websocket only in dev', () => {
    expect(isAllowedRequest('ws://127.0.0.1:5173/?token=x', dev)).toBe(true);
    expect(isAllowedRequest('ws://127.0.0.1:5173/?token=x', prod)).toBe(false);
  });
});
