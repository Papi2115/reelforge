/**
 * `pnpm test:packaged` (after `pnpm package`): the smoke checks on release/win-unpacked.
 * Not part of CI: it needs the packaged app, a GPU-capable desktop session and git.
 */
import { definePackagedSmokeTests } from './packaged-checks.js';
import { unpackedExe } from './packaged-app.js';

definePackagedSmokeTests('unpacked', () => unpackedExe);
