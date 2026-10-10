/**
 * The Grim Ink font report of a frame source (PLAN.md#14.18): which of the prototypes' system
 * fonts the world's text roles find on this machine (kit `inkFontReport`, probed once per realm
 * with `measureText`). The engine frame adds it to the load reply (`fonts`, parsed by
 * `loadInfoSchema`) so the export can key its cache by it and name a fallback in its report.
 * Outside a page (Node): every role falls back.
 */
import { C_CAM_ID, inkFontReport } from '@reelforge/kit';
import { z } from 'zod';
import type { LoadInfo } from './runtime.js';

export const inkFontsSchema = z.object({ fallback: z.boolean(), missing: z.array(z.string()) });
export type InkFonts = z.infer<typeof inkFontsSchema>;

function probeTarget(): CanvasRenderingContext2D | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.createElement('canvas').getContext('2d') ?? undefined;
}

/** The report for a style (`fallback`, `missing` families); undefined but for Grim Ink. */
export function inkFontsOf(styleId: string): InkFonts | undefined {
  if (styleId !== C_CAM_ID) return undefined;
  const { fallback, missing } = inkFontReport(probeTarget());
  return { fallback, missing: [...missing] };
}

/** A load reply with the font report of its style (unchanged for every style but Grim Ink). */
export function withInkFonts(info: LoadInfo): LoadInfo & { readonly fonts?: InkFonts } {
  const fonts = inkFontsOf(info.style);
  return fonts === undefined ? info : { ...info, fonts };
}

/** The font report in a parsed load reply (undefined: not Grim Ink, or an older engine). */
export function loadInfoFonts(info: LoadInfo): InkFonts | undefined {
  const parsed = inkFontsSchema.safeParse(Reflect.get(info, 'fonts'));
  return parsed.success ? parsed.data : undefined;
}
