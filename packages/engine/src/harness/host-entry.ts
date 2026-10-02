/**
 * Entry of the harness host page (`harness.html`): exposes `window.__reelforge` (PLAN.md §3.2)
 * backed by the sandboxed engine frame served next to it.
 */
import { createSandboxedHarness } from './host.js';
import type { ReelforgeHarness } from './protocol.js';

declare global {
  interface Window {
    __reelforge?: ReelforgeHarness;
  }
}

window.__reelforge = createSandboxedHarness({
  frameUrl: new URL('engine-frame.html', window.location.href).href,
  container: document.body,
  // `harness.html?lint` rejects scenes that fail the determinism lint before loading them.
  lintScenes: new URLSearchParams(window.location.search).has('lint'),
});
