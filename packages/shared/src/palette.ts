/** Named colour palettes shared by render manifests and style presets. */
import { z } from 'zod';

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');

/** Max palette size (also the max quantization set of the post pass). */
export const MAX_PALETTE_SIZE = 32;

/** Named palette, e.g. `{ teal: '#2ec4b6', ... }`. Scenes read colours by name. */
export const paletteSchema = z
  .record(z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'palette names are camelCase'), hexColorSchema)
  .refine(
    (palette) => {
      const size = Object.keys(palette).length;
      return size >= 2 && size <= MAX_PALETTE_SIZE;
    },
    `palette must have 2..${String(MAX_PALETTE_SIZE)} colours`,
  );
export type NamedPalette = z.infer<typeof paletteSchema>;
