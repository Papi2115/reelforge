/**
 * The Sketchbook page's one writing hand in the engine harness (SwiftShader, 960x540): a scene
 * starts "EMUS" (top left) and "ARMY" (bottom right) almost together, with a figure between
 * them. The hand finishes EMUS, then travels to ARMY around the figure (ARMY waits <= 0.6 s), and
 * clears the page for the shot's last 0.4 s. Checked on the hand sprite (its skin pixels) every
 * 1/30 s across the switch: always exactly one hand, never a jump, never on the figure at the
 * end. Four frames across the switch are goldens (`sketch-hand-queue-t<t>`) and a strip
 * (packages/kit/out/contact/sketch-hand-queue.png).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  encodePng,
  launchHarnessBrowser,
  type HarnessBrowser,
  type RgbaImage,
} from '../../../engine/src/cli/index.js';
import { lintScene } from '../../../engine/src/index.js';
import { composeSheet } from '../support/contact-sheet.js';
import { downscale } from '../support/image.js';
import { KIT_GOLDEN_DIR, KIT_OUT_DIR, sceneManifest } from '../support/scenes.js';
import { expectVibe } from '../support/vibe.js';

const FILE = 'test/render/sketch-hand-queue.js';
const DURATION = 3;
const SOURCE = `// Hand queue check: two words far apart start almost together, a figure between them.
export const meta = { id: 'shq', title: 'Sketchbook: one hand', treatment: 'metaphor-object' };

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    page: 5,
    seed: 205,
    duration: ctx.shot.duration,
  });
  ctx.scene.add(page);
  page.figure({ x: 470, y: 470, h: 230, at: 0.2, until: 1.2, seed: 207 });
  page.write('EMUS', { x: 150, y: 120, size: 44, hand: 'marker', at: 1.5, until: 1.8, seed: 208 });
  page.write('ARMY', { x: 640, y: 400, size: 44, hand: 'marker', at: 1.65, until: 2.05, seed: 209 });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
`;
/** Golden frames across the switch from EMUS to ARMY. */
const STRIP = [1.7, 1.9, 2.1, 2.3] as const;
/** Skin of the hand (palette coffeeLight #dcbf98). */
const SKIN = [0xdc, 0xbf, 0x98] as const;

interface Sprite {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function sprite(data: Buffer, width: number): Sprite | null {
  let [n, sx, sy] = [0, 0, 0];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== SKIN[0] || data[i + 1] !== SKIN[1] || data[i + 2] !== SKIN[2]) continue;
    const [x, y] = [(i / 4) % width, Math.floor(i / 4 / width)];
    [n, sx, sy] = [n + 1, sx + x, sy + y];
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  return n < 40 ? null : { x: sx / n, y: sy / n, w: x1 - x0, h: y1 - y0 };
}

describe('sketchbook page: one writing hand (SwiftShader)', () => {
  let browser: HarnessBrowser;

  beforeAll(async () => {
    browser = await launchHarnessBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('passes the determinism lint', () => {
    expect(lintScene(SOURCE, { filename: path.basename(FILE) })).toEqual([]);
  });

  it('switches from the top word to the bottom one with one hand, no jump; clear at the end', async () => {
    const page = await browser.open({ lint: true });
    try {
      const info = await page.load(
        sceneManifest(FILE, { source: SOURCE, style: 'sketchbook', duration: DURATION }),
      );
      const { width, height } = info;
      const sprites: Sprite[] = [];
      for (let frame = 0; frame <= 24; frame += 1) {
        const t = 1.6 + frame / 30;
        const hand = sprite(await page.frameAt(t), width);
        expect(hand, `t=${t.toFixed(3)}: the hand is on the page`).not.toBeNull();
        if (!hand) continue;
        // One hand-sized sprite: two hands (top and bottom word) would span ~350 px.
        expect(Math.max(hand.w, hand.h), `t=${t.toFixed(3)}: one hand`).toBeLessThan(240);
        const last = sprites.at(-1);
        if (last) {
          const step = Math.hypot(hand.x - last.x, hand.y - last.y);
          expect(step, `t=${t.toFixed(3)}: moved ${step.toFixed(0)} px in 1/30 s`).toBeLessThan(
            120,
          );
        }
        sprites.push(hand);
      }
      const [first, end] = [sprites[0], sprites.at(-1)];
      expect(first && end && end.y - first.y).toBeGreaterThan(200);
      expect(sprite(await page.frameAt(DURATION - 0.05), width)).toBeNull();
      const tiles: RgbaImage[] = [];
      for (const t of STRIP) {
        const frame = { width, height, data: await page.frameAt(t) };
        expectVibe(frame, `t${String(t)}`, 'sketchbook');
        tiles.push(downscale(frame, 2, 'nearest'));
        await compareWithGolden(`sketch-hand-queue-t${String(t)}`, frame, undefined, {
          goldenDir: KIT_GOLDEN_DIR,
        });
      }
      const strip = path.join(KIT_OUT_DIR, 'contact', 'sketch-hand-queue.png');
      await mkdir(path.dirname(strip), { recursive: true });
      await writeFile(strip, encodePng(composeSheet(tiles, STRIP.length)));
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 300_000);
});
