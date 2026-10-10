/**
 * The drawing surface a C-CAM scene gets from `kit.fx.inkStage` (PLAN.md#14.2): a `Paint2D` that
 * forwards to the stage's canvas context and exposes nothing else. The raw context would hand a
 * scene `g.canvas` (and through it the document), `fillText` with system fonts, `drawImage`,
 * filters and pixel reads, all forbidden by the ADR-004 addendum; the surface keeps them out of
 * reach by construction.
 */
import type { FillRule, LineCap, Paint2D } from './draw/paint.js';

/** The `Paint2D` part of a canvas context the surface forwards to (a real context has it all). */
export type SurfaceTarget = Pick<CanvasRenderingContext2D, keyof Paint2D>;

/** The surface only ever writes colour strings, so a style read back is one (else: none). */
function colourOf(style: unknown): string {
  return typeof style === 'string' ? style : '';
}

/** A frozen `Paint2D` forwarding to `target`; the only way scenes touch the stage canvas. */
export function stageSurface(target: SurfaceTarget): Paint2D {
  const surface: Paint2D = {
    get fillStyle() {
      return colourOf(target.fillStyle);
    },
    set fillStyle(value: string) {
      target.fillStyle = value;
    },
    get strokeStyle() {
      return colourOf(target.strokeStyle);
    },
    set strokeStyle(value: string) {
      target.strokeStyle = value;
    },
    get lineWidth() {
      return target.lineWidth;
    },
    set lineWidth(value: number) {
      target.lineWidth = value;
    },
    get lineCap() {
      return target.lineCap;
    },
    set lineCap(value: LineCap) {
      target.lineCap = value;
    },
    get globalAlpha() {
      return target.globalAlpha;
    },
    set globalAlpha(value: number) {
      target.globalAlpha = value;
    },
    save: () => {
      target.save();
    },
    restore: () => {
      target.restore();
    },
    setTransform: (a, b, c, d, e, f) => {
      target.setTransform(a, b, c, d, e, f);
    },
    translate: (x, y) => {
      target.translate(x, y);
    },
    rotate: (angle) => {
      target.rotate(angle);
    },
    scale: (x, y) => {
      target.scale(x, y);
    },
    beginPath: () => {
      target.beginPath();
    },
    closePath: () => {
      target.closePath();
    },
    moveTo: (x, y) => {
      target.moveTo(x, y);
    },
    lineTo: (x, y) => {
      target.lineTo(x, y);
    },
    quadraticCurveTo: (cpx, cpy, x, y) => {
      target.quadraticCurveTo(cpx, cpy, x, y);
    },
    rect: (x, y, width, height) => {
      target.rect(x, y, width, height);
    },
    ellipse: (x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise) => {
      target.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
    },
    fill: (rule?: FillRule) => {
      if (rule === undefined) target.fill();
      else target.fill(rule);
    },
    stroke: () => {
      target.stroke();
    },
    clip: () => {
      target.clip();
    },
    fillRect: (x, y, width, height) => {
      target.fillRect(x, y, width, height);
    },
  };
  return Object.freeze(surface);
}
