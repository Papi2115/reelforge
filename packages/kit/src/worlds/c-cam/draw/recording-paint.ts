/**
 * RecordingPaint: a `Paint2D` that records every call and property write instead of drawing.
 * Deterministic unit tests snapshot the call sequence; later rasterizer tests use it as the
 * reference trace. Not used at runtime.
 */
import type { FillRule, LineCap, Paint2D } from './paint.js';

export type PaintValue = number | string | boolean;

/** One recorded call (`op` = method name) or property write (`op` = `set:<property>`). */
export interface PaintCall {
  readonly op: string;
  readonly args: readonly PaintValue[];
}

export class RecordingPaint implements Paint2D {
  readonly calls: PaintCall[] = [];
  private fill$ = '#000000';
  private stroke$ = '#000000';
  private width$ = 1;
  private cap$: LineCap = 'butt';
  private alpha$ = 1;

  private record(op: string, ...args: PaintValue[]): void {
    this.calls.push({ op, args });
  }

  get fillStyle(): string {
    return this.fill$;
  }
  set fillStyle(value: string) {
    this.fill$ = value;
    this.record('set:fillStyle', value);
  }
  get strokeStyle(): string {
    return this.stroke$;
  }
  set strokeStyle(value: string) {
    this.stroke$ = value;
    this.record('set:strokeStyle', value);
  }
  get lineWidth(): number {
    return this.width$;
  }
  set lineWidth(value: number) {
    this.width$ = value;
    this.record('set:lineWidth', value);
  }
  get lineCap(): LineCap {
    return this.cap$;
  }
  set lineCap(value: LineCap) {
    this.cap$ = value;
    this.record('set:lineCap', value);
  }
  get globalAlpha(): number {
    return this.alpha$;
  }
  set globalAlpha(value: number) {
    this.alpha$ = value;
    this.record('set:globalAlpha', value);
  }

  save(): void {
    this.record('save');
  }
  restore(): void {
    this.record('restore');
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.record('setTransform', a, b, c, d, e, f);
  }
  translate(x: number, y: number): void {
    this.record('translate', x, y);
  }
  rotate(angle: number): void {
    this.record('rotate', angle);
  }
  scale(x: number, y: number): void {
    this.record('scale', x, y);
  }
  beginPath(): void {
    this.record('beginPath');
  }
  closePath(): void {
    this.record('closePath');
  }
  moveTo(x: number, y: number): void {
    this.record('moveTo', x, y);
  }
  lineTo(x: number, y: number): void {
    this.record('lineTo', x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.record('quadraticCurveTo', cpx, cpy, x, y);
  }
  rect(x: number, y: number, width: number, height: number): void {
    this.record('rect', x, y, width, height);
  }
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    anticlockwise = false,
  ): void {
    this.record('ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
  }
  fill(rule: FillRule = 'nonzero'): void {
    this.record('fill', rule);
  }
  stroke(): void {
    this.record('stroke');
  }
  clip(): void {
    this.record('clip');
  }
  fillRect(x: number, y: number, width: number, height: number): void {
    this.record('fillRect', x, y, width, height);
  }

  /** One line per call (`op arg arg ...`, numbers at full precision): easy to diff and snapshot. */
  toLines(): string[] {
    return this.calls.map((call) => [call.op, ...call.args.map(String)].join(' '));
  }
}
