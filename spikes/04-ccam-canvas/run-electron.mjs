// Spike 14.0: the protocol in Electron (the app's runtime), GPU as the app uses it (no switches = ANGLE
// D3D11 on Windows), windows configured like apps/desktop/src/main/render/render-window.ts. A hidden window
// (export path) runs the whole protocol; a shown window (stand-in for the preview) repeats the hashes and
// the full-frame timing. One short run; a watchdog exits the app after 5 minutes whatever happens.
//   apps/desktop/node_modules/.bin/electron spikes/04-ccam-canvas/run-electron.mjs
import { app, BrowserWindow } from 'electron';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildSpike,
  DET_TIMES,
  frameTimes,
  manifest,
  OUT_DIR,
  png,
  runProtocol,
  startServer,
  stats,
} from './lib.mjs';

const WATCHDOG_MS = 5 * 60 * 1000;
const outDir = path.join(OUT_DIR, 'electron');
const watchdog = setTimeout(() => app.exit(3), WATCHDOG_MS);

app.enableSandbox();
app.commandLine.appendSwitch('js-flags', '--expose-gc');
app.commandLine.appendSwitch('enable-precise-memory-info');

function processMb() {
  const out = {};
  for (const metric of app.getAppMetrics()) {
    out[metric.type] =
      (out[metric.type] ?? 0) + Math.round(metric.memory.workingSetSize / 100) / 10;
  }
  return out;
}

async function openWindow(server, hostScript, show, errors) {
  const window = new BrowserWindow({
    show,
    width: 640,
    height: 360,
    x: 0,
    y: 0,
    focusable: false,
    skipTaskbar: true,
    title: 'ccam spike',
    webPreferences: {
      offscreen: false,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  if (show) window.setIgnoreMouseEvents(true);
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  await window.loadURL(server.url);
  await window.webContents.executeJavaScript(hostScript);
  const call = (name, ...args) =>
    window.webContents.executeJavaScript(
      `window.__spike[${JSON.stringify(name)}](...${JSON.stringify(args)})`,
    );
  const engineFrame = () =>
    window.webContents.mainFrame.frames.find((frame) => frame.url.endsWith('engine-frame.html'));
  return { window, call, engineFrame };
}

async function main() {
  await app.whenReady();
  const hostScript = await buildSpike();
  const server = await startServer();
  const errors = [];
  const windows = [];
  try {
    const hidden = await openWindow(server, hostScript, false, errors);
    windows.push(hidden.window);
    await mkdir(outDir, { recursive: true });
    const result = await runProtocol({
      call: hidden.call,
      fresh: async () => {
        const other = await openWindow(server, hostScript, false, errors);
        windows.push(other.window);
        return other.call;
      },
      memory: async () => {
        const script =
          'globalThis.gc?.(); Math.round(performance.memory.usedJSHeapSize / 1e5) / 10';
        const frameHeapMb = await hidden.engineFrame().executeJavaScript(script);
        return { frameHeapMb, processMb: processMb() };
      },
      saveFrame: (t, rgba) => writeFile(path.join(outDir, `frame-${t}.png`), png(rgba, 1920, 1080)),
    });
    const shown = await openWindow(server, hostScript, true, errors);
    windows.push(shown.window);
    const info = await shown.call('load', manifest({ mode: 'full', upload: 'canvas' }));
    const hashes = await shown.call('hashes', DET_TIMES);
    const times = await shown.call('seekTimes', frameTimes(72, 13 / 74));
    result.shownWindow = { info, hashes, perf: stats(times) };
    result.errors = errors;
    result.electron = process.versions.electron;
    result.chrome = process.versions.chrome;
    await writeFile(path.join(OUT_DIR, 'electron.json'), `${JSON.stringify(result, null, 2)}\n`);
  } finally {
    for (const window of windows) window.destroy();
    await server.close();
  }
}

main().then(
  () => {
    clearTimeout(watchdog);
    app.exit(0);
  },
  async (error) => {
    await writeFile(path.join(OUT_DIR, 'electron-error.txt'), String(error?.stack ?? error));
    app.exit(1);
  },
);
