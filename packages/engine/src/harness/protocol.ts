/**
 * postMessage protocol between the host page and the sandboxed engine frame (ADR-004).
 * Every message is validated with zod on receipt; frames travel as transferred ArrayBuffers.
 */
import type { RenderManifest, SceneSource } from '@reelforge/shared';
import { z } from 'zod';
import { ENGINE_ERROR_CODES } from '../errors.js';
import type { LoadInfo } from '../runtime.js';
import type { CardDiagnostic } from '../text/check-cards.js';

export const RPC_CHANNEL = 'reelforge-engine/1';

/** Harness contract (PLAN.md §3.2), exposed as `window.__reelforge` on the host page. */
export interface ReelforgeHarness {
  /** Loads a video; rejects with a typed engine error message when a scene is broken. */
  load(manifest: RenderManifest): Promise<LoadInfo>;
  /** Renders global time t (seconds); resolves when `frame()` holds that frame. */
  seek(t: number): Promise<void>;
  /** Video duration in seconds (0 before a successful load). */
  readonly duration: number;
  /** RGBA8 top-down pixels of the last seeked frame (width*height*4 bytes). */
  frame(): Uint8Array<ArrayBuffer>;
  /** Text-card QA (overlaps, safe area) of one loaded shot, sampled every frame. */
  checkCards(shotId: string): Promise<readonly CardDiagnostic[]>;
  /**
   * Hot reload (PLAN.md#6.4): rebuilds one shot of the loaded video from new scene source, keeping
   * every other shot. Rejects with a typed engine error (lint, import, build) and then leaves the
   * previous version of the shot in place. Seek again to see the change.
   */
  reloadShot(shotId: string, scene: SceneSource): Promise<LoadInfo>;
}

export const readyMessageSchema = z.object({
  channel: z.literal(RPC_CHANNEL),
  type: z.literal('ready'),
});
export type ReadyMessage = z.infer<typeof readyMessageSchema>;

export const requestSchema = z.discriminatedUnion('method', [
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    method: z.literal('load'),
    manifest: z.unknown(),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    method: z.literal('seek'),
    t: z.number(),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    method: z.literal('cards'),
    shotId: z.string(),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    method: z.literal('reloadShot'),
    shotId: z.string(),
    scene: z.unknown(),
  }),
]);
export type RpcRequest = z.infer<typeof requestSchema>;

const gpuInfoSchema = z.object({ vendor: z.string(), renderer: z.string(), version: z.string() });

export const loadInfoSchema = z.object({
  duration: z.number(),
  style: z.string(),
  width: z.int(),
  height: z.int(),
  fps: z.int(),
  cues: z.array(z.object({ t: z.number(), name: z.string(), shotId: z.string() })),
  anchors: z.array(
    z.object({
      shotId: z.string(),
      phrase: z.string(),
      nth: z.int(),
      t: z.number(),
      tEnd: z.number(),
    }),
  ),
  gpu: gpuInfoSchema,
});

export const cardDiagnosticSchema = z.object({
  rule: z.enum(['card-overlap', 'card-outside-safe-area']),
  severity: z.literal('error'),
  shotId: z.string(),
  cards: z.array(z.string()),
  t0: z.number(),
  t1: z.number(),
  message: z.string(),
  fix: z.string(),
});

export const errorDataSchema = z.object({
  code: z.enum(ENGINE_ERROR_CODES),
  message: z.string(),
  shotId: z.string().optional(),
});

export const responseSchema = z.union([
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('load'),
    result: loadInfoSchema,
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('seek'),
    result: z.object({ frame: z.instanceof(ArrayBuffer) }),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('cards'),
    result: z.array(cardDiagnosticSchema),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('reloadShot'),
    result: loadInfoSchema,
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(false),
    error: errorDataSchema,
  }),
]);
export type RpcResponse = z.infer<typeof responseSchema>;
