/**
 * Electron variant of the benchmark (bundled to out/electron-main.cjs by build.ts).
 * Runs the same harness in (a) a hidden BrowserWindow and (b) an offscreen (OSR) window, with
 * frames sent to the main process over IPC, then exports the 10 s clip via libx264 and
 * h264_nvenc from the hidden window for an end-to-end comparison.
 * Usage: pnpm --filter @reelforge/spike-render bench:electron
 */
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { IPC_FRAME_CHANNEL } from '../src/harness-types.ts';
import { runBench, SPIKE_INIT, summarize, type PageDriver } from './bench-core.ts';
import { exportVideo } from './export-core.ts';
import { startFrameServer, type FrameHandler, type FrameTransport } from './frame-server.ts';

// The bundle lives in out/, which is also the static dir of the harness.
const outDir = __dirname;

function createIpcTransport(): FrameTransport {
  let handler: FrameHandler | undefined;
  let index = 0;
  ipcMain.handle(IPC_FRAME_CHANNEL, async (_event, frame: Uint8Array) => {
    const frameIndex = index;
    index += 1;
    if (handler)
      await handler(frameIndex, Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength));
  });
  return {
    sink: { kind: 'ipc' },
    setFrameHandler(next) {
      handler = next;
      index = 0;
    },
  };
}

function createDriver(offscreen: boolean): { driver: PageDriver; window: BrowserWindow } {
  const window = new BrowserWindow({
    show: false,
    width: 640,
    height: 360,
    webPreferences: {
      offscreen,
      backgroundThrottling: false,
      sandbox: true,
      contextIsolation: true,
      preload: path.join(outDir, 'electron-preload.cjs'),
    },
  });
  const driver: PageDriver = {
    load: (url) => window.loadURL(url),
    evaluate: (expression) =>
      window.webContents.executeJavaScript(expression, true) as Promise<unknown>,
  };
  return { driver, window };
}

async function main(): Promise<void> {
  const server = await startFrameServer(outDir);
  const ipc = createIpcTransport();
  try {
    for (const offscreen of [false, true]) {
      const label = offscreen ? 'electron-offscreen' : 'electron-hidden';
      const { driver, window } = createDriver(offscreen);
      const report = await runBench(label, driver, server.pageUrl, ipc);
      await writeFile(
        path.join(outDir, `bench-${label}.json`),
        JSON.stringify(
          { ...report, electron: process.versions.electron, chrome: process.versions.chrome },
          null,
          2,
        ),
      );
      console.log(summarize(report));
      if (!offscreen) {
        await driver.load(server.pageUrl);
        await driver.evaluate(`window.__spike.init(${JSON.stringify(SPIKE_INIT)})`);
        const timings = [
          await exportVideo(driver, ipc, 'libx264', path.join(outDir, 'spike-electron.mp4')),
          await exportVideo(
            driver,
            ipc,
            'h264_nvenc',
            path.join(outDir, 'spike-electron-nvenc.mp4'),
          ),
        ];
        await writeFile(
          path.join(outDir, 'export-electron.json'),
          JSON.stringify(timings, null, 2),
        );
        for (const timing of timings) {
          console.log(
            `  export ${timing.encoder} end-to-end (IPC): ${timing.effectiveFps.toFixed(1)} fps (${timing.wallMs.toFixed(0)} ms)`,
          );
        }
      }
      // destroy() followed by an immediate loadURL in a new window failed with ERR_FAILED (-2);
      // a graceful close awaited on 'closed' does not.
      const closed = once(window, 'closed');
      window.close();
      await closed;
    }
  } finally {
    await server.close();
  }
}

app
  .whenReady()
  .then(main)
  .then(() => {
    app.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    app.exit(1);
  });
