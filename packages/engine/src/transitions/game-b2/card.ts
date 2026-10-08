/**
 * `game-b2-level-card`: a woodgrain HUD plate (the same veneer as the HUD) sweeps in from the left
 * with a chamfered black edge and a lit lip, covers the frame with a black ribbed band across it
 * (the slot the next place's name is typed into by the incoming shot's compass), holds a beat and
 * sweeps on to the right, uncovering the incoming frame. Palette-pure: A or B pixels, HUD tones.
 */
import type { Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { b2Tones, woodAt } from './tones.js';

function inOut(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
}

export const levelCard: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones } = c;
  const ink = b2Tones(tones);
  const s = W / 640;
  const lean = 0.12;
  const reach = W * (1 + lean);
  const lead = inOut(phase(p, 0, 0.42)) * reach;
  const tail = inOut(phase(p, 0.58, 1)) * reach;
  const bandTop = Math.round(H * 0.42);
  const bandBottom = Math.round(H * 0.58);
  for (let y = 0; y < H; y += 1) {
    const slant = (H - y) * lean;
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const u = x + slant;
      if (u >= lead) {
        out[i] = a[i] ?? 0;
        continue;
      }
      if (u < tail) {
        out[i] = b[i] ?? 0;
        continue;
      }
      const fromLead = lead - u;
      const fromTail = u - tail;
      if (fromLead < 2 * s || fromTail < 2 * s) out[i] = ink.VOID;
      else if (fromLead < 3 * s) out[i] = ink.TAN;
      else if (y >= bandTop && y < bandBottom)
        out[i] = (y - bandTop) % Math.max(2, Math.round(3 * s)) === 0 ? ink.SHADOW : ink.VOID;
      else out[i] = woodAt(x, y, s, ink);
    }
  }
};
