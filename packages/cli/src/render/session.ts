/**
 * Renders shots through the engine harness, the same sandboxed engine as preview and export:
 * - inside the app (REELFORGE_RENDER_URL set by the app for its claude processes): the app's
 *   render service (service-session.ts, GPU Electron renderer);
 * - otherwise (dev, CI): headless Chromium + SwiftShader. One browser per command; one fresh page
 *   per shot so console errors and failures are attributed to the right shot.
 */
import type { CardDiagnostic, ResolvedAnchor, SfxCue } from '@reelforge/engine';
import type { HarnessBrowser } from '@reelforge/engine/cli';
import type { FrameStats, RgbaImage } from '@reelforge/engine/raster';
import { describeUnknown, ProjectError } from '../errors.js';
import {
  isolatedManifest,
  withManifestAssets,
  type RenderSetup,
  type ShotPlan,
} from '../project/shots.js';
import { engineCli } from './engine-tools.js';
import { renderServiceFromEnv } from './service-client.js';
import { openServiceRenderSession } from './service-session.js';

export interface RenderedFrame {
  /** Local shot time (seconds). */
  readonly t: number;
  readonly image: RgbaImage;
  readonly stats: FrameStats;
}

export interface ShotRenderOk {
  readonly ok: true;
  readonly plan: ShotPlan;
  readonly width: number;
  readonly height: number;
  readonly style: string;
  readonly frames: readonly RenderedFrame[];
  /** Text-card QA; empty when not requested. */
  readonly cards: readonly CardDiagnostic[];
  /** Anchors and sfx cues the scene declared in build() (global time). */
  readonly anchors: readonly ResolvedAnchor[];
  readonly cues: readonly SfxCue[];
  /** Console errors of the page while loading/rendering. */
  readonly errors: readonly string[];
}

export interface ShotRenderFailed {
  readonly ok: false;
  readonly plan: ShotPlan;
  /** Why the scene did not load or render (engine error, written for the scene author). */
  readonly error: string;
  readonly errors: readonly string[];
}

export type ShotRender = ShotRenderOk | ShotRenderFailed;

export interface RenderOptions {
  /** Local shot times (seconds) to render; empty = build only (anchors/cues). */
  readonly times: readonly number[];
  readonly cards: boolean;
}

export interface RenderSession {
  render(plan: ShotPlan, options: RenderOptions): Promise<ShotRender>;
  close(): Promise<void>;
}

export { blankFrameNote } from './blank.js';

/** Engine errors arrive wrapped by Playwright (`page.evaluate: Error: [shot s01] ...`). */
export function cleanEngineError(error: unknown): string {
  const text = describeUnknown(error);
  const firstBlock = text.split(/\n\s+at |\nCall log:/)[0] ?? text;
  return firstBlock
    .replace(/^page\.evaluate:\s*/, '')
    .replace(/^(Engine)?Error:\s*/, '')
    .trim();
}

async function launch(): Promise<HarnessBrowser> {
  const { launchHarnessBrowser } = await engineCli();
  try {
    return await launchHarnessBrowser();
  } catch (error) {
    throw new ProjectError(
      `the frame renderer (headless Chromium) could not start: ${cleanEngineError(error)}`,
      'tell the user; a developer can install it with `pnpm --filter @reelforge/engine exec playwright install --only-shell chromium`',
    );
  }
}

export async function openRenderSession(
  setup: RenderSetup,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RenderSession> {
  const service = renderServiceFromEnv(env);
  if (service !== undefined) return openServiceRenderSession(setup, service);
  return openPlaywrightSession(setup);
}

async function openPlaywrightSession(setup: RenderSetup): Promise<RenderSession> {
  const browser = await launch();
  const { computeFrameStats } = await engineCli();
  return {
    async render(plan, options) {
      // lint: project props (kit-ext) are checked by the engine like in the app's render windows.
      const page = await browser.open({ lint: true });
      try {
        const manifest = await withManifestAssets(setup.root, isolatedManifest(setup, plan));
        const loaded = await page.load(manifest).then(
          (info) => ({ info }),
          (error: unknown) => ({ error: cleanEngineError(error) }),
        );
        if ('error' in loaded) {
          return { ok: false, plan, error: loaded.error, errors: [...page.errors] };
        }
        const { info } = loaded;
        const frames: RenderedFrame[] = [];
        // A scene that throws in update() (or passes bad ctx.text options) is the scene's
        // problem, reported like a load failure, never as a reelforge bug.
        let step = '';
        try {
          for (const t of options.times) {
            step = `rendering t=${t.toFixed(2)}s`;
            const data = await page.frameAt(plan.t0 + t);
            const image = { width: info.width, height: info.height, data };
            frames.push({ t, image, stats: computeFrameStats(data) });
          }
          step = 'checking the text cards';
          const cards = options.cards ? await page.checkCards(plan.id) : [];
          return {
            ok: true,
            plan,
            width: info.width,
            height: info.height,
            style: info.style,
            frames,
            cards,
            anchors: info.anchors.filter((anchor) => anchor.shotId === plan.id),
            cues: info.cues.filter((cue) => cue.shotId === plan.id),
            errors: [...page.errors],
          };
        } catch (error) {
          return {
            ok: false,
            plan,
            error: `${step}: ${cleanEngineError(error)}`,
            errors: [...page.errors],
          };
        }
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}
