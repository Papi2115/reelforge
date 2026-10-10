// The automated suite, headless: anchors, connectivity, tangle (+ face contact), contact (ST.meet), continuity.
// usage: node tools/validate.mjs [characterId,...]   -> prints a summary, writes proof/validate.log, exit 1 on failure
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire('C:/Users/galar/Desktop/yt/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/');
const { chromium } = require('./index.js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--force-color-profile=srgb'] });
const tab = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
tab.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await tab.goto('file:///' + path.join(root, 'test.html').split(path.sep).join('/') + '?sheets=0');
const t0 = process.hrtime.bigint();
const r = await tab.evaluate((ids) => window.__validate.run(ids), only);
const secs = Number(process.hrtime.bigint() - t0) / 1e9;
await browser.close();

const lines = [`c-plus engine validators - ${r.ok && !errors.length ? 'ALL GREEN' : 'FAILED'} (${secs.toFixed(1)} s)`, ''];
Object.keys(r.counts).forEach((t) => lines.push(`${t.padEnd(13)} ${String(r.counts[t] - (r.fails[t] || 0)).padStart(6)} / ${r.counts[t]} checks passed`));
lines.push('', ...r.notes, '', 'metrics:');
Object.keys(r.metrics).forEach((k) => lines.push(`  ${k} = ${r.metrics[k].toFixed(2)}`));
if (r.failures.length) lines.push('', `failures (first ${r.failures.length}):`, ...r.failures.map((f) => '  ' + f));
if (errors.length) lines.push('', 'page errors:', ...errors.map((e) => '  ' + e));
const text = lines.join('\n') + '\n';
if (!only) fs.writeFileSync(path.join(root, 'proof', 'validate.log'), text);
process.stdout.write(text);
process.exit(r.ok && !errors.length ? 0 : 1);
