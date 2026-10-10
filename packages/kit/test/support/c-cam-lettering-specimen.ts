/**
 * Character sheet of the C-CAM ink lettering as an SVG (PLAN.md#14.7): every glyph of both faces
 * and sample titles, labels and stamps of the three films, drawn through the same `drawText` the
 * world will use, with a recording surface that turns each ribbon into a filled outline.
 * Deterministic: the committed `c-cam-lettering-specimen.svg` is compared byte for byte by
 * `c-cam-lettering.test.ts` (regenerate with UPDATE_SPECIMEN=1).
 */
import {
  drawText,
  faceChars,
  posterLayers,
  thudScale,
  type FaceName,
  type InkSurface,
  type Pt,
} from '../../src/worlds/c-cam/lettering/index.js';

const PAPER = '#d9cfae';
const INK = '#16120e';
const MUSTARD = '#b8892c';
const WIDTH = 1600;
const MARGIN = 40;

/** Whole pixels: plenty for a sheet that is looked at, and it keeps the file small. */
const fmt = (value: number): string => String(Math.round(value));

/** Turns ribbons into SVG paths: left edge forward, right edge back (a loop: two rings). */
class SvgSurface implements InkSurface {
  readonly paths: string[] = [];

  ribbon(points: readonly Pt[], widths: readonly number[], fill: string): void {
    const first = points[0];
    const end = points[points.length - 1];
    const closed =
      points.length > 3 &&
      first !== undefined &&
      end !== undefined &&
      first.x === end.x &&
      first.y === end.y;
    const count = closed ? points.length - 1 : points.length;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < count; i += 1) {
      const point = points[i] ?? { x: 0, y: 0 };
      const before = points[closed ? (i - 1 + count) % count : Math.max(0, i - 1)] ?? point;
      const after = points[closed ? (i + 1) % count : Math.min(count - 1, i + 1)] ?? point;
      const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
      const half = (widths[i] ?? 0) / 2;
      const nx = (-(after.y - before.y) / length) * half;
      const ny = ((after.x - before.x) / length) * half;
      left.push({ x: point.x + nx, y: point.y + ny });
      right.push({ x: point.x - nx, y: point.y - ny });
    }
    right.reverse();
    const d = closed ? `${outline(left)}Z${outline(right)}Z` : `${outline([...left, ...right])}Z`;
    this.paths.push(`<path fill="${fill}" d="${d}"/>`);
  }
}

/**
 * An absolute move then relative lines in whole pixels (rounding errors do not accumulate);
 * repeated points are dropped and runs of the same step merged, which keeps the file small.
 */
function outline(points: readonly Pt[]): string {
  const steps: [number, number][] = [];
  const first = points[0] ?? { x: 0, y: 0 };
  let x = Math.round(first.x);
  let y = Math.round(first.y);
  for (const point of points.slice(1)) {
    const dx = Math.round(point.x) - x;
    const dy = Math.round(point.y) - y;
    if (dx === 0 && dy === 0) continue;
    x += dx;
    y += dy;
    const previous = steps[steps.length - 1];
    // Two equal steps in a row are one longer step on the same line.
    if (
      previous &&
      previous[0] * dy === previous[1] * dx &&
      previous[0] * dx + previous[1] * dy > 0
    ) {
      previous[0] += dx;
      previous[1] += dy;
    } else {
      steps.push([dx, dy]);
    }
  }
  const start = `M${fmt(first.x)} ${fmt(first.y)}`;
  return start + steps.map(([dx, dy]) => `l${fmt(dx)} ${fmt(dy)}`).join('');
}

function glyphGrid(surface: SvgSurface, face: FaceName, top: number, size: number): number {
  const cell = size * 1.6;
  const columns = Math.floor((WIDTH - 2 * MARGIN) / cell);
  const chars = Array.from(faceChars(face));
  chars.forEach((char, i) => {
    const x = MARGIN + (i % columns) * cell + size * 0.2;
    const y = top + Math.floor(i / columns) * size * 1.9 + size * 1.2;
    drawText(char, surface, { face, size, x, y, seed: 7 + i, fill: INK });
  });
  return top + Math.ceil(chars.length / columns) * size * 1.9 + size * 0.6;
}

/** The whole sheet as an SVG document. */
export function buildLetteringSpecimenSvg(): string {
  const surface = new SvgSurface();
  const heading = (text: string, y: number): void => {
    drawText(text, surface, { face: 'hand', size: 20, x: MARGIN, y, seed: 1, fill: INK });
  };
  let y = MARGIN + 20;
  heading('C-CAM INK LETTERING - HAND (CC0)', y);
  y = glyphGrid(surface, 'hand', y, 44);
  heading('C-CAM INK LETTERING - POSTER (CC0, lower case = caps)', y);
  y = glyphGrid(surface, 'poster', y, 44);
  heading('SAMPLES', y);
  const title = (text: string, size: number, seed: number, rot: number): void => {
    y += size * 1.7;
    drawText(text, surface, {
      face: 'poster',
      size,
      x: WIDTH / 2,
      y,
      seed,
      rot,
      align: 'center',
      fill: '#cdbf94',
      layers: posterLayers(size),
    });
  };
  title('WOULD YOU SURVIVE', 64, 11, -2);
  title('LANDING ON THE MOON?', 80, 12, 1);
  title('CUM CLAVE', 64, 13, 0);
  const line = (text: string, face: FaceName, size: number, fill: string, seed: number): void => {
    y += size * 1.6;
    drawText(text, surface, { face, size, x: WIDTH / 2, y, seed, align: 'center', rot: -1, fill });
  };
  line('EDO PERIOD · c. 1750      VITERBO · 1268      APOLLO 11 · 1969', 'poster', 30, MUSTARD, 14);
  line('rice loan  interest  new loan  late fee  -  you owe 3% & more!', 'hand', 38, INK, 15);
  line('MASTER ALARM  NO SMOKING  CLACK  1202  00000  +7 -4 ENTR', 'poster', 32, INK, 16);
  // The thud-in on twos: the same word at four times, one step apart.
  y += 110;
  [0, 1, 2, 4].forEach((step, i) => {
    drawText('GO!', surface, {
      face: 'poster',
      size: 56,
      x: 260 + i * 360,
      y,
      seed: 17,
      align: 'center',
      fill: '#cdbf94',
      layers: posterLayers(56),
      charScale: thudScale(step / 12, 0),
    });
  });
  y += 70;
  const height = String(Math.ceil(y));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(WIDTH)}" height="${height}" viewBox="0 0 ${String(WIDTH)} ${height}">`,
    `<rect width="100%" height="100%" fill="${PAPER}"/>`,
    ...surface.paths,
    '</svg>',
    '',
  ].join('\n');
}
