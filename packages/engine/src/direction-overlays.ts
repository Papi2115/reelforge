/**
 * Host overlay marks of live co-direction (PLAN.md#12.14): the annotation vocabulary and layer of
 * ADR-008 (arrow, ring, underline, callout, badge; "highlight" = a spotlight on the point) drawn
 * at a screen point, timed in film seconds on a spoken word, into an own pixel surface that is
 * composited over the finished frame (direction-frame.ts). Pure function of time.
 */
import type { DirectionOverlay, SafeAreaMargins } from '@reelforge/shared';
import * as THREE from 'three';
import { createAnnotationLayer, type AnnotationLayer } from './annotations/layer.js';
import type { AnnotateApi } from './annotations/types.js';
import { EngineError } from './errors.js';
import { hashString } from './rng.js';
import type { ScenePalette } from './style.js';
import { createTextSurface, type TextSurface } from './text/surface.js';
import { safeAreaRect } from './text/text-layer.js';

/** Seconds a mark keeps fading out after `until` (the annotation default exit). */
const EXIT_TAIL_S = 0.4;
const RING_RADIUS = 0.09;
const SPOTLIGHT_RADIUS = 0.16;
const UNDERLINE_SIZE: readonly [number, number] = [0.22, 0.07];

export interface OverlayPainterOptions {
  readonly width: number;
  readonly height: number;
  readonly palette: ScenePalette;
  readonly safeArea: SafeAreaMargins;
  readonly seed: number;
}

export interface OverlayPainter {
  /**
   * Draws the overlays alive at film time t into the painter's surface (cleared first); returns
   * the surface, or undefined when nothing is drawn.
   */
  paint(overlays: readonly DirectionOverlay[], t: number): TextSurface | undefined;
}

function annotate(api: AnnotateApi, overlay: DirectionOverlay): void {
  const screen: [number, number] = [overlay.x, overlay.y];
  const timing = { id: `direction:${overlay.id}`, at: overlay.at, until: overlay.until };
  switch (overlay.kind) {
    case 'arrow':
      api.arrow({ ...timing, target: { screen } });
      return;
    case 'ring':
      api.ring({ ...timing, target: { screen }, radius: RING_RADIUS });
      return;
    case 'underline':
      api.underline({ ...timing, target: { screen, size: [...UNDERLINE_SIZE] } });
      return;
    case 'highlight':
      api.spotlight({ ...timing, target: { screen }, radius: SPOTLIGHT_RADIUS, dim: 0.5 });
      return;
    case 'callout':
      api.callout({
        ...timing,
        text: overlay.text ?? overlay.word?.text ?? '!',
        target: { screen },
      });
      return;
    case 'badge': {
      const number = Number(overlay.text);
      const value = Number.isInteger(number) && number >= 0 && number <= 99 ? number : '!';
      api.badge({ ...timing, value, target: { screen }, pulse: true });
      return;
    }
  }
}

export function createOverlayPainter(options: OverlayPainterOptions): OverlayPainter {
  const { width, height } = options;
  const surface = createTextSurface(width, height);
  // Screen targets need neither a scene nor a camera; the layer's API wants them.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  const layer: AnnotationLayer = createAnnotationLayer({
    shotId: 'direction',
    width,
    height,
    safeArea: safeAreaRect(width, height, options.safeArea),
    palette: options.palette,
    seed: hashString('direction', options.seed),
    surface,
    scene,
    camera,
    textCards: () => [],
    anchor: () => {
      throw new EngineError('protocol', 'direction overlays are timed in seconds, not phrases');
    },
  });
  return {
    paint(overlays, t) {
      const alive = overlays.filter(
        (overlay) => t >= overlay.at && t < overlay.until + EXIT_TAIL_S,
      );
      if (alive.length === 0) return undefined;
      surface.clear();
      layer.beginFrame(t);
      for (const overlay of alive) annotate(layer.frameApi, overlay);
      layer.endFrame(false);
      return surface.empty ? undefined : surface;
    },
  };
}
