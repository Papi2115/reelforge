/**
 * HTTP protocol of the app's local render service (the desktop app serves it, the `reelforge` CLI
 * calls it when the app runs Claude). The CLI finds it through two env vars the app passes to its
 * `claude` child processes; every request carries the bearer token and the project folder, and
 * the service renders only the project that is open in the app.
 *
 * Endpoints (JSON bodies, `authorization: Bearer <token>`):
 * - `GET  /health`  -> HealthResponse
 * - `POST /load`    {projectDir} -> LoadResponse (the whole video built, scene lint on)
 * - `POST /frames`  ShotFramesRequest -> ShotRenderResponse (PNG frames + optional card QA)
 * - `POST /cards`   ShotTargetRequest -> ShotRenderResponse (card QA only, no frames)
 * - `POST /anchors` ShotTargetRequest -> ShotRenderResponse (build-only dry run: anchors, cues)
 * Failures: HTTP 4xx/5xx with ServiceErrorBody.
 */
import { cardDiagnosticSchema } from '@reelforge/engine';
import { EXPORT_PRESET_IDS } from '@reelforge/pipeline';
import { z } from 'zod';

export const RENDER_URL_ENV = 'REELFORGE_RENDER_URL';
export const RENDER_TOKEN_ENV = 'REELFORGE_RENDER_TOKEN';
export const RENDER_SERVICE_VERSION = 1;

export const RENDER_SERVICE_PATHS = {
  health: '/health',
  load: '/load',
  frames: '/frames',
  cards: '/cards',
  anchors: '/anchors',
} as const;

/** Largest accepted request body (requests carry ids and times, never frames or sources). */
export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_FRAMES_PER_REQUEST = 64;

const projectDirSchema = z.string().min(1).max(4096);

export const loadRequestSchema = z.strictObject({ projectDir: projectDirSchema });
export type LoadRequest = z.infer<typeof loadRequestSchema>;

/**
 * Which shot: a storyboard shot (`shot`, optionally rendered with another `scene` file), or a
 * scene file (`scene`): its storyboard shot, or standalone from t=0 for `duration` seconds.
 */
const shotTargetShape = {
  projectDir: projectDirSchema,
  shot: z.string().min(1).max(128).optional(),
  scene: z.string().min(1).max(1024).optional(),
  duration: z.number().positive().max(36_000).optional(),
};

const needsShotOrScene = {
  message: 'pass "shot" or "scene"',
  path: ['shot'],
};

export const shotTargetRequestSchema = z
  .strictObject(shotTargetShape)
  .refine((request) => request.shot !== undefined || request.scene !== undefined, needsShotOrScene);
export type ShotTargetRequest = z.infer<typeof shotTargetRequestSchema>;

export const shotFramesRequestSchema = z
  .strictObject({
    ...shotTargetShape,
    /** Local shot times (seconds). */
    at: z.array(z.number().min(0).max(36_000)).min(1).max(MAX_FRAMES_PER_REQUEST),
    /** Also run the text-card QA (one load for both). */
    cards: z.boolean().optional(),
    /** Export preset: frames are neighbour-upscaled to its output size (default: render size). */
    preset: z.enum(EXPORT_PRESET_IDS).optional(),
    /** `base64` (default): PNGs in the response; `files`: written under .reelforge/frames/<shot>/. */
    output: z.enum(['base64', 'files']).optional(),
  })
  .refine((request) => request.shot !== undefined || request.scene !== undefined, needsShotOrScene);
export type ShotFramesRequest = z.infer<typeof shotFramesRequestSchema>;

const anchorSchema = z.object({
  shotId: z.string(),
  phrase: z.string(),
  nth: z.int(),
  t: z.number(),
  tEnd: z.number(),
});
const cueSchema = z.object({ t: z.number(), name: z.string(), shotId: z.string() });

export const renderedFrameSchema = z.object({
  /** Local shot time. */
  t: z.number(),
  width: z.int(),
  height: z.int(),
  /** Base64 PNG (output `base64`). */
  png: z.string().optional(),
  /** Absolute PNG path (output `files`). */
  file: z.string().optional(),
});
export type RenderedFrameData = z.infer<typeof renderedFrameSchema>;

export const shotRenderResponseSchema = z.object({
  version: z.literal(RENDER_SERVICE_VERSION),
  shot: z.object({
    id: z.string(),
    file: z.string(),
    t0: z.number(),
    t1: z.number(),
    standalone: z.boolean(),
  }),
  result: z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      /** Render size of the engine (frames may be upscaled by a preset). */
      width: z.int(),
      height: z.int(),
      style: z.string(),
      gpu: z.string().nullable(),
      frames: z.array(renderedFrameSchema),
      cards: z.array(cardDiagnosticSchema),
      anchors: z.array(anchorSchema),
      cues: z.array(cueSchema),
      /** Console errors of the renderer while loading/rendering. */
      errors: z.array(z.string()),
    }),
    z.object({
      ok: z.literal(false),
      /** Why the scene did not load (engine error, written for the scene author). */
      error: z.string(),
      errors: z.array(z.string()),
    }),
  ]),
});
export type ShotRenderResponse = z.infer<typeof shotRenderResponseSchema>;

export const loadResponseSchema = z.object({
  version: z.literal(RENDER_SERVICE_VERSION),
  result: z.discriminatedUnion('ok', [
    z.object({
      ok: z.literal(true),
      duration: z.number(),
      style: z.string(),
      width: z.int(),
      height: z.int(),
      fps: z.int(),
      shots: z.array(z.string()),
      anchors: z.array(anchorSchema),
      cues: z.array(cueSchema),
      gpu: z.string().nullable(),
      errors: z.array(z.string()),
    }),
    z.object({ ok: z.literal(false), error: z.string(), errors: z.array(z.string()) }),
  ]),
});
export type LoadResponse = z.infer<typeof loadResponseSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('reelforge-render'),
  version: z.literal(RENDER_SERVICE_VERSION),
  /** The project folder the service renders (the one open in the app). */
  projectDir: z.string().nullable(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const SERVICE_ERROR_KINDS = [
  /** Bad request (exit code 2 in the CLI). */
  'usage',
  /** The project cannot be rendered as it is (missing/invalid file, unknown shot). */
  'project',
  'unauthorized',
  /** Not the project open in the app, or a forbidden origin. */
  'forbidden',
  'not-found',
  'too-large',
  /** The renderer failed (window crashed, timed out). */
  'renderer',
  'internal',
] as const;
export type ServiceErrorKind = (typeof SERVICE_ERROR_KINDS)[number];

export const serviceErrorBodySchema = z.object({
  error: z.object({
    kind: z.enum(SERVICE_ERROR_KINDS),
    message: z.string(),
    fix: z.string().optional(),
  }),
});
export type ServiceErrorBody = z.infer<typeof serviceErrorBodySchema>;
