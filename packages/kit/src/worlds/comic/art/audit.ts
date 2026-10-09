/**
 * The empty-panel audit (PLAN.md#13.15a; real run Comic 1: five shots opened on ruled but empty
 * panels for 0.6-3 s). `page.audit({ until })` samples the shot and paints each visible panel's
 * content alone (no lettering over it); a panel whose interior is almost one flat ink (< 2 %
 * other pixels) counts as empty. Spans longer than 0.6 s come back as findings. Pure: it renders
 * into its own canvas and changes nothing on the page.
 */
import { z } from 'zod';
import { ComicCanvas } from '../draw/canvas.js';
import { DEFAULT_SCREEN } from '../draw/paint.js';
import { INK } from '../inks.js';
import type { ComicPageModel } from '../page/model.js';
import type { PanelModel } from '../page/panel.js';
import { ComicPen } from '../page/pen.js';

export const auditSchema = z.strictObject({
  until: z.number().positive().max(120).describe('The shot length'),
  step: z.number().min(0.02).max(1).default(0.1),
  longest: z.number().min(0).max(10).default(0.6).describe('Longest allowed empty span'),
  minContent: z
    .number()
    .min(0)
    .max(0.5)
    .default(0.02)
    .describe('Share of non-dominant pixels below which a panel is empty'),
});

export interface EmptyPanel {
  /** Panel number in creation order (1-based). */
  readonly panel: number;
  readonly from: number;
  readonly to: number;
}

/** Share of a panel's interior that is not its most common ink. */
function contentShare(canvas: ComicCanvas, mask: Uint8Array): number {
  const counts = new Uint32Array(32);
  let total = 0;
  const { data } = canvas;
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== 1) continue;
    counts[data[i] ?? 0] = (counts[data[i] ?? 0] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) return 1;
  return 1 - Math.max(...counts) / total;
}

function panelShare(
  canvas: ComicCanvas,
  model: ComicPageModel,
  panel: PanelModel,
  t: number,
): number {
  const page = model.place(t);
  canvas.clear(INK.PAPER);
  const mask = canvas.maskPoly(page.map(panel.quad(t)));
  try {
    canvas.withClip(mask, () => {
      const local = panel.localTime(t);
      const ctx = {
        canvas,
        boilFrame: Math.floor(t * 10),
        screen: panel.style.screen ?? DEFAULT_SCREEN,
      };
      const pen = new ComicPen(ctx, panel.contentPlace(page, t), panel.style.mis, local);
      for (const painter of panel.painters) painter(pen, local);
    });
    return contentShare(canvas, mask);
  } finally {
    canvas.release(mask);
  }
}

/** Spans in which a visible panel shows (almost) nothing, longer than `longest`. */
export function emptyPanels(
  model: ComicPageModel,
  options: z.input<typeof auditSchema>,
): EmptyPanel[] {
  const o = auditSchema.parse(options);
  const canvas = new ComicCanvas(model.page.width, model.page.height);
  const found: EmptyPanel[] = [];
  model.panels.forEach((panel, index) => {
    let start: number | undefined;
    const close = (t: number) => {
      if (start !== undefined && t - start > o.longest)
        found.push({ panel: index + 1, from: start, to: t });
      start = undefined;
    };
    for (let t = 0; t <= o.until + 1e-9; t += o.step) {
      const empty = panel.visible(t) && panelShare(canvas, model, panel, t) < o.minContent;
      if (empty && start === undefined) start = t;
      if (!empty) close(t);
    }
    close(o.until);
  });
  return found;
}
