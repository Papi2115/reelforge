/**
 * The hidden render window (ADR-002): `show: false` (not offscreen), GPU (Chromium's default
 * ANGLE backend, D3D11 on Windows), sandboxed + context-isolated, loading the render host page
 * (same engine frame as the preview). Frames come back over IPC as structured-clone bytes.
 * Closing is graceful first (`close()` + `closed`: destroy() then a new window failed in the
 * spike) but bounded: a hung renderer is killed and the window destroyed (render-window-close.ts).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { CardDiagnostic, LoadInfo } from '@reelforge/engine';
import type { RenderManifest } from '@reelforge/shared';
import { BrowserWindow } from 'electron';
import { RENDER_HOST_CHANNELS, type RenderHostCall } from '../../shared/render-host-contract.js';
import { describeError, type Logger } from '../logger.js';
import { renderHostReplySchema, type ValidatedReply } from './host-replies.js';
import { closeRenderWindow } from './render-window-close.js';
import type { RenderError, RenderTarget } from './render-target.js';

export interface RenderWindowOptions {
  /** URL of render-host.html (renderer origin). */
  readonly hostUrl: string;
  readonly preloadFile: string;
  /** Determinism lint before every load (as the preview). */
  readonly lint: boolean;
  readonly log: Logger;
  /** Limit for a load (scene builds) in ms; default 120 s. */
  readonly loadTimeoutMs?: number;
  /** Limit for one frame / card check in ms; default 30 s. */
  readonly callTimeoutMs?: number;
  /** Limit for the page to become ready in ms; default 30 s. */
  readonly readyTimeoutMs?: number;
}

/** Console errors kept per window between two takes (a broken scene can log every frame). */
const MAX_CONSOLE_ERRORS = 50;

interface Pending {
  readonly method: RenderHostCall['method'];
  settle(result: Result<ValidatedReply, RenderError>): void;
}

type CallInput =
  | { readonly method: 'load'; readonly manifest: RenderManifest }
  | { readonly method: 'frame'; readonly t: number }
  | { readonly method: 'cards'; readonly shotId: string };

class RenderWindow implements RenderTarget {
  private readonly pending = new Map<number, Pending>();
  private readonly consoleErrors: string[] = [];
  private nextId = 1;
  private gone: RenderError | null = null;
  private closing: Promise<void> | null = null;

  constructor(
    private readonly window: BrowserWindow,
    private readonly options: RenderWindowOptions,
  ) {
    const contents = window.webContents;
    contents.ipc.on(RENDER_HOST_CHANNELS.reply, (_event, payload: unknown) => {
      this.onReply(payload);
    });
    contents.on('console-message', (details) => {
      if (details.level !== 'error' || this.consoleErrors.length >= MAX_CONSOLE_ERRORS) return;
      this.consoleErrors.push(details.message);
    });
    contents.on('render-process-gone', (_event, details) => {
      this.fail({ kind: 'crashed', message: `renderer process gone: ${details.reason}` });
    });
    window.on('closed', () => {
      this.fail({ kind: 'closed', message: 'render window closed' });
    });
  }

  get alive(): boolean {
    return this.gone === null;
  }

  async load(manifest: RenderManifest): Promise<Result<LoadInfo, RenderError>> {
    const reply = await this.call(
      { method: 'load', manifest },
      this.options.loadTimeoutMs ?? 120_000,
    );
    if (!reply.ok) return reply;
    return reply.value.ok && 'info' in reply.value ? ok(reply.value.info) : err(unexpected('load'));
  }

  async frame(t: number): Promise<Result<Uint8Array, RenderError>> {
    const reply = await this.call({ method: 'frame', t }, this.options.callTimeoutMs ?? 30_000);
    if (!reply.ok) return reply;
    return reply.value.ok && 'frame' in reply.value
      ? ok(reply.value.frame)
      : err(unexpected('frame'));
  }

