/**
 * Paint2D: the 2D-context surface the C-CAM ("Grim Ink") drawing code needs, and nothing more.
 * A real `CanvasRenderingContext2D` satisfies it at runtime (`asPaint2D` narrows its colour
 * properties, which TypeScript types as string | gradient | pattern, to plain strings);
 * `RecordingPaint` implements it for
 * tests; a path rasterizer can implement it later (PLAN.md#14.3).
 *
 * Deliberately absent: `fillText`/`strokeText`/`font` (system fonts are forbidden, ADR-005; the
 * ink-stroke lettering is another task), gradients and patterns (the grammar forbids them, so
 * `fillStyle`/`strokeStyle` are plain CSS colour strings), `arc`/`bezierCurveTo` (unused),
 * `lineJoin`, `globalCompositeOperation`, `resetTransform`, `drawImage` and pixel access.
 *
 * Winding contract for rasterizer implementers: `gloom` punches its hole with a clockwise `rect`
 * plus an anticlockwise `ellipse` filled with the default `nonzero` rule; `blob` crescents rely on
 * `evenodd`.
 */
export type FillRule = 'nonzero' | 'evenodd';

export type LineCap = 'butt' | 'round' | 'square';

export interface Paint2D {
  /** Plain CSS colour string (hex or rgba()); never a gradient or pattern. */
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: LineCap;
  globalAlpha: number;

  save(): void;
  restore(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;

  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
  ): void;

  fill(rule?: FillRule): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, width: number, height: number): void;
}

/**
 * A real canvas context as Paint2D. Safe because the interface only ever writes colour strings;
 * the cast only narrows what can be read back from `fillStyle`/`strokeStyle`.
 */
export function asPaint2D(ctx: CanvasRenderingContext2D): Paint2D {
  return ctx as unknown as Paint2D;
}
