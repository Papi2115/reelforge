/**
 * postMessage protocol between the host page and the sandboxed engine frame (ADR-004).
 * Every message is validated with zod on receipt; frames travel as transferred ArrayBuffers.
 */
import {
  shotDirectionSchema,
  type RenderManifest,
  type SceneSource,
  type ShotDirection,
} from '@reelforge/shared';
import { z } from 'zod';
import { ENGINE_ERROR_CODES } from '../errors.js';
import type { LoadInfo } from '../runtime.js';
import { CARD_RULES, type CardDiagnostic } from '../text/check-cards.js';

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
  /** Text-card and annotation QA (overlaps, safe area, targets, anchors) of one loaded shot. */
  checkCards(shotId: string): Promise<readonly CardDiagnostic[]>;
  /**
   * Hot reload (PLAN.md#6.4): rebuilds one shot of the loaded video from new scene source, keeping
   * every other shot. Rejects with a typed engine error (lint, import, build) and then leaves the
   * previous version of the shot in place. Seek again to see the change.
   */
  reloadShot(shotId: string, scene: SceneSource): Promise<LoadInfo>;
  /**
   * Object picking (PLAN.md#6.6): what is at normalized frame point (x, y) (0..1, top-left) at
   * global time t; null = background. Renders nothing; `frame()` keeps the last seeked frame.
   */
  pick(x: number, y: number, t: number): Promise<PickInfo | null>;
  /**
   * Live co-direction (PLAN.md#12.14): replaces one shot's direction overrides (null clears them)
   * without rebuilding the shot. Seek again to see the change.
   */
  setShotDirection(shotId: string, direction: ShotDirection | null): Promise<void>;
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
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    method: z.literal('pick'),
    x: z.number(),
    y: z.number(),
    t: z.number(),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    method: z.literal('direct'),
    shotId: z.string(),
    direction: shotDirectionSchema.nullable(),
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
  rule: z.enum(CARD_RULES),
  severity: z.enum(['error', 'warning', 'info']),
  shotId: z.string(),
  cards: z.array(z.string()),
  t0: z.number(),
  t1: z.number(),
  message: z.string(),
  fix: z.string(),
  anchor: z.object({ phrase: z.string(), at: z.number(), spokenT: z.number() }).optional(),
});

const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const pickResultSchema = z.object({
  kind: z.enum(['kit', 'object', 'text']),
  shotId: z.string(),
  t: z.number(),
  localTime: z.number(),
  name: z.string(),
  id: z.string(),
  kitKind: z.enum(['env', 'prop', 'fx']).optional(),
  call: z.string().optional(),
  occurrence: z.int().optional(),
  sceneName: z.string().optional(),
  parent: z.string().optional(),
  position: vec3Schema.optional(),
  size: vec3Schema.optional(),
  description: z.string(),
});

/** A pick result as it crosses the frame boundary (PickResult of the runtime, validated). */
export type PickInfo = z.infer<typeof pickResultSchema>;

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
    ok: z.literal(true),
    method: z.literal('pick'),
    result: pickResultSchema.nullable(),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(true),
    method: z.literal('direct'),
    result: z.null(),
  }),
  z.object({
    channel: z.literal(RPC_CHANNEL),
    id: z.int(),
    ok: z.literal(false),
    error: errorDataSchema,
  }),
]);
export type RpcResponse = z.infer<typeof responseSchema>;
