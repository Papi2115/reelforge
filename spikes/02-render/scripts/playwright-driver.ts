/** Launches Playwright Chromium for a backend and wraps the page as a PageDriver. */
import { chromium, type Browser } from 'playwright';
import type { Backend } from './backends.ts';
import type { PageDriver } from './bench-core.ts';

export interface PlaywrightSession {
  readonly browser: Browser;
  readonly driver: PageDriver;
  /** Console errors and uncaught page errors collected so far. */
  readonly pageErrors: string[];
}

export async function launchPlaywright(backend: Backend): Promise<PlaywrightSession> {
  const browser = await chromium.launch(backend.launch);
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const driver: PageDriver = {
    load: async (url) => {
      await page.goto(url, { waitUntil: 'load' });
    },
    evaluate: (expression) => page.evaluate(expression),
  };
  return { browser, driver, pageErrors };
}