  async cards(shotId: string): Promise<Result<readonly CardDiagnostic[], RenderError>> {
    const reply = await this.call(
      { method: 'cards', shotId },
      this.options.callTimeoutMs ?? 30_000,
    );
    if (!reply.ok) return reply;
    return reply.value.ok && 'cards' in reply.value
      ? ok(reply.value.cards)
      : err(unexpected('cards'));
  }

  takeConsoleErrors(): string[] {
    return this.consoleErrors.splice(0);
  }

  close(): Promise<void> {
    this.closing ??= this.closeWindow();
    return this.closing;
  }

  private async closeWindow(): Promise<void> {
    this.fail({ kind: 'closed', message: 'render window closed' });
    // A renderer that missed a deadline may never run its unload handlers: kill it first.
    const hung = this.gone?.kind === 'timeout';
    await closeRenderWindow(this.window, { hung, log: this.options.log });
  }

  private call(input: CallInput, timeoutMs: number): Promise<Result<ValidatedReply, RenderError>> {
    if (this.gone !== null) return Promise.resolve(err(this.gone));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // A renderer that misses a deadline is not reused (it may still be busy).
        this.fail({
          kind: 'timeout',
          message: `${input.method} took longer than ${String(timeoutMs)} ms`,
        });
      }, timeoutMs);
      this.pending.set(id, {
        method: input.method,
        settle: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
      });
      const call: RenderHostCall = { id, ...input };
      this.window.webContents.send(RENDER_HOST_CHANNELS.call, call);
    });
  }

  private onReply(payload: unknown): void {
    const parsed = renderHostReplySchema.safeParse(payload);
    if (!parsed.success) {
      this.options.log.error(`malformed render reply: ${parsed.error.message.slice(0, 500)}`);
      this.fail({ kind: 'protocol', message: 'the render page sent a malformed reply' });
      return;
    }
    const reply = parsed.data;
    const entry = this.pending.get(reply.id);
    if (entry === undefined) return;
    this.pending.delete(reply.id);
    if (!reply.ok) {
      entry.settle(err({ kind: 'engine', message: reply.error.message, code: reply.error.code }));
      return;
    }
    entry.settle(reply.method === entry.method ? ok(reply) : err(unexpected(entry.method)));
  }

  /** Marks the window unusable and fails every call in flight. */
  private fail(error: RenderError): void {
    if (this.gone === null) {
      this.gone = error;
      if (error.kind !== 'closed') this.options.log.warn(`render window: ${error.message}`);
      if (error.kind === 'timeout' || error.kind === 'protocol') void this.close();
    }
    for (const entry of this.pending.values()) entry.settle(err(error));
    this.pending.clear();
  }
}

function unexpected(method: string): RenderError {
  return { kind: 'protocol', message: `unexpected reply to ${method}` };
}

function hostPageUrl(options: RenderWindowOptions): string {
  const url = new URL(options.hostUrl);
  if (options.lint) url.searchParams.set('lint', '1');
  return url.href;
}

/** Opens a hidden render window and waits until its page is ready for calls. */
export async function openRenderWindow(
  options: RenderWindowOptions,
): Promise<Result<RenderTarget, RenderError>> {
  const window = new BrowserWindow({
    show: false,
    width: 640,
    height: 360,
    title: 'ReelForge renderer',
    webPreferences: {
      preload: options.preloadFile,
      offscreen: false,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
    },
  });
  const target = new RenderWindow(window, options);
  const ready = new Promise<void>((resolve) => {
    window.webContents.ipc.once(RENDER_HOST_CHANNELS.ready, () => {
      resolve();
    });
  });
  const timeoutMs = options.readyTimeoutMs ?? 30_000;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => {
      resolve('timeout');
    }, timeoutMs);
  });
  try {
    await window.loadURL(hostPageUrl(options));
    if ((await Promise.race([ready, timeout])) === 'timeout') {
      await target.close();
      return err({
        kind: 'protocol',
        message: `the render page was not ready within ${String(timeoutMs)} ms`,
      });
    }
    return ok(target);
  } catch (error) {
    await target.close();
    return err({
      kind: 'protocol',
      message: `cannot load the render page: ${describeError(error)}`,
    });
  } finally {
    clearTimeout(timer);
  }
}
