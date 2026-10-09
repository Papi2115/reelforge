/**
 * IPC payloads of the project overview and the Shorts area (PLAN.md#13.16 part B, #13.18): the
 * overview of one project (its card, the uploaded YouTube thumbnail, film facts, its Shorts, its
 * film), uploading / removing the thumbnail, showing the last export, making the two Shorts of a
 * film and switching a Short's captions. Every request names a project of the Home list (main
 * refuses any other folder). Merged into ipc-contract.ts.
 */
import { z } from 'zod';
import {
  homeActionResultSchema,
  homeDirRequestSchema,
  homeProjectSchema,
  type HomeActionResult,
} from './home-contract.js';

/** The uploaded thumbnail (`publish/thumbnail.png|jpg`). */
export const overviewThumbnailSchema = z.object({
  /** `thumbnail.png` or `thumbnail.jpg`. */
  fileName: z.string(),
  /** A scaled copy for the overview (data URL). */
  picture: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});
export type OverviewThumbnail = z.infer<typeof overviewThumbnailSchema>;

/** Where the voice-over came from. */
export const VOICE_SOURCES = ['none', 'recorded', 'elevenlabs'] as const;

export const filmFactsSchema = z.object({
  voice: z.enum(VOICE_SOURCES),
  /** Shots in the storyboard (the end card of a Short included). */
  shots: z.number().int().nonnegative(),
  /** Scene files built (`scenes/*.js`). */
  scenesBuilt: z.number().int().nonnegative(),
  /** File name of the newest export (`out/*.mp4`); null = none yet. */
  exportFile: z.string().nullable(),
  /** When that export was written (ISO); null = none. */
  exportedAt: z.string().nullable(),
});
export type FilmFacts = z.infer<typeof filmFactsSchema>;

export const projectOverviewSchema = z.object({
  card: homeProjectSchema,
  thumbnail: overviewThumbnailSchema.nullable(),
  facts: filmFactsSchema,
  /** The film's Shorts (empty for a Short). */
  shorts: z.array(homeProjectSchema),
  /** The film's style can have Shorts (voxel styles and Comic). */
  shortsSupported: z.boolean(),
  /** A Short's film; `known` = it is in the Home list (it can be opened). */
  parent: z.object({ dir: z.string(), title: z.string(), known: z.boolean() }).nullable(),
});
export type ProjectOverview = z.infer<typeof projectOverviewSchema>;

export const projectOverviewResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), overview: projectOverviewSchema }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ProjectOverviewResult = z.infer<typeof projectOverviewResultSchema>;

export const thumbnailResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), overview: projectOverviewSchema }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ThumbnailResult = z.infer<typeof thumbnailResultSchema>;

/** Longest angle hint of "New short from a film". */
export const MAX_ANGLE_HINT_LENGTH = 160;

export const shortsCreateRequestSchema = z.strictObject({
  /** The film's folder. */
  dir: z.string().min(1).max(4096),
  /** Steers both Shorts' angles; absent = two different built-in angles. */
  angleHint: z.string().trim().min(1).max(MAX_ANGLE_HINT_LENGTH).optional(),
  /** Word-by-word captions. */
  captions: z.boolean(),
});
export type ShortsCreateRequest = z.infer<typeof shortsCreateRequestSchema>;

export const createdShortSchema = z.object({
  dir: z.string(),
  title: z.string(),
  lengthS: z.number().positive(),
});
export type CreatedShortInfo = z.infer<typeof createdShortSchema>;

export const shortsCreateResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), shorts: z.array(createdShortSchema) }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type ShortsCreateResult = z.infer<typeof shortsCreateResultSchema>;

export const shortCaptionsRequestSchema = z.strictObject({
  dir: z.string().min(1).max(4096),
  captions: z.boolean(),
});

export const OVERVIEW_IPC = {
  /** The overview of a project of the Home list. */
  homeOverview: {
    name: 'home:overview',
    request: homeDirRequestSchema,
    response: projectOverviewResultSchema,
  },
  /** Picks a PNG / JPEG and makes it the project's thumbnail (committed). */
  homeThumbnailUpload: {
    name: 'home:thumbnail-upload',
    request: homeDirRequestSchema,
    response: thumbnailResultSchema,
  },
  /** Removes the uploaded thumbnail (committed). */
  homeThumbnailRemove: {
    name: 'home:thumbnail-remove',
    request: homeDirRequestSchema,
    response: thumbnailResultSchema,
  },
  /** Shows the newest export in the system's file browser. */
  homeShowExport: {
    name: 'home:show-export',
    request: homeDirRequestSchema,
    response: homeActionResultSchema,
  },
  /** Makes the 30 s and 60 s Shorts of a film (new projects next to it, added to Home). */
  homeShortsCreate: {
    name: 'home:shorts-create',
    request: shortsCreateRequestSchema,
    response: shortsCreateResultSchema,
  },
  /** Word-by-word captions of a Short on / off (project.json#short.captions, committed). */
  homeShortCaptions: {
    name: 'home:short-captions',
    request: shortCaptionsRequestSchema,
    response: homeActionResultSchema,
  },
} as const;

export interface OverviewApi {
  getProjectOverview(dir: string): Promise<ProjectOverviewResult>;
  uploadThumbnail(dir: string): Promise<ThumbnailResult>;
  removeThumbnail(dir: string): Promise<ThumbnailResult>;
  showLastExport(dir: string): Promise<HomeActionResult>;
  createShorts(request: ShortsCreateRequest): Promise<ShortsCreateResult>;
  setShortCaptions(dir: string, captions: boolean): Promise<HomeActionResult>;
}
