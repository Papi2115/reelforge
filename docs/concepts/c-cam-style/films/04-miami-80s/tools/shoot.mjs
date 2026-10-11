// Headless capture with playwright-core + an installed Chrome (paths: tools/pw.mjs, env PW_CORE / CHROME_PATH).
// usage: node tools/shoot.mjs <page.html[?query]> <out.png> [js expression returning a PNG dataURL]
// default expression: window.__showcase.frame(0)
import fs from 'fs';
import { launch, fileUrl } from './pw.mjs';

const [, , page, outPng, expr] = process.argv;
const browser = await launch();
const tab = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
let errors = 0;
tab.on('console', (m) => { if (m.type() === 'error') { errors++; process.stdout.write('console.error: ' + m.text() + '\n'); } });
tab.on('pageerror', (e) => { errors++; process.stdout.write('PAGEERROR: ' + (e.stack || e.message) + '\n'); });
await tab.goto(fileUrl(page));
let data = null;
try {
  data = await tab.evaluate(expr || 'window.__showcase.frame(0)');
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
