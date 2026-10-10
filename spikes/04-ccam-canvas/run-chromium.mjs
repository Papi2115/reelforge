// Spike 14.0: the protocol in Playwright Chromium with SwiftShader (the render:frames / golden backend).
//   node spikes/04-ccam-canvas/run-chromium.mjs      -> out/chromium-swiftshader.json + PNG frames
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSpike, engineRequire, OUT_DIR, png, runProtocol, startServer } from './lib.mjs';

const ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--js-flags=--expose-gc',
  '--enable-precise-memory-info',
];
const outDir = path.join(OUT_DIR, 'chromium-swiftshader');

/** Working set (MB) per Chromium process type (Windows; integer bytes avoid locale formats). */
function workingSetMb(processes) {
  const ids = processes.map((info) => info.id).join(',');
  const script = `Get-Process -Id ${ids} -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Id)=$($_.WorkingSet64)" }`;
  const output = execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
  });
  const bytes = new Map(
    output
      .trim()
      .split(/\s+/)
      .map((line) => line.split('=').map(Number)),
  );
  const out = {};
  for (const info of processes) {
    out[info.type] = (out[info.type] ?? 0) + Math.round((bytes.get(info.id) ?? 0) / 1e5) / 10;
  }
  return out;
}

const hostScript = await buildSpike();
const server = await startServer();
const { chromium } = engineRequire('playwright');
const browser = await chromium.launch({ headless: true, args: ARGS });
try {
  const errors = [];
  const open = async () => {
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await page.goto(server.url, { waitUntil: 'load' });
    await page.addScriptTag({ content: hostScript });
    const call = (name, ...args) =>
      page.evaluate(({ n, a }) => globalThis.__spike[n](...a), { n: name, a: args });
    return { page, call };
  };
  const main = await open();
  const engineFrame = () =>
    main.page.frames().find((frame) => frame.url().endsWith('engine-frame.html'));
  const cdp = await browser.newBrowserCDPSession();
  const processes = async () => (await cdp.send('SystemInfo.getProcessInfo')).processInfo;
  await mkdir(outDir, { recursive: true });
  const result = await runProtocol({
    call: main.call,
    fresh: async () => (await open()).call,
    memory: async () => {
      const frameHeapMb = await engineFrame().evaluate(() => {
        globalThis.gc?.();
        return Math.round(performance.memory.usedJSHeapSize / 1e5) / 10;
      });
      return { frameHeapMb, processMb: workingSetMb(await processes()) };
    },
    saveFrame: (t, rgba) => writeFile(path.join(outDir, `frame-${t}.png`), png(rgba, 1920, 1080)),
  });
  result.errors = errors;
  result.browser = browser.version();
  await writeFile(
    path.join(OUT_DIR, 'chromium-swiftshader.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(result.memory)}\n`);
} finally {
  await browser.close();
  await server.close();
}
