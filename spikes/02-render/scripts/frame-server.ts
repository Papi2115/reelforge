/**
 * Loopback server: serves the bundled harness over HTTP and receives raw RGBA frames over a
 * WebSocket on the same port. Each frame is acknowledged only after `onFrame` resolves, which
 * gives the page back-pressure from ffmpeg. (Per-frame HTTP POST was measured at ~22 fps on the
 * dev machine and dropped, see docs/spikes/02-render.md.)
 */
import { readFile } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { WebSocketServer, type RawData } from 'ws';
import type { FrameSinkSpec } from '../src/harness-types.ts';

export type FrameHandler = (index: number, frame: Buffer) => Promise<void>;

/** A Node-side frame receiver plus the matching page-side sink description. */
export interface FrameTransport {
  readonly sink: FrameSinkSpec;
  setFrameHandler(handler: FrameHandler | undefined): void;
}

export interface FrameServer extends FrameTransport {
  readonly pageUrl: string;
  close(): Promise<void>;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

/** Unacknowledged frames the page may have in flight on the WebSocket. */
const WS_WINDOW = 4;

async function serveStatic(
  staticDir: string,
  urlPath: string,
  response: ServerResponse,
): Promise<void> {
  const fileName = path.basename(urlPath);
  const contentType = CONTENT_TYPES[path.extname(fileName)];
  if (contentType === undefined) {
    response.writeHead(404).end();
    return;
  }
  const body = await readFile(path.join(staticDir, fileName));
  response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' }).end(body);
}

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

export async function startFrameServer(staticDir: string): Promise<FrameServer> {
  let frameHandler: FrameHandler | undefined;

  const server = createServer((request, response) => {
    serveStatic(staticDir, request.url ?? '/', response).catch((error: unknown) => {
      response.writeHead(500, { 'content-type': 'text/plain' }).end(String(error));
    });
  });
  const sockets = new WebSocketServer({ server });
  sockets.on('connection', (socket) => {
    let index = 0;
    let queue = Promise.resolve();
    socket.on('message', (data) => {
      const frameIndex = index;
      index += 1;
      queue = queue
        .then(async () => {
          if (frameHandler) await frameHandler(frameIndex, toBuffer(data));
          socket.send('ack');
        })
        .catch((error: unknown) => {
          socket.send(`error: ${String(error)}`);
          socket.close(1011, 'frame handler failed');
        });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    pageUrl: `http://127.0.0.1:${String(port)}/page.html`,
    sink: { kind: 'ws', url: `ws://127.0.0.1:${String(port)}/frames`, window: WS_WINDOW },
    setFrameHandler(handler) {
      frameHandler = handler;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const client of sockets.clients) client.terminate();
        sockets.close();
        server.closeAllConnections();
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
