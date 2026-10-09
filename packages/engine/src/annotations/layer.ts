/**
 * Per-shot annotation layer (`ctx.annotate`): calls in update() are validated immediately and
 * queued; after update() returns, `endFrame` projects their targets with the final camera of the
 * frame, draws them into the text overlay in call order and registers them as cards (QA, picking).
 */
import { PALETTE_TOKENS } from '@reelforge/shared';
import type * as THREE from 'three';
import type { z } from 'zod';
import type { AnchorHit } from '../contract.js';
import { EngineError } from '../errors.js';
import { hashString } from '../rng.js';
import type { ScenePalette } from '../style.js';
import { defaultLowerThirdScale, defaultTitleScale, shortEdge } from '../text/cards.js';
import { parseTextArgument } from '../text/options.js';
import { hexToRgb8, type Rgb8, type TextSurface } from '../text/surface.js';
import type { AnnotationTargetProbe, PixelRect, TextCard } from '../text/types.js';
import { drawBadge, drawHighlight, drawSpotlight, drawUnderline } from './draw-marks.js';
import { drawCallout, drawPin } from './draw-boxes.js';
import { drawSourceChip } from './draw-source-chip.js';
import { drawStamp } from './draw-stamp.js';
import { drawBracket, drawDimension } from './draw-spans.js';
import { drawArrow, drawRing } from './draw-strokes.js';
import type { AnnotationDraw, AnnotationEnv } from './env.js';
import { ANNOTATION_TYPES, type AnnotationType, type CommonParsed } from './options.js';
import type { TargetSpec } from './target-spec.js';
import { resolveTarget, type ResolvedTarget } from './targets.js';
import { annotationPhase, defaultEnterDuration } from './timing.js';
import type { AnnotateApi, AnnotationHandle } from './types.js';

export interface AnnotationLayerOptions {
  readonly shotId: string;
  readonly width: number;
  readonly height: number;
  readonly safeArea: PixelRect;
  readonly palette: ScenePalette;
  /** Shot seed; per-annotation seeds derive from it and the annotation id. */
  readonly seed: number;
  readonly surface: TextSurface;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Text cards registered in the current frame (card targets, placement). */
  textCards(): readonly TextCard[];
  /** Resolves a spoken phrase to local time (throws when it is not in words.json). */
  anchor(phrase: string, nth?: number): AnchorHit;
}

export interface AnnotationLayer {
  /** `ctx.annotate` during build: every call throws (annotations are drawn per frame). */
  readonly buildApi: AnnotateApi;
  readonly frameApi: AnnotateApi;
  beginFrame(t: number): void;
  /** Draws the queued annotations; `probe` also raycasts every 3D target for occlusion (QA). */
  endFrame(probe: boolean): void;
  cards(): readonly TextCard[];
}

interface Queued {
  readonly id: string;
  readonly type: AnnotationType;
  readonly text: string;
  readonly common: CommonParsed;
  readonly color: string;
  readonly at: number;
  readonly anchor: { readonly phrase: string; readonly spokenT: number } | undefined;
  readonly draw: (env: AnnotationEnv) => AnnotationDraw;
}

/** What each type's call contributes besides the common options. */
interface Entry {
  readonly text: string;
  readonly color?: string | undefined;
  readonly draw: (env: AnnotationEnv) => AnnotationDraw;
}

const ID_TEXT_LENGTH = 24;

function badgeColor(value: string | number): string | undefined {
  if (value === 'check') return 'accent3';
  if (value === 'cross') return 'accent2';
  return undefined;
}

