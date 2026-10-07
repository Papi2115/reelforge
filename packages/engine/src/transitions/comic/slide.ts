/**
 * Page slides of the Comic world (docs/worlds/comic-panels-v2 transitions.js `slide`): the held
 * outgoing page slides off and the incoming one follows it in, a strip of the table between the
 * two pages (a fold shadow dithered from shade to aged paper, darker toward the incoming page, an
 * ink line on the outgoing page's edge). `comic-page-slide` runs sideways (A leaves to the left,
 * reading on); `comic-page-scroll` runs down the page (A rises, B comes up from below: going
 * deeper). Every pixel is a pixel of A or B or a comic ink.
 */
import type { Composition, Compositor } from '../pixels.js';
import { endFrames } from '../wow.js';
import { bayer4, comicInks, inOutCubic, inOutSine } from './inks.js';

function slide(
  c: Composition,
  vertical: boolean,
  gutter: number,
  ease: (q: number) => number,
): void {
  const { width: W, height: H, a, b, out, p } = c;
  const { INK, AGED, SHADE } = comicInks(c.tones).ink;
  const s = W / 640;
  const length = vertical ? H : W;
  const gap = Math.max(2, Math.round(gutter * s));
  const edge = Math.max(1, Math.round(s));
  const offset = Math.round(ease(p) * (length + gap));
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const along = (vertical ? y : x) + offset;
      const i = y * W + x;
      if (along < length) {
        out[i] = (vertical ? a[along * W + x] : a[y * W + along]) ?? 0;
      } else if (along < length + gap) {
        const k = (along - length) / gap;
        out[i] = along < length + edge ? INK : bayer4(x, y) < 0.25 + k * 0.6 ? AGED : SHADE;
      } else {
        const q = along - length - gap;
        out[i] = (vertical ? b[q * W + x] : b[y * W + q]) ?? 0;
      }
    }
  }
}

export const pageSlide: Compositor = (c) => {
  if (endFrames(c)) return;
  slide(c, false, 16, inOutCubic);
};

export const pageScroll: Compositor = (c) => {
  if (endFrames(c)) return;
  slide(c, true, 22, inOutSine);
};
