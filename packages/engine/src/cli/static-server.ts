/** Minimal loopback static file server for the harness pages (flat directory, no listing). */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

export interface StaticServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

export async function startStaticServer(directory: string): Promise<StaticServer> {
  const server = createServer((request, response) => {
    const fileName = path.basename(new URL(request.url ?? '/', 'http://localhost').pathname);
    const contentType = CONTENT_TYPES[path.extname(fileName)];
    if (contentType === undefined) {
      response.writeHead(404).end();
      return;
    }
    readFile(path.join(directory, fileName)).then(
      (body) =>
        response
          .writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' })
          .end(body),
      (error: unknown) =>
        response.writeHead(404, { 'content-type': 'text/plain' }).end(String(error)),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}/`,
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
