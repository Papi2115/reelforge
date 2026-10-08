/**
 * Helpers of the diagram kit (PLAN.md#13.15a): the page methods it draws with, the diagram's own
 * clock (an element follows the previous element of the same diagram) and the small labels
 * (quick print, blooming in unless the hand writes them; the highlight in red).
 */
export interface Drawn {
  readonly at: number;
  readonly end: number;
}
export type Opts = Record<string, unknown>;
export interface DiagramHost {
  write(text: unknown, options?: unknown): Drawn;
  stroke(points: unknown, options?: unknown): Drawn;
  arrow(points: unknown, options?: unknown): Drawn;
  fill(points: unknown, options?: unknown): Drawn;
  loop(cx: unknown, cy: unknown, rx: unknown, ry: unknown, options?: unknown): Drawn;
  textWidth(text: unknown, size: unknown, hand?: unknown): number;
}

/** Writes the small labels of a diagram after its structure, as the spec asks. */
export function labeller(
  host: DiagramHost,
  o: { pen: string; size: number; labels: string; highlight?: number | undefined },
) {
  const tool = o.pen === 'bic' ? 'bic' : o.pen === 'pencil' ? 'pencil' : 'fine';
  return (text: string, x: number, y: number, index: number, extra: Opts = {}): Drawn => {
    const red = o.highlight === index;
    const appear = o.labels === 'appear' && !red ? { appear: 'bloom' } : {};
    return host.write(text, {
      x,
      y,
      size: o.size,
      quick: true,
      hand: 'print',
      tool: red ? 'red' : tool,
      ...appear,
      ...extra,
    });
  };
}

export const penOf = (pen: string) =>
  pen === 'bic' ? 'bic' : pen === 'pencil' ? 'pencil' : pen === 'fine' ? 'fine' : 'felt';

/**
 * The page methods with the diagram's own clock: an element without `at` follows the diagram's
 * previous element (not whatever the scene drew in between), the first one starts at `start`.
 */
export function chained(page: DiagramHost, start: unknown, out: readonly Drawn[]): DiagramHost {
  const when = (options: unknown): Opts => {
    const own = (typeof options === 'object' && options !== null ? options : {}) as Opts;
    if (own['at'] !== undefined) return own;
    const after = out.length === 0 ? start : Math.max(...out.map((drawn) => drawn.end)) + 0.08;
    return after === undefined ? own : { ...own, at: after };
  };
  return {
    write: (text, options) => page.write(text, when(options)),
    stroke: (points, options) => page.stroke(points, when(options)),
    arrow: (points, options) => page.arrow(points, when(options)),
    fill: (points, options) => page.fill(points, when(options)),
    loop: (cx, cy, rx, ry, options) => page.loop(cx, cy, rx, ry, when(options)),
    textWidth: (text, size, hand) => page.textWidth(text, size, hand),
  };
}
