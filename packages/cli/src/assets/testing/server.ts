/**
 * Test support (not exported): a local http server on 127.0.0.1 that plays every source from the
 * recorded fixtures (their file URLs rewritten to `/files/<host>/...` on this server), serves
 * small media files, and counts every request it receives. Tests never touch the internet.
 */
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { createSourceRegistry, type AllowlistSourceId } from '../sources/index.js';
import type { SourceEndpoints } from '../sources/types.js';
import type { AssetRuntime } from '../runtime.js';

export const ASSET_FIXTURES = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'test',
  'fixtures',
  'assets',
);

export type Handler = (request: IncomingMessage, response: ServerResponse, url: URL) => void;

export interface AssetTestServer {
  readonly base: string;
  /** Every request path received, in order. */
  readonly requests: string[];
  /** Replaces the handler of one exact path (without query). */
  route(pathname: string, handler: Handler): void;
  /** A runtime whose sources all live on this server (hosts: 127.0.0.1). */
  runtime(): AssetRuntime;
  close(): Promise<void>;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A valid RGB PNG of the given size (one colour). */
export function tinyPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x40)]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** The first bytes of an MP4 (ftyp isom) padded to `size`. */
export function tinyMp4(size = 2048): Buffer {
  const file = Buffer.alloc(size);
  file.writeUInt32BE(24, 0);
  file.write('ftypisom', 4, 'ascii');
  file.write('isomavc1mp41', 12, 'ascii');
  return file;
}

const FILE_HOSTS =
  /https?:\/\/(upload\.wikimedia\.org|thumb\.wikimedia\.org|images-assets\.nasa\.gov|live\.staticflickr\.com|api\.openverse\.org\/v1\/images\/[0-9a-f-]+\/thumb|tile\.loc\.gov)/g;

function fixture(name: string, base: string): string {
  const text = readFileSync(path.join(ASSET_FIXTURES, name), 'utf8');
  return text.replace(
    FILE_HOSTS,
    (_whole, host: string) => `${base}/files/${host.replaceAll('/', '_')}`,
  );
}

function sendJson(response: ServerResponse, body: string): void {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(body);
}

function defaultHandler(base: string): Handler {
  return (_request, response, url) => {
    const p = url.pathname;
    const json = (name: string): void => {
      sendJson(response, fixture(name, base));
    };
    if (p === '/wikimedia/w/api.php') {
      json(url.searchParams.has('pageids') ? 'wikimedia-lookup.json' : 'wikimedia-search.json');
    } else if (p === '/openverse/v1/images/') json('openverse-search.json');
    else if (p.startsWith('/openverse/v1/images/')) json('openverse-lookup.json');
    else if (p === '/nasa/search')
      json(url.searchParams.has('nasa_id') ? 'nasa-lookup.json' : 'nasa-search.json');
    else if (p.startsWith('/nasa/asset/')) json('nasa-asset.json');
    else if (p === '/ia/advancedsearch.php') json('internet-archive-search.json');
    else if (p === '/ia/metadata/Magpie3Explanation') json('internet-archive-metadata.json');
    else if (p.startsWith('/ia/services/img/')) {
      response.writeHead(200, { 'content-type': 'image/jpeg' });
      response.end(tinyPng(8, 6));
    } else if (p.startsWith('/ia/download/')) {
      response.writeHead(200, { 'content-type': 'video/mp4' });
      response.end(tinyMp4());
    } else if (p === '/loc/photos/') json('loc-search.json');
    else if (p === '/loc/item/2017762891/') json('loc-item.json');
    else if (p.startsWith('/files/')) {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(tinyPng(64, 48));
    } else {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
    }
  };
}

export async function startAssetServer(): Promise<AssetTestServer> {
  const requests: string[] = [];
  const routes = new Map<string, Handler>();
  let fallback: Handler = () => undefined;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    requests.push(`${url.pathname}${url.search}`);
    (routes.get(url.pathname) ?? fallback)(request, response, url);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${String(port)}`;
  fallback = defaultHandler(base);
  const endpoint = (prefix: string, files?: string): SourceEndpoints => ({
    api: `${base}${prefix}`,
    files,
    hosts: ['127.0.0.1'],
  });
  const endpoints: Record<AllowlistSourceId, SourceEndpoints> = {
    wikimedia: endpoint('/wikimedia/w/api.php'),
    openverse: endpoint('/openverse'),
    'internet-archive': endpoint('/ia', `${base}/ia`),
    nasa: endpoint('/nasa'),
    loc: endpoint('/loc'),
  };
  return {
    base,
    requests,
    route: (pathname, handler) => routes.set(pathname, handler),
    runtime: () => ({
      sources: createSourceRegistry({ endpoints }),
      transport: { allowLoopbackHttpForTests: true, idleTimeoutMs: 2000 },
      now: () => new Date('2026-10-04T12:00:00.000Z'),
    }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
