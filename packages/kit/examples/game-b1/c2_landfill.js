// Game B1 look C (atari-boss), template: boss 3, the landfill (showcase game-hud-b1-boss-v2
// shot 9). Alamogordo, New Mexico: a cross-section, a dark level under the desert. The truck
// tips cartridges into a ragged, hand-dug trench; the camera follows them down to the pile at the
// bottom; dirt fills in over them; THE LANDFILL drops in from the top; Dad's note names its weak
// point (IT KEEPS EVERYTHING). The lights go out row by row and only the card stays lit.
// Focal: the pile at the bottom of the trench, then the boss card.
// Traces: uneven releases with flicker in the shaft; the scroll eases in and ends on a hold;
// dirt fills in blocks of uneven colour and per-column height; one cartridge stuck on a ledge;
// the sign on one leaning post; a three-line note at a tilt; the lights going out line by line.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-c2',
  title: 'Atari boss: the landfill',
  treatment: 'character-scene',
};

const STRIPES = ['orange', 'teal', 'avocado', 'mauve', 'orange', 'gold'];
const DROPS = [1.05, 1.32, 1.5, 1.86, 2.02, 2.4, 2.58, 2.71, 3.1, 3.33, 3.62, 3.8, 4.05];
const SHAFT = 112;

function half(g, y) {
  const { hash } = g.util;
  if (y < 150)
    return 6 + Math.floor((y - 41) / 10) * 2 + (hash(85, Math.floor(y / 4), 1) > 0.7 ? 1 : 0);
  return Math.min(36, 25 + (y - 150) * 1.2) + (hash(85, Math.floor(y / 4), 2) > 0.6 ? 1 : 0);
}

function fall(d) {
  return 0.75 + (d % 0.3);
}

function trench(g, t) {
  const { hash, seg } = g.util;
  for (let y = 41; y < 214; y += 2) {
    const hw = half(g, y);
    g.rect(SHAFT - hw - Math.floor((y - 41) / 30), y, hw * 2, 2, 'void');
  }
  const landed = DROPS.filter((d) => t >= d + fall(d)).length;
  for (let i = 0; i < 26; i += 1) {
    const row = Math.floor(i / 9);
    if (Math.floor(i / 2) > landed) continue;
    const x = SHAFT - 36 + (i % 9) * 7 + (row % 2) * 3 + Math.round((hash(83, i, 1) - 0.5) * 2);
    g.cart(x, 205 - row * 7, STRIPES[i % 6], { label: 'tan', playfield: true });
  }
  const air = DROPS.filter((d) => t >= d && t < d + fall(d)).length;
  DROPS.forEach((d, i) => {
    if (t < d || t >= d + fall(d)) return;
    if (air > 2 && (g.frame + i) % 2 === 0) return; // the 2600 cannot draw them all on one line
    const k = (t - d) / fall(d);
    const x = SHAFT - 4 + Math.round(Math.sin(i * 2.1) * 4);
    g.cart(x, Math.round(34 + k * k * 162), STRIPES[i % 6], {
      tumble: true,
      phase: i,
      playfield: true,
    });
  });
  const fill = seg(t, 6.2, 8.2);
  if (fill > 0)
    for (let c = 0; c < 20; c += 1) {
      const x = SHAFT - 40 + c * 4;
      const top = 212 - Math.max(0, fill * 172 - hash(84, c, 1) * 30);
      for (let y = 212; y > top; y -= 2) {
        const hw = half(g, y);
        const lean = Math.floor((y - 41) / 30);
        if (x + 4 <= SHAFT - hw - lean || x >= SHAFT + hw - lean) continue;
        const v = hash(86, c, y);
        g.rect(x, y - 2, 4, 2, v > 0.8 ? 'teak' : v > 0.25 ? 'walnut' : 'walnutDark');
      }
    }
  // one cartridge bounced and stuck on a ledge halfway down (it never made the pile)
  g.rect(SHAFT - half(g, 96) - 2, 99, 6, 1, 'walnut');
  g.cart(SHAFT - half(g, 96) - 1, 92, STRIPES[3], { label: 'tan', playfield: true });
}