export function createAnnotationLayer(options: AnnotationLayerOptions): AnnotationLayer {
  const { shotId, width, height, palette } = options;
  const swatches: Readonly<Record<string, string>> = palette;
  const colors = new Map<string, Rgb8>();
  const anchors = new Map<string, AnchorHit>();
  const idCounts = new Map<string, number>();
  let t = 0;
  let queue: Queued[] = [];
  let cards: TextCard[] = [];

  const resolveColor = (call: string, name: string, option: string): Rgb8 => {
    const cached = colors.get(name);
    if (cached) return cached;
    const hex = Object.hasOwn(swatches, name) ? swatches[name] : undefined;
    if (hex === undefined) {
      throw new EngineError(
        'invalid-annotation-options',
        `${call}: options.${option}: "${name}" is not a colour of this style; use a palette token (${PALETTE_TOKENS.join(', ')}) or a swatch name`,
        { shotId },
      );
    }
    const rgb = hexToRgb8(hex);
    colors.set(name, rgb);
    return rgb;
  };

  const uniqueId = (id: string): string => {
    const count = (idCounts.get(id) ?? 0) + 1;
    idCounts.set(id, count);
    return count === 1 ? id : `${id}#${String(count)}`;
  };

  const resolveAnchor = (common: CommonParsed): { phrase: string; spokenT: number } | undefined => {
    if (common.phrase === undefined) return undefined;
    const { phrase, nth } = common;
    const key = `${phrase}\u0000${String(nth)}`;
    const hit = anchors.get(key) ?? options.anchor(phrase, nth);
    anchors.set(key, hit);
    return { phrase, spokenT: hit.t };
  };

  const enqueue = <Parsed extends CommonParsed>(
    type: AnnotationType,
    schema: z.ZodType<Parsed>,
    input: unknown,
    entry: (parsed: Parsed) => Entry,
  ): AnnotationHandle => {
    const call = `ctx.annotate.${type}()`;
    const parsed = parseTextArgument(
      schema,
      input ?? {},
      call,
      shotId,
      'options',
      'invalid-annotation-options',
    );
    const anchor = resolveAnchor(parsed);
    const at = parsed.at ?? anchor?.spokenT ?? 0;
    const made = entry(parsed);
    const label = made.text.replace(/\s+/g, ' ').trim().slice(0, ID_TEXT_LENGTH);
    const id = uniqueId(parsed.id ?? (label === '' ? type : `${type}:${label}`));
    const color = parsed.color ?? made.color ?? ANNOTATION_TYPES[type].color;
    queue.push({ id, type, text: made.text, common: parsed, color, at, anchor, draw: made.draw });
    return { id, type };
  };

  const frameApi: AnnotateApi = {
    callout: (input) =>
      enqueue('callout', ANNOTATION_TYPES.callout.schema, input, (parsed) => ({
        text: parsed.title === undefined ? parsed.text : `${parsed.title}: ${parsed.text}`,
        draw: (env) => drawCallout(env, parsed),
      })),
    arrow: (input) =>
      enqueue('arrow', ANNOTATION_TYPES.arrow.schema, input, (parsed) => ({
        text: parsed.text ?? '',
        draw: (env) => drawArrow(env, parsed),
      })),
    ring: (input) =>
      enqueue('ring', ANNOTATION_TYPES.ring.schema, input, (parsed) => ({
        text: '',
        draw: (env) => drawRing(env, parsed),
      })),
    bracket: (input) =>
      enqueue('bracket', ANNOTATION_TYPES.bracket.schema, input, (parsed) => ({
        text: parsed.text ?? '',
        draw: (env) => drawBracket(env, parsed),
      })),
    pin: (input) =>
      enqueue('pin', ANNOTATION_TYPES.pin.schema, input, (parsed) => ({
        text: parsed.text,
        draw: (env) => drawPin(env, parsed),
      })),
    underline: (input) =>
      enqueue('underline', ANNOTATION_TYPES.underline.schema, input, (parsed) => ({
        text: '',
        draw: (env) => drawUnderline(env, parsed),
      })),
    highlight: (input) =>
      enqueue('highlight', ANNOTATION_TYPES.highlight.schema, input, (parsed) => ({
        text: '',
        draw: (env) => drawHighlight(env, parsed),
      })),
    badge: (input) =>
      enqueue('badge', ANNOTATION_TYPES.badge.schema, input, (parsed) => ({
        text: String(parsed.value),
        color: badgeColor(parsed.value),
        draw: (env) => drawBadge(env, parsed),
      })),
    stamp: (input) =>
      enqueue('stamp', ANNOTATION_TYPES.stamp.schema, input, (parsed) => ({
        text: parsed.text,
        draw: (env) => drawStamp(env, parsed),
      })),
    dimension: (input) =>
      enqueue('dimension', ANNOTATION_TYPES.dimension.schema, input, (parsed) => ({
        text: parsed.text,
        draw: (env) => drawDimension(env, parsed),
      })),
    spotlight: (input) =>
      enqueue('spotlight', ANNOTATION_TYPES.spotlight.schema, input, (parsed) => ({
        text: '',
        draw: (env) => drawSpotlight(env, parsed),
      })),
    sourceChip: (input) =>
      enqueue('sourceChip', ANNOTATION_TYPES.sourceChip.schema, input, (parsed) => ({
        text: parsed.name,
        draw: (env) => drawSourceChip(env, parsed),
      })),
  };

  const outsideUpdate = (name: string): never => {
    throw new EngineError(
      'annotate-outside-update',
      `ctx.annotate.${name}() draws a single frame; call it in update(t, state, ctx) every frame (use at/until or phrase for timing), not in build()`,
      { shotId },
    );
  };
  const buildApi: AnnotateApi = {
    callout: () => outsideUpdate('callout'),
    arrow: () => outsideUpdate('arrow'),
    ring: () => outsideUpdate('ring'),
    bracket: () => outsideUpdate('bracket'),
    pin: () => outsideUpdate('pin'),
    underline: () => outsideUpdate('underline'),
    highlight: () => outsideUpdate('highlight'),
    badge: () => outsideUpdate('badge'),
    stamp: () => outsideUpdate('stamp'),
    dimension: () => outsideUpdate('dimension'),
    spotlight: () => outsideUpdate('spotlight'),
    sourceChip: () => outsideUpdate('sourceChip'),
  };

  const drawOne = (
    item: Queued,
    textCards: readonly TextCard[],
    occupied: PixelRect[],
    probe: boolean,
  ): TextCard => {
    const call = `ctx.annotate.${item.type}() [annotation "${item.id}"]`;
    const { common } = item;
    const enter = common.enter ?? ANNOTATION_TYPES[item.type].enter;
    const timing = {
      at: item.at,
      until: common.until ?? Infinity,
      enter,
      exit: common.exit,
      enterDuration: common.enterDuration ?? defaultEnterDuration(enter),
      exitDuration: common.exitDuration,
    };
    const phase = annotationPhase(t, timing);
    const probes: AnnotationTargetProbe[] = [];
    const targetEnv = {
      shotId,
      width,
      height,
      scene: options.scene,
      camera: options.camera,
      cards: textCards,
    };
    const edge = shortEdge({ width, height });
    const env: AnnotationEnv = {
      surface: options.surface,
      width,
      height,
      safeArea: options.safeArea,
      seed: hashString(`annotate:${item.id}`, options.seed),
      stroke: Math.max(1, Math.round(edge / 180)),
      labelScale: defaultLowerThirdScale(edge),
      bigScale: defaultTitleScale(edge),
      phase,
      color: resolveColor(call, item.color, 'color'),
      outline: common.outline === false ? undefined : resolveColor(call, common.outline, 'outline'),
      paint: { opacity: phase.opacity },
      resolveColor: (name, option) => resolveColor(call, name, option),
      target: (spec: TargetSpec, role: string, occlusion = false): ResolvedTarget => {
        const resolved = resolveTarget(spec, targetEnv, probe || occlusion);
        probes.push({
          role,
          label: resolved.label,
          x: Math.round(resolved.x),
          y: Math.round(resolved.y),
          onScreen: resolved.onScreen,
          occluded: resolved.occluded,
        });
        return resolved;
      },
      occupied,
    };
    const drawn = item.draw(env);
    const visible = phase.visible && drawn.hidden !== true;
    // Later labels keep clear of what is already drawn (dimmers and marker bars excepted).
    const backdrop = item.type === 'spotlight' || item.type === 'highlight';
    if (visible && !backdrop && drawn.extent.w > 0 && drawn.extent.h > 0) {
      occupied.push(drawn.extent);
    }
    return {
      id: item.id,
      kind: 'annotation',
      text: item.text,
      box: drawn.box,
      at: item.at,
      until: timing.until,
      visible,
      annotation: {
        type: item.type,
        targets: probes,
        anchor: item.anchor,
        textScale: drawn.textScale,
        extent: drawn.extent,
      },
    };
  };

  return {
    buildApi,
    frameApi,
    beginFrame(time) {
      t = time;
      queue = [];
      cards = [];
      idCounts.clear();
    },
    endFrame(probe) {
      if (queue.length === 0) return;
      options.scene.updateMatrixWorld();
      options.camera.updateMatrixWorld();
      const textCards = options.textCards();
      const occupied = textCards
        .filter((card) => card.visible && card.box.w > 0 && card.box.h > 0)
        .map((card) => card.box);
      // Source chips take a corner nothing else uses, so they follow the other marks; spotlights
      // dim what is left empty, so they go last: behind every other annotation.
      const last = (item: Queued): number =>
        item.type === 'spotlight' ? 2 : item.type === 'sourceChip' ? 1 : 0;
      const order = [0, 1, 2].flatMap((rank) => queue.filter((item) => last(item) === rank));
      const drawn = new Map(order.map((item) => [item, drawOne(item, textCards, occupied, probe)]));
      cards = queue.flatMap((item) => drawn.get(item) ?? []);
      queue = [];
    },
    cards: () => cards,
  };
}
