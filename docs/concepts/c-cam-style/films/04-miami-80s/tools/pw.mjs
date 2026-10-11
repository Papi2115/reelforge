// Shared launcher for the proof tools: playwright-core + an installed Chrome/Chromium.
// Defaults are Papi's Windows setup (same as films 01-03); override on any machine with
//   PW_CORE=<dir of playwright-core>   CHROME_PATH=<chrome executable>
// e.g. Linux: PW_CORE=/opt/node-tools/node_modules/playwright-core CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const PW_CORE = process.env.PW_CORE || 'C:/Users/galar/Desktop/yt/node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core/';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function launch() {
  const require = createRequire(PW_CORE.endsWith('/') || PW_CORE.endsWith('\\') ? PW_CORE : PW_CORE + '/');
  const { chromium } = require('./index.js');
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb'] });
}

// absolute or relative file path (Windows or POSIX, spaces allowed) + optional ?query -> file:// URL
export function fileUrl(page) {
  const q = page.indexOf('?');
  const file = q >= 0 ? page.slice(0, q) : page, query = q >= 0 ? page.slice(q) : '';
  return pathToFileURL(path.resolve(file)).href + query;
}
