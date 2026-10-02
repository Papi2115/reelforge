/** Browser-side frame transports used by the harness `stream()` call. */
import type { FrameSinkSpec, IpcFrameBridge } from './harness-types.ts';

declare global {
  interface Window {
    __spikeIpc?: IpcFrameBridge;
  }
}

export interface FrameSink {
  /** Sends one frame; resolves when the sink can take the next one (back-pressure). */
  send(frame: Uint8Array<ArrayBuffer>): Promise<void>;
  /** Resolves once every sent frame has been acknowledged. */
  close(): Promise<void>;
}

async function openWebSocketSink(url: string, window: number): Promise<FrameSink> {
  const socket = new WebSocket(url);
  socket.binaryType = 'arraybuffer';
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => {
      resolve();
    };
    socket.onerror = () => {
      reject(new Error(`WebSocket ${url} failed to open`));
    };
  });

  let sent = 0;
  let acked = 0;
  let failure: Error | undefined;
  let wake: (() => void) | undefined;
  socket.onmessage = (event: MessageEvent) => {
    if (event.data === 'ack') acked += 1;
    else failure = new Error(`Frame sink error: ${String(event.data)}`);
    wake?.();
  };
  socket.onclose = (event: CloseEvent) => {
    if (acked < sent)
      failure = new Error(`Frame sink closed early (${String(event.code)} ${event.reason})`);
    wake?.();
  };

  const waitForAcks = (target: number): Promise<void> =>
    new Promise((resolve, reject) => {
      const check = (): void => {
        if (failure) reject(failure);
        else if (acked >= target) resolve();
        else wake = check;
      };
      check();
    });

  return {
    async send(frame: Uint8Array<ArrayBuffer>): Promise<void> {
      socket.send(frame);
      sent += 1;
      await waitForAcks(sent - window);
    },
    async close(): Promise<void> {
      await waitForAcks(sent);
      socket.close();
    },
  };
}

function openIpcSink(): FrameSink {
  const bridge = window.__spikeIpc;
  if (!bridge) throw new Error('IPC sink requested but window.__spikeIpc is not exposed');
  return {
    send: (frame) => bridge.sendFrame(frame),
    close: () => Promise.resolve(),
  };
}

export function openFrameSink(spec: FrameSinkSpec): Promise<FrameSink> {
  return spec.kind === 'ws'
    ? openWebSocketSink(spec.url, spec.window)
    : Promise.resolve(openIpcSink());
}