function truck(g, x, tilt, t) {
  g.rect(x, 92, 36, 2, 'greyDark');
  for (const wx of [3, 24, 29]) g.rect(x + wx, 94, 4, 3, 'void');
  g.rect(x, 82, 10, 10, 'orange');
  g.rect(x + 2, 84, 5, 3, 'night');
  for (let i = 0; i < 12; i += 1) {
    const by = Math.round(85 - tilt * (11 - i) * 1.25);
    g.rect(x + 11 + i * 2, by, 2, 6, 'teak');
    g.rect(x + 11 + i * 2, by, 2, 1, 'rust');
  }
  if (Math.floor(t * 6) % 3 !== 0) g.rect(x + 2, 78, 2, 2, 'greyDark');
}

function world(g, t) {
  const { ease, hash, seg, typed } = g.util;
  const oy = -ease.inOut(seg(t, 3.2, 4.65)) * 96 * 2;
  g.offset(0, oy);
  g.bands(0, 160, [[-10, 'void'], [0, 'tube'], [18, 'night'], [30, 'dusk'], [36, 'mauve']], 41); // prettier-ignore
  for (let b = 18; b < 40; b += 1) {
    const h = 2 + Math.floor(Math.abs(Math.sin(b * 1.3)) * 4 + hash(12, b, 1) * 2);
    g.rect(b * 4, 40 - h, 4, h, 'night');
  }
  g.bands(0, 160, [[40, 'teak'], [42, 'walnut'], [64, 'walnutDark'], [68, 'walnut'], [101, 'walnutDark'],
    [107, 'walnut'], [146, 'walnutDark'], [152, 'walnut'], [200, 'walnutDark']], 320); // prettier-ignore
  for (let i = 0; i < 24; i += 1)
    g.rect(Math.floor(hash(81, i, 1) * 80), 46 + Math.floor(hash(81, i, 2) * 200),
      4 + Math.floor(hash(81, i, 3) * 6), 2, i % 3 ? 'greyDark' : 'walnutDark'); // prettier-ignore
  trench(g, t);
  // the place's own sign at the edge, on one leaning post
  g.rect(141, 31, 1, 9, 'teak');
  g.rect(142, 32, 1, 8, 'walnut');
  g.rect(128, 25, 29, 7, 'cream');
  g.rect(128, 31, 29, 1, 'tan');
  g.rect(157, 26, 1, 6, 'tube');
  g.text('LANDFILL', 129.75, 26, { colour: 'walnutDark' });
  g.offset(0, oy - 114);
  truck(g, SHAFT - 36, t < 4.2 ? 1 : 1 - seg(t, 4.2, 4.6), t);
  g.offset(0, 0);
  const place = 'ALAMOGORDO, NM';
  const n = typed(place, t, 1.25, 17, 20);
  if (n > 0 && t < 5.7) g.text(place.slice(0, n), 10, 21, { colour: 'tan' });
  // the lights go out row by row before the next screen (the card is drawn after: it stays lit)
  const dark = seg(t, 8.15, 8.85);
  if (dark > 0) {
    g.remap('dim', undefined, [0, dark * 180]);
    g.remap('dim', undefined, [0, dark * 180]);
    g.remap('dim', undefined, [0, dark * dark * 180]);
  }
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 73,
  });
  screen.tv(world);
  screen.boss({
    num: 3,
    name: 'THE LANDFILL',
    from: 'top',
    x: 40,
    y: 56,
    at: 5.85,
    seed: 73,
    hp: { n: 10, segW: 11 },
  });
  screen.note(['WEAK POINT:', 'IT KEEPS', 'EVERYTHING'], {
    at: 7.15,
    x: 478,
    y: 206,
    w: 176,
    h: 86,
    angle: 0.055,
    seed: 91,
    under: 2,
  });
  screen.year('1983', { at: -1 });
  screen.progress({ from: 0.8, to: 0.9, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
