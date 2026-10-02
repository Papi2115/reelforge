/**
 * Frame snapshots (PLAN.md#6.4): the preview canvas holds the engine frame 1:1, so a native
 * snapshot is a lossless copy of it; the 1080p variant is a nearest-neighbour upscale (3x for the
 * 640x360 styles), like the pixel-art export.
 */
export type SnapshotScale = 'native' | 'hd';

export const SNAPSHOT_SCALES: readonly { readonly value: SnapshotScale; readonly label: string }[] =
  [
    { value: 'native', label: 'Native' },
    { value: 'hd', label: '1080p' },
  ];

const HD = { width: 1920, height: 1080 } as const;
const SHOT_ID = /^[A-Za-z0-9_-]{1,32}$/;

/** Shot ids that may appear in snapshot file names (others are left out). */
export function snapshotShotId(shotId: string | undefined): string | undefined {
  return shotId !== undefined && SHOT_ID.test(shotId) ? shotId : undefined;
}

export async function encodeSnapshot(
  source: HTMLCanvasElement,
  scale: SnapshotScale,
): Promise<Uint8Array> {
  const size = scale === 'native' ? { width: source.width, height: source.height } : HD;
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas context unavailable for the snapshot');
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, size.width, size.height);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}
