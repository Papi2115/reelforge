/**
 * The app's render backend, wired by main.ts: hidden render windows (render-window.ts) for the
 * export (export-controller.ts) and the local render service for the `reelforge` CLI, which runs
 * only while a project is open. `serviceEnv(projectDir)` is what the claude-bridge's `extraEnv`
 * hook passes to Claude's child processes (REELFORGE_RENDER_URL / REELFORGE_RENDER_TOKEN).
 */
import path from 'node:path';
import type { ExtraEnv } from '@reelforge/claude-bridge';
import type { ExportProgress } from '@reelforge/pipeline';
import type { AppSettings } from '@reelforge/shared';
import { ENGINE_ASSET_DIR } from '../../shared/engine-assets.js';
import { RENDER_HOST_HTML, RENDER_PRELOAD_FILE } from '../../shared/render-host-contract.js';
import type { AppLayout } from '../app-paths.js';
import { describeError, type Logger } from '../logger.js';
import type { RendererSource } from '../navigation-policy.js';
import { ExportController } from './export-controller.js';
import { exportProject } from './export-project.js';
import { simulatedFallbackWarning } from './export-warnings.js';
import { PoolFrameRenderer } from './pool-frame-renderer.js';
import { engineBundleVersion } from './render-identity.js';
import { RenderLoadGate } from './render-load-gate.js';
import { RenderPool } from './render-pool.js';
import { createRenderServiceHandlers } from './render-service-handlers.js';
import { startRenderService, type RenderService } from './render-service.js';
import type { OpenRenderTarget } from './render-target.js';
import { openRenderWindow } from './render-window.js';

export interface RenderBackendOptions {
  readonly source: RendererSource;
  readonly layout: AppLayout;
  readonly settings: () => AppSettings;
  readonly cores: number;
  readonly currentProject: () => string | undefined;
  readonly pushProgress: (event: ExportProgress) => void;
  readonly log: Logger;
}

/**
 * One gate for every render window of the app (export, render service, smoke frames, the
 * production line's own backend): their engine frames share one renderer process.
 */
const APP_LOAD_GATE = new RenderLoadGate();

export class RenderBackend {
  readonly exports: ExportController;
  readonly openTarget: OpenRenderTarget;
  /** Smoke frames, card QA and anchors of the Scenes built stage (its own warm windows). */
  readonly frames: PoolFrameRenderer;
  private service: {
    readonly server: RenderService;
    readonly pool: RenderPool;
    readonly dir: string;
  } | null = null;
  private transition: Promise<void> = Promise.resolve();
  private engineVersion: string | undefined;

  constructor(private readonly options: RenderBackendOptions) {
    const { source, layout, log } = options;
    const hostUrl = new URL(`${ENGINE_ASSET_DIR}/${RENDER_HOST_HTML}`, source.url).href;
    const preloadFile = path.join(path.dirname(layout.preloadFile), RENDER_PRELOAD_FILE);
    const windowLog = log.child('window');
    this.openTarget = () =>
      openRenderWindow({
        hostUrl,
        preloadFile,
        lint: true,
        log: windowLog,
        loadGate: APP_LOAD_GATE,
      });
    this.frames = new PoolFrameRenderer(this.openTarget);
    this.exports = new ExportController({
      currentProject: options.currentProject,
      settings: options.settings,
      cores: options.cores,
      prepare: async () => {
        const version = await this.resolveEngineVersion();
        return version.ok
          ? { openTarget: this.openTarget, engineVersion: version.value }
          : { error: version.error };
      },
      run: exportProject,
      push: options.pushProgress,
      now: () => performance.now(),
      log: log.child('export'),
    });
  }

  /** Starts the render service for an opened project, stops it when the project closes. */
  followProject(dir: string | undefined): Promise<void> {
    this.transition = this.transition.then(async () => {
      if (this.service?.dir === dir) return;
      await this.stopService();
      if (dir !== undefined) await this.startService(dir);
    });
    return this.transition;
  }

  /** Env for a claude child working in `projectDir` (only for the project the service serves). */
  serviceEnv(projectDir: string): ExtraEnv | undefined {
    if (this.service === null || path.resolve(projectDir) !== path.resolve(this.service.dir)) {
      return undefined;
    }
    return this.service.server.env();
  }

  async dispose(): Promise<void> {
    this.exports.cancel();
    await this.frames.close();
    await this.followProject(undefined);
  }

  private async startService(dir: string): Promise<void> {
    const pool = new RenderPool(this.openTarget);
    try {
      const server = await startRenderService({
        handlers: createRenderServiceHandlers(pool),
        projectDir: () => this.service?.dir ?? undefined,
        log: this.options.log.child('service'),
      });
      this.service = { server, pool, dir };
    } catch (error) {
      await pool.close();
      this.options.log.error(`render service failed to start: ${describeError(error)}`);
    }
  }

  private async stopService(): Promise<void> {
    const current = this.service;
    this.service = null;
    if (current === null) return;
    await current.server.close();
    await current.pool.close();
  }

  private async resolveEngineVersion(): Promise<
    { ok: true; value: string } | { ok: false; error: string }
  > {
    if (this.engineVersion !== undefined) return { ok: true, value: this.engineVersion };
    const out = path.dirname(this.options.layout.rendererDir);
    const version = await engineBundleVersion([
      this.options.layout.rendererDir,
      path.join(out, 'public'),
    ]);
    if (version.ok) this.engineVersion = version.value;
    return version;
  }
}

/** Name of the test-only global (unpackaged app + REELFORGE_TEST_HOOKS=1). */
export const RENDER_TEST_HOOKS_GLOBAL = '__reelforgeRenderTest';
export const TEST_HOOKS_ENV = 'REELFORGE_TEST_HOOKS';
/** With the test hooks: Chromium's fake microphone and auto-accepted capture (recording tests). */
export const TEST_FAKE_MEDIA_ENV = 'REELFORGE_TEST_FAKE_MEDIA';

export interface RenderTestHooks {
  /** The env the app would give Claude for the open project (render service URL + token). */
  serviceEnv(): ExtraEnv | undefined;
  /** Sends a simulated "GPU encoder unavailable" warning to the running export (false: none). */
  exportWarning(): boolean;
}

/** Lets the app smoke tests reach the render service like Claude's child processes do. */
export function installRenderTestHooks(
  backend: RenderBackend,
  currentProject: () => string | undefined,
): void {
  const hooks: RenderTestHooks = {
    serviceEnv: () => {
      const dir = currentProject();
      return dir === undefined ? undefined : backend.serviceEnv(dir);
    },
    exportWarning: () => backend.exports.simulateWarning(simulatedFallbackWarning()),
  };
  Reflect.set(globalThis, RENDER_TEST_HOOKS_GLOBAL, hooks);
}
