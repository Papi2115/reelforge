/**
 * RenderSession backed by the app's render service: the app renders in its own (GPU) Electron
 * renderer, the same isolated per-shot manifest the Playwright session uses (built in the app
 * from the project files). Frames arrive as PNGs and are decoded, so the commands' output (PNG
 * files, contact sheets, QA) is the same on both paths.
 */
import { computeFrameStats, decodePng } from '@reelforge/engine/raster';
import type { RenderSetup, ShotPlan } from '../project/shots.js';
import type {
  ShotFramesRequest,
  ShotRenderResponse,
  ShotTargetRequest,
} from '../service/protocol.js';
import {
  RenderServiceClient,
  RenderServiceError,
  type RenderServiceConfig,
} from './service-client.js';
import type { RenderOptions, RenderSession, RenderedFrame, ShotRender } from './session.js';

/** The request target of `plan`: a storyboard shot (with its scene file) or a standalone scene. */
export function shotTarget(setup: RenderSetup, plan: ShotPlan): ShotTargetRequest {
  return plan.standalone
    ? { projectDir: setup.root, scene: plan.file, duration: plan.t1 - plan.t0 }
    : { projectDir: setup.root, shot: plan.id, scene: plan.file };
}

function decodeFrames(response: ShotRenderResponse): RenderedFrame[] {
  if (!response.result.ok) return [];
  return response.result.frames.map((frame) => {
    if (frame.png === undefined) {
      throw new RenderServiceError(
        'protocol',
        `the render service sent no PNG for t=${String(frame.t)}`,
      );
    }
    const image = decodePng(Buffer.from(frame.png, 'base64'));
    return { t: frame.t, image, stats: computeFrameStats(image.data) };
  });
}

export function toShotRender(plan: ShotPlan, response: ShotRenderResponse): ShotRender {
  const { result } = response;
  if (!result.ok) return { ok: false, plan, error: result.error, errors: result.errors };
  return {
    ok: true,
    plan,
    width: result.width,
    height: result.height,
    style: result.style,
    frames: decodeFrames(response),
    cards: result.cards,
    anchors: result.anchors,
    cues: result.cues,
    errors: result.errors,
  };
}

export async function openServiceRenderSession(
  setup: RenderSetup,
  config: RenderServiceConfig,
  client: RenderServiceClient = new RenderServiceClient(config),
): Promise<RenderSession> {
  await client.health();
  return {
    async render(plan: ShotPlan, options: RenderOptions): Promise<ShotRender> {
      const target = shotTarget(setup, plan);
      let response: ShotRenderResponse;
      if (options.times.length > 0) {
        const request: ShotFramesRequest = {
          ...target,
          at: [...options.times],
          cards: options.cards,
        };
        response = await client.frames(request);
      } else {
        response = options.cards ? await client.cards(target) : await client.anchors(target);
      }
      return toShotRender(plan, response);
    },
    close: () => Promise.resolve(),
  };
}
