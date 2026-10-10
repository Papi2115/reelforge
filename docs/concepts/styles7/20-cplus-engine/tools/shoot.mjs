// Headless capture with the repo's playwright-core + installed Chrome.
// usage: node tools/shoot.mjs <page.html[?query]> <out.png> [js expression returning a PNG dataURL or JSON]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire('C:/Users/galar/Desktop/yt/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/');
const { chromium } = require('./index.js');

const [, , page, outPng, expr] = process.argv;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--force-color-profile=srgb'] });
const tab = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
let errors = 0;
tab.on('console', (m) => { if (m.type() === 'error') { errors++; process.stdout.write('console.error: ' + m.text() + '\n'); } });
tab.on('pageerror', (e) => { errors++; process.stdout.write('PAGEERROR: ' + e.message + '\n'); });
await tab.goto('file:///' + path.resolve(page.split('?')[0]).split(path.sep).join('/') + (page.includes('?') ? '?' + page.split('?')[1] : ''));
let data = null;
try {
  data = await tab.evaluate(expr || 'window.__test.lineup(false)');
} catch (e) {
  errors++;
  process.stdout.write('EVAL ERROR: ' + e.message + '\n');
}
if (typeof data === 'string' && data.startsWith('data:')) {
  fs.writeFileSync(outPng, Buffer.from(data.split(',')[1], 'base64'));
  process.stdout.write('wrote ' + outPng + '\n');
} else if (data !== null) process.stdout.write('result ' + JSON.stringify(data) + '\n');
process.stdout.write(errors ? `ERRORS: ${errors}\n` : 'no console errors\n');
await browser.close();
process.exit(errors ? 1 : 0);
