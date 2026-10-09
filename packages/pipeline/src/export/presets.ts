/**
 * Export presets: the output size is always an integer `neighbor` upscale of the render size
 * (PLAN D3), so pixel-art blocks stay crisp. Output fps is the manifest fps (no resampling).
 * Presets are declared landscape; a portrait render (taller than wide, PLAN.md#13.18) gets the
 * same preset turned upright (1080p = 1080x1920).
 */
import type { ExportError } from './errors.js';
import { err, ok, type Result } from '../result.js';

export const EXPORT_PRESET_IDS = ['1080p30', '1440p', '4k'] as const;
export type ExportPresetId = (typeof EXPORT_PRESET_IDS)[number];

export const DEFAULT_EXPORT_PRESET: ExportPresetId = '1080p30';

export interface ExportPreset {
  readonly id: ExportPresetId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const EXPORT_PRESETS: Readonly<Record<ExportPresetId, ExportPreset>> = {
  '1080p30': { id: '1080p30', label: '1080p (Full HD)', width: 1920, height: 1080 },
  '1440p': { id: '1440p', label: '1440p (QHD)', width: 2560, height: 1440 },
  '4k': { id: '4k', label: '4K (UHD)', width: 3840, height: 2160 },
};

export function isExportPresetId(value: string): value is ExportPresetId {
  return (EXPORT_PRESET_IDS as readonly string[]).includes(value);
}

export interface OutputScale {
  readonly preset: ExportPreset;
  /** Integer upscale factor applied with `flags=neighbor`. */
  readonly factor: number;
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly outputWidth: number;
  readonly outputHeight: number;
}

/** The preset in the orientation of a `renderWidth`x`renderHeight` render. */
export function orientedPreset(
  presetId: ExportPresetId,
  renderWidth: number,
  renderHeight: number,
): ExportPreset {
  const preset = EXPORT_PRESETS[presetId];
  if (renderHeight <= renderWidth) return preset;
  return { ...preset, width: preset.height, height: preset.width };
}

/** Lists the presets that are an exact integer multiple of the render size. */
function suggestPresets(width: number, height: number): string {
  const fits = EXPORT_PRESET_IDS.filter((id) => {
    const preset = orientedPreset(id, width, height);
    return preset.width % width === 0 && preset.width / width === preset.height / height;
  });
  return fits.length === 0
    ? 'no preset fits this render size'
    : `presets that fit: ${fits.join(', ')}`;
}

/**
 * Resolves the integer factor that maps the render size onto the preset; fails with a readable
 * message when the preset is not an exact integer multiple (e.g. 480x270 -> 1440p would be 5.33x).
 */
export function resolveOutputScale(
  presetId: ExportPresetId,
  renderWidth: number,
  renderHeight: number,
): Result<OutputScale, ExportError> {
  if (
    !Number.isInteger(renderWidth) ||
    !Number.isInteger(renderHeight) ||
    renderWidth <= 0 ||
    renderHeight <= 0
  ) {
    return err({
      kind: 'invalid-input',
      message: `render size must be positive integers, got ${String(renderWidth)}x${String(renderHeight)}`,
    });
  }
  const preset = orientedPreset(presetId, renderWidth, renderHeight);
  const factorX = preset.width / renderWidth;
  const factorY = preset.height / renderHeight;
  if (!Number.isInteger(factorX) || factorX !== factorY) {
    const ratio = (preset.width / renderWidth).toFixed(2);
    return err({
      kind: 'preset-mismatch',
      message:
        `${preset.label} (${String(preset.width)}x${String(preset.height)}) is not an integer ` +
        `multiple of the ${String(renderWidth)}x${String(renderHeight)} render size ` +
        `(x${ratio}); pixel-art upscaling needs a whole factor - ${suggestPresets(renderWidth, renderHeight)}`,
    });
  }
  return ok({
    preset,
    factor: factorX,
    renderWidth,
    renderHeight,
    outputWidth: preset.width,
    outputHeight: preset.height,
  });
}
