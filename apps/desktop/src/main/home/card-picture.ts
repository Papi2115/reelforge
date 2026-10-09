/**
 * The Home card picture (PLAN.md#13.16): a project's thumbnail scaled down to a small JPEG data URL
 * with Electron's nativeImage (a 1280×720 PNG becomes a few KB), so the renderer needs no file
 * access. The library caches it by file and modification time.
 */
import { nativeImage } from 'electron';
import type { PictureInfo } from './overview-service.js';

/** Card pictures are shown at most ~300 px wide; a bit more keeps them sharp on 125 % scaling. */
export const CARD_PICTURE_WIDTH = 384;
const JPEG_QUALITY = 82;

/** The overview shows the thumbnail up to ~640 px wide. */
export const OVERVIEW_PICTURE_WIDTH = 960;

/** The overview's thumbnail: a scaled JPEG data URL and the file's own size; null = no picture. */
export function overviewPicture(file: string): Promise<PictureInfo | null> {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return Promise.resolve(null);
  const { width, height } = image.getSize();
  const scaled =
    width <= OVERVIEW_PICTURE_WIDTH
      ? image
      : image.resize({ width: OVERVIEW_PICTURE_WIDTH, quality: 'good' });
  return Promise.resolve({
    dataUrl: `data:image/jpeg;base64,${scaled.toJPEG(JPEG_QUALITY).toString('base64')}`,
    width,
    height,
  });
}

export function cardPicture(file: string): Promise<string | null> {
  const image = nativeImage.createFromPath(file);
  if (image.isEmpty()) return Promise.resolve(null);
  const { width } = image.getSize();
  const scaled =
    width <= CARD_PICTURE_WIDTH
      ? image
      : image.resize({ width: CARD_PICTURE_WIDTH, quality: 'good' });
  return Promise.resolve(
    `data:image/jpeg;base64,${scaled.toJPEG(JPEG_QUALITY).toString('base64')}`,
  );
}
