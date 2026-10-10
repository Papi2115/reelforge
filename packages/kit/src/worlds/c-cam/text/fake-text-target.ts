/**
 * Test support (not used at runtime): a canvas text target for the `ink.text` tests. Families in
 * `installed` measure wider than the generic fallbacks (so the probe finds them); every text call
 * is recorded as a line.
 */
import type { TextTarget } from './ink-text.js';

/** A canvas text target: `installed` families measure wider than the generics; records calls. */
export function fakeTarget(installed: readonly string[]): TextTarget & { calls: string[] } {
  const calls: string[] = [];
  const target = {
    calls,
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    lineJoin: 'miter' as CanvasLineJoin,
    fillStyle: '#000000' as string | CanvasGradient | CanvasPattern,
    strokeStyle: '#000000' as string | CanvasGradient | CanvasPattern,
    lineWidth: 1,
    measureText(text: string) {
      const hit = installed.some(
        (family) => target.font.includes(`'${family}'`) || target.font.includes(` ${family},`),
      );
      return { width: text.length * (hit ? 11 : 10) };
    },
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    translate: (x: number, y: number) => calls.push(`translate ${String(x)} ${String(y)}`),
    rotate: (angle: number) => calls.push(`rotate ${angle.toFixed(4)}`),
    fillText: (text: string, x: number, y: number) =>
      calls.push(
        `fillText ${text} ${String(x)} ${String(y)} ${target.fillStyle as string} ${target.font}`,
      ),
    strokeText: (text: string, x: number, y: number) =>
      calls.push(
        `strokeText ${text} ${String(x)} ${String(y)} ${target.strokeStyle as string} lw ${String(target.lineWidth)} ${target.lineJoin}`,
      ),
  };
  return target;
}
