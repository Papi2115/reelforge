import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  downloadToFile,
  FetchFailed,
  FetchRefused,
  getJson,
  transportRefusal,
  type Resolver,
  type TransportOptions,
  type UrlPolicy,
} from './http.js';
import { startAssetServer, tinyPng, type AssetTestServer } from './testing/server.js';

const anyHost: UrlPolicy = () => undefined;
const TEST: TransportOptions = { allowLoopbackHttpForTests: true, idleTimeoutMs: 1000 };

let server: AssetTestServer;
let dir: string;

beforeEach(async () => {
  server = await startAssetServer();
  dir = await mkdtemp(path.join(tmpdir(), 'reelforge http '));
});

afterEach(async () => {
  await server.close();
  await rm(dir, { recursive: true, force: true });
});

describe('transportRefusal', () => {
  it('https only, default port, no credentials, no literal private IPs', () => {
    const refusal = (url: string, options: TransportOptions = {}): string | undefined =>
      transportRefusal(new URL(url), options);
    expect(refusal('https://upload.wikimedia.org/x.png')).toBeUndefined();
    expect(refusal('http://upload.wikimedia.org/x.png')).toMatch(/only https/);
    expect(refusal('ftp://example.org/x.png')).toMatch(/only https/);
    expect(refusal('https://u:p@example.org/x.png')).toMatch(/credentials/);
    expect(refusal('https://example.org:8443/x.png')).toMatch(/non-standard port/);
    expect(refusal('https://127.0.0.1/x.png')).toMatch(/loopback.*SSRF/);
    expect(refusal('https://10.0.0.1/x.png')).toMatch(/private.*SSRF/);
    expect(refusal('https://[::1]/x.png')).toMatch(/SSRF/);
    expect(refusal('https://169.254.169.254/latest/meta-data')).toMatch(/metadata.*SSRF/);
    // The test option opens only the literal loopback, nothing else.
    expect(refusal('http://127.0.0.1:1234/x.png', TEST)).toBeUndefined();
    expect(refusal('http://10.0.0.1:1234/x.png', TEST)).toMatch(/only https/);
    expect(refusal('http://localhost:1234/x.png', TEST)).toMatch(/only https/);
  });
});

describe('SSRF after DNS resolution', () => {
  it('refuses a public-looking name that resolves to a private address, before connecting', async () => {
    const resolved: string[] = [];
    const resolver: Resolver = (host) => {
      resolved.push(host);
      return Promise.resolve([{ address: '10.1.2.3', family: 4 }]);
    };
    const target = path.join(dir, 'x.png');
    await expect(
      downloadToFile('https://assets.example.org/x.png', anyHost, { resolver }, target, 1000, 5000),
    ).rejects.toThrow(/resolves to 10\.1\.2\.3: private address.*SSRF/);
    expect(resolved).toEqual(['assets.example.org']);
    expect(existsSync(target)).toBe(false);
  });

  it('refuses names resolving to loopback even when only one address is bad', async () => {
    const resolver: Resolver = () =>
      Promise.resolve([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
    await expect(
      getJson('https://rebind.example.org/api', anyHost, { resolver }),
    ).rejects.toBeInstanceOf(FetchRefused);
  });
});

describe('getJson / downloadToFile against the local server', () => {
  it('reads JSON and checks the caller policy on every hop', async () => {
    server.route('/a', (_request, response) => {
      response.writeHead(302, { location: '/b' });
      response.end();
    });
    server.route('/b', (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
    });
    const hops: string[] = [];
    const policy: UrlPolicy = (url, hop) => {
      hops.push(`${String(hop)}:${url.pathname}`);
      return undefined;
    };
    expect(await getJson(`${server.base}/a`, policy, TEST)).toEqual({ ok: true });
    expect(hops).toEqual(['0:/a', '1:/b']);
    const refuseSecond: UrlPolicy = (_url, hop) => (hop > 0 ? 'nope' : undefined);
    await expect(getJson(`${server.base}/a`, refuseSecond, TEST)).rejects.toThrow(
      'redirect refused: nope',
    );
  });

  it('stops after the redirect limit', async () => {
    server.route('/loop', (_request, response) => {
      response.writeHead(302, { location: '/loop' });
      response.end();
    });
    await expect(getJson(`${server.base}/loop`, anyHost, TEST)).rejects.toThrow(
      /more than 5 redirects/,
    );
    expect(server.requests).toHaveLength(6);
  });

  it('rejects HTTP errors, compressed bodies, non-JSON and oversized JSON', async () => {
    await expect(getJson(`${server.base}/missing`, anyHost, TEST)).rejects.toThrow(/HTTP 404/);
    server.route('/gz', (_request, response) => {
      response.writeHead(200, { 'content-encoding': 'gzip' });
      response.end('xx');
    });
    await expect(getJson(`${server.base}/gz`, anyHost, TEST)).rejects.toThrow(/only identity/);
    server.route('/html', (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('<html>');
    });
    await expect(getJson(`${server.base}/html`, anyHost, TEST)).rejects.toThrow(
      /did not answer with JSON/,
    );
    server.route('/big', (_request, response) => {
      response.writeHead(200);
      response.end(`[${'1,'.repeat(600)}1]`);
    });
    await expect(getJson(`${server.base}/big`, anyHost, TEST, 1000)).rejects.toBeInstanceOf(
      FetchFailed,
    );
  });

  it('refuses a declared Content-Length over the cap before reading the body', async () => {
    server.route('/declared', (_request, response) => {
      response.writeHead(200, { 'content-length': String(50_000) });
      response.write(Buffer.alloc(10));
    });
    const target = path.join(dir, 'declared.png');
    await expect(
      downloadToFile(`${server.base}/declared`, anyHost, TEST, target, 10_000, 5000),
    ).rejects.toThrow(/larger than the 10000-byte cap/);
  });

  it('times out a silent server', async () => {
    server.route('/silent', () => undefined);
    await expect(
      getJson(`${server.base}/silent`, anyHost, { ...TEST, idleTimeoutMs: 200 }),
    ).rejects.toThrow(/no response/);
  });

  it('streams a file and hashes it', async () => {
    const png = tinyPng(4, 4);
    server.route('/x.png', (_request, response) => {
      response.writeHead(200);
      response.end(png);
    });
    const target = path.join(dir, 'x.png');
    const result = await downloadToFile(
      `${server.base}/x.png`,
      anyHost,
      TEST,
      target,
      10_000,
      5000,
    );
    expect(result.bytes).toBe(png.length);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.finalUrl).toBe(`${server.base}/x.png`);
  });
});
