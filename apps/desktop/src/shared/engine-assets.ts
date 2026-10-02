/**
 * The sandboxed engine frame (packages/engine harness bundle, ADR-004) is copied into the
 * renderer's static assets under this directory, so it is served from the renderer origin.
 */
export const ENGINE_ASSET_DIR = 'engine';
export const ENGINE_FRAME_HTML = 'engine-frame.html';
export const ENGINE_FRAME_FILES = [ENGINE_FRAME_HTML, 'engine-frame.js'] as const;
