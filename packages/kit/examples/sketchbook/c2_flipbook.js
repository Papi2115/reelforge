// Sketchbook look C (sketch-loud), template 2: "flipbook: 1,257 years" (showcase sketchbook-v2
// shot 6). A thumb riffles the page corner: the same doodle redrawn on every page, the year flicks
// 325 -> 1582 in huge marker while the sun slides from 21 March to 11 March. The pencil ring stays
// on 21.
// Focal: the huge year (top right), then the sun that has left the ring.
// Traces: every page redrawn by hand (the doodle boils from page to page), a crooked year on each
// page, a pencil ring that never closes, the thumb pressing at each flip, slow-fast-slow riffle.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc2',
  title: 'Sketch loud: flipbook',
  treatment: 'montage/transition',
};

const PAGES = 22;
const [FIRST, LAST] = [325, 1582];
/** Days the equinox drifts per year in the Julian calendar (11 min a year). */
const DRIFT = 0.00781;

const yearOf = (k) => Math.round(FIRST + (k * (LAST - FIRST)) / (PAGES - 1));
const dayOf = (k) => Math.round(21 - (yearOf(k) - FIRST) * DRIFT);
const cellX = (day) => 128 + (day - 10) * 52;

function calendarStrip(sheet, seed, rng) {
  sheet.write('MARCH', { x: 130, y: 404, size: 30, hand: 'print', seed: seed + 1, rot: -1 });
  for (let day = 10; day <= 22; day += 1) {
    const x = cellX(day);
    sheet.stroke([x, 300 + rng() * 2 - 1, x + rng() * 2 - 1, 352], {
      tool: 'fine',
      smooth: false,
      seed: seed + day * 3,
    });
    sheet.write(String(day), {
      x: x + 12,
      y: 334,
      size: 17,
      hand: 'print',
      tool: 'fine',
      width: 2,
      seed: seed + day * 5,
    });
  }
  sheet.stroke([cellX(10), 300, cellX(23), 299], { tool: 'fine', seed: seed + 2 });
  sheet.stroke([cellX(10), 352, cellX(23), 353], { tool: 'fine', seed: seed + 3 });
  sheet.stroke([cellX(23), 299, cellX(23) + 1, 353], { tool: 'fine', seed: seed + 4 });
}

function flipPage(sheet, k, rng) {
  const seed = 5000 + k * 97;
  calendarStrip(sheet, seed, rng);
  // Where the equinox should be: a pencil ring round 21, the same on every page.
  sheet.loop(cellX(21) + 26, 327, 30, 24, {
    tool: 'pencil',
    width: 2,
    start: -2.2,
    seed: seed + 6,
  });
  // Where it actually falls: the sun.
  const x = cellX(dayOf(k)) + 26;
  sheet.sun(x, 242, 22, { rays: 8, rayScale: 0.7, seed: seed + 7 });
  sheet.stroke([x, 274, x + 1, 294], { tool: 'pencil', seed: seed + 8 });
  sheet.write('spring equinox', {
    x: x - 64,
    y: 196,
    size: 17,
    hand: 'scrawl',
    tool: 'fine',
    width: 1,
    seed: seed + 9,
    rot: -3,
  });
  // The year: the flipbook's loud page number.
  sheet.write(String(yearOf(k)), {
    x: k === 0 ? 620 : 560,
    y: 150,
    size: 108,
    hand: 'marker',
    tool: 'marker',
    nib: [14, -40, 5],
    seed: seed + 10,
    rot: -4 + rng() * 7,
  });
  if (k === 0) {
    sheet.write('AD', {
      x: 548,
      y: 150,
      size: 36,
      hand: 'marker',
      tool: 'marker',
      nib: [6, -40, 3],
      seed: seed + 12,
    });
  }
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    pen: false,
    seed: 110,
  });
  ctx.scene.add(page);
  const book = page.flipbook({ count: PAGES, at: 0.32, until: 4.55, seed: 5000 });
  for (let k = 0; k < PAGES; k += 1) flipPage(book.page(k), k, ctx.rng);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
