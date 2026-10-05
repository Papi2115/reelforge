/**
 * Enter-through transitions (ADR-028, family `enter`): the camera enters the next shot through a
 * shape on the subject point (`focus`): a magnifying lens, binoculars, a window, a keyhole. The
 * outgoing shot zooms (nearest neighbour) around the focus outside the shape, the incoming shot
 * shows inside it and settles to 1x as the shape grows past the screen. Pure functions of (A, B,
 * p, seed, focus); every pixel is a copy of A or B or a palette colour.
 */
import { bayerThreshold, type Composition, type Compositor } from './pixels.js';
import {
  dither,
  easeIn,
  endFrames,
  focusPixels,
  lerp,
  mosaic,
  phase,
  popOut,
  scaleLerp,
  shade,
  smoothstep,
  zoomSample,
  type ZoomView,
} from './wow.js';

/** Shape "radius" of a point in shape units (<= 1 inside the opening). */
type Shape = (u: number, v: number) => number;

const lensShape: Shape = (u, v) => Math.sqrt(u * u + v * v);

const BINOCULAR_OFFSET = 0.62;
const binocularShape: Shape = (u, v) => {
  const left = (u + BINOCULAR_OFFSET) ** 2 + v * v;
  const right = (u - BINOCULAR_OFFSET) ** 2 + v * v;
  return Math.sqrt(Math.min(left, right));
};

const windowShape =
  (aspect: number): Shape =>
  (u, v) =>
    Math.max(Math.abs(u) / aspect, Math.abs(v));

const keyholeShape: Shape = (u, v) => {
  const circle = Math.sqrt(u * u + (v + 0.38) ** 2) / 0.5;
  const halfWidth = 0.18 + 0.24 * Math.min(1, Math.max(0, (v + 0.2) / 1.05));
  const slot = Math.max(Math.abs(u) / halfWidth, Math.abs(v - 0.3) / 0.55);
  return Math.min(circle, slot);
};

const COVER_STEP = 16;

/** Smallest shape size (px) centred at (cx, cy) whose opening covers the whole frame. */
function coverSize(shape: Shape, cx: number, cy: number, width: number, height: number): number {
  const covers = (size: number): boolean => {
    for (let y = 0; y <= height; y += height / Math.ceil(height / COVER_STEP)) {
      for (let x = 0; x <= width; x += width / Math.ceil(width / COVER_STEP)) {
        if (shape((x - cx) / size, (y - cy) / size) > 1) return false;
      }
    }
    return true;
  };
  let low = 1;
  let high = 64 * (width + height);
  for (let step = 0; step < 28; step += 1) {
    const middle = (low + high) / 2;
    if (covers(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/** Where the shape is on screen this frame and what fills it. */
interface Portal {
  readonly shape: Shape;
  /** Shape unit in pixels. */
  readonly size: number;
  readonly cx: number;
  readonly cy: number;
  readonly inside: (x: number, y: number, u: number, v: number, d: number) => number;
  /** Outside the opening (rims, handles, doors are drawn here from u, v, d). */
  readonly outside: (x: number, y: number, u: number, v: number, d: number) => number;
}

/** Draws a portal; the shape is evaluated per 2x2 cell (crisp, stair-stepped pixel edges). */
function drawPortal({ width, height, out }: Composition, portal: Portal): void {
  const { shape, size, cx, cy } = portal;
  for (let y = 0; y < height; y += 1) {
    const v = ((y & ~1) + 1 - cy) / size;
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const u = ((x & ~1) + 1 - cx) / size;
      const d = shape(u, v);
      out[row + x] = d <= 1 ? portal.inside(x, y, u, v, d) : portal.outside(x, y, u, v, d);
    }
  }
}

/** Zoom of the outgoing shot around the focus, the focus drawn at (cx, cy). */
function outgoingView(fx: number, fy: number, cx: number, cy: number, zoom: number): ZoomView {
  return { fx, fy, cx, cy, zoom: Math.max(1, zoom) };
}

const LENS_SIZE = 0.17;

/**
 * Magnifying lens: pops in on the subject showing it magnified, the subject resolves into the new
 * shot inside the lens, then the lens rushes at the camera until the new shot fills the screen.
 */
export const enterLens: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, p, tones } = c;
  const [fx, fy] = focusPixels(c);
  const rest = LENS_SIZE * height;
  const grow = phase(p, 0.44, 1);
  const drift = smoothstep(phase(p, 0.3, 1));
  const cx = lerp(fx, width / 2, drift);
  const cy = lerp(fy, height / 2, drift);
  const settled = rest * (1 + 0.15 * phase(p, 0.16, 0.44));
  const size =
    grow > 0
      ? scaleLerp(
          settled,
          coverSize(lensShape, width / 2, height / 2, width, height) * 1.25,
          easeIn(grow),
        )
      : rest * popOut(phase(p, 0, 0.16)) * (1 + 0.15 * phase(p, 0.16, 0.44));
  if (size < 1) {
    c.out.set(a);
    return;
  }
  const outside = outgoingView(fx, fy, cx, cy, size / settled);
  const magnified = outgoingView(
    fx,
    fy,
    cx,
    cy,
    (size / settled) * (1.8 + 0.9 * phase(p, 0.16, 0.44)),
  );
  const incoming = outgoingView(cx, cy, cx, cy, 1 + 0.7 * (1 - smoothstep(phase(p, 0.36, 1))));
  const swap = phase(p, 0.36, 0.5);
  const dim = 0.35 * phase(p, 0.04, 0.3) * (1 - grow);
  const metal = tones.nearest(0x8a93a6);
  const metalDark = tones.nearest(0x5c6479);
  const wood = tones.nearest(0x7d321c);
  const woodLight = tones.nearest(0xc75a24);
  const rim = 0.12;
  drawPortal(c, {
    shape: lensShape,
    size,
    cx,
    cy,
    inside: (x, y, u, v, d) => {
      const fromB = bayerThreshold(x >> 1, y >> 1) < swap;
      const pixel = fromB
        ? zoomSample(b, width, height, x, y, incoming)
        : zoomSample(a, width, height, x, y, magnified);
      const glint = swap < 1 && d > 0.66 && d < 0.78 && u < -0.18 && v < -0.18;
      return glint && Math.abs(u - v) < 0.3 ? tones.brightest : pixel;
    },
    outside: (x, y, u, v, d) => {
      if (d <= 1 + rim) {
        const t = (d - 1) / rim;
        if (t > 0.72) return tones.darkest;
        if (t < 0.3 && u + v < -0.5) return tones.brightest;
        return u + v < 0 ? metal : metalDark;
      }
      const along = (u + v) * Math.SQRT1_2;
      const across = (v - u) * Math.SQRT1_2;
      if (along > 1.05 && along < 2.15 && Math.abs(across) < 0.17) {
        if (Math.abs(across) > 0.12 || along > 2.08) return tones.darkest;
        return across < -0.05 ? woodLight : wood;
      }
      return shade(zoomSample(a, width, height, x, y, outside), tones.darkest, dim, x, y);
    },
  });
};

const BINOCULAR_SIZE = 0.44;
const FOCUS_BLOCKS = [8, 6, 4, 3, 2, 1] as const;

/**
 * Binoculars: the eyepiece mask closes in on the subject, the view zooms and loses focus, the
 * new shot comes into focus inside, then the mask opens on the new shot.
 */
export const enterBinoculars: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, p, tones } = c;
  const [fx, fy] = focusPixels(c);
  const view = BINOCULAR_SIZE * height;
  const close = smoothstep(phase(p, 0, 0.34));
  const open = phase(p, 0.64, 1);
  const cx = lerp(fx, width / 2, close);
  const cy = lerp(fy, height / 2, close);
  const size =
    open > 0
      ? scaleLerp(view, coverSize(binocularShape, cx, cy, width, height) * 1.12, easeIn(open))
      : scaleLerp(coverSize(binocularShape, fx, fy, width, height) * 1.12, view, close);
  const outgoing = outgoingView(fx, fy, cx, cy, 1 + 1.3 * smoothstep(phase(p, 0, 0.44)));
  const incoming = outgoingView(cx, cy, cx, cy, 1 + 0.5 * (1 - smoothstep(phase(p, 0.44, 1))));
  const switched = p >= 0.44;
  const blur = switched
    ? (FOCUS_BLOCKS[Math.min(FOCUS_BLOCKS.length - 1, Math.floor(phase(p, 0.44, 0.66) * 6))] ?? 1)
    : 1 + Math.round(7 * phase(p, 0.3, 0.44));
  const rimColour = tones.nearest(0x3c4256);
  const glass = tones.nearest(0x2ec4b6);
  const rim = 6 / size;
  drawPortal(c, {
    shape: binocularShape,
    size,
    cx,
    cy,
    inside: (x, y, u, v, d) => {
      const sx = Math.min(width - 1, mosaic(x, blur));
      const sy = Math.min(height - 1, mosaic(y, blur));
      const pixel = switched
        ? zoomSample(b, width, height, sx, sy, incoming)
        : zoomSample(a, width, height, sx, sy, outgoing);
      const local = u < 0 ? u + BINOCULAR_OFFSET : u - BINOCULAR_OFFSET;
      const glint = d > 0.74 && d < 0.82 && v < -0.25 && local < -0.25;
      if (glint && open < 0.3 && (x & 2) === 0) return glass;
      return shade(pixel, tones.darkest, (d - 0.88) * 4, x, y);
    },
    outside: (_x, _y, _u, _v, d) => (d <= 1 + rim ? rimColour : tones.darkest),
  });
};

const WINDOW_SIZE = 0.075;
const MULLION = 0.2;
const FRAME = 0.28;
const SILL = 0.24;

/** The parts of a 2x2-pane window around the pane the camera flies through. */
interface WindowGrid {
  readonly aspect: number;
  /** +1: the other column / row lies right / below the target pane, -1: left / above. */
  readonly sx: number;
  readonly sy: number;
}

type WindowPart = 'pane' | 'frame' | 'outline' | 'sill' | 'sill-shade' | 'none';

/** What of the window is at (u, v) (target pane units, outside the target pane). */
function windowPart({ aspect, sx, sy }: WindowGrid, u: number, v: number): WindowPart {
  const gu = u * sx;
  const gv = v * sy;
  const right = 3 * aspect + MULLION;
  const bottom = 3 + MULLION;
  const left = -aspect;
  if (gu >= left - FRAME && gu <= right + FRAME && gv >= -1 - FRAME && gv <= bottom + FRAME) {
    const edge = Math.min(
      gu - left + FRAME,
      right + FRAME - gu,
      gv + 1 + FRAME,
      bottom + FRAME - gv,
    );
    if (edge < 0.06) return 'outline';
    const column = Math.abs(gu) <= aspect || (gu >= aspect + MULLION && gu <= right);
    const row = Math.abs(gv) <= 1 || (gv >= 1 + MULLION && gv <= bottom);
    if (column && row) return 'pane';
    const paneEdge = Math.min(
      Math.abs(Math.abs(gu) - aspect),
      Math.abs(gu - aspect - MULLION),
      Math.abs(gu - right),
      Math.abs(Math.abs(gv) - 1),
      Math.abs(gv - 1 - MULLION),
      Math.abs(gv - bottom),
    );
    return paneEdge < 0.04 ? 'outline' : 'frame';
  }
  // The sill under the window, on screen (v grows downwards whatever the grid's direction).
  const sillTop = sy > 0 ? bottom + FRAME : 1 + FRAME;
  const sillLeft = (sx > 0 ? left - FRAME : -(right + FRAME)) - 0.12;
  const sillRight = (sx > 0 ? right + FRAME : aspect + FRAME) + 0.12;
  if (v > sillTop && v <= sillTop + SILL && u >= sillLeft && u <= sillRight) {
    const t = (v - sillTop) / SILL;
    if (t > 0.78 || u - sillLeft < 0.06 || sillRight - u < 0.06) return 'outline';
    return t < 0.4 ? 'sill' : 'sill-shade';
  }
  return 'none';
}

/**
 * Window: a four-pane window pops onto the subject with the new shot behind its glass, then the
 * camera flies through the pane on the subject (the outgoing shot zooms around the window) until
 * the new shot fills the screen.
 */
export const enterWindow: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, p, tones } = c;
  const [fx, fy] = focusPixels(c);
  const aspect = width / height;
  const grid: WindowGrid = { aspect, sx: fx > width / 2 ? -1 : 1, sy: fy > height / 2 ? -1 : 1 };
  const rest = WINDOW_SIZE * height;
  const grow = phase(p, 0.22, 1);
  const drift = smoothstep(phase(p, 0.12, 1));
  const cx = lerp(fx, width / 2, drift);
  const cy = lerp(fy, height / 2, drift);
  const size =
    grow > 0
      ? scaleLerp(rest, (height / 2) * 1.04, easeIn(grow))
      : rest * popOut(phase(p, 0, 0.22));
  if (size < 1) {
    c.out.set(a);
    return;
  }
  const outside = outgoingView(fx, fy, cx, cy, size / rest);
  const incoming = outgoingView(cx, cy, cx, cy, 1 + 0.8 * (1 - smoothstep(p)));
  const paint = tones.nearest(0xf4e9d8);
  const paintShade = tones.nearest(0xc49a7a);
  const reflection = 1 - phase(p, 0.35, 0.7);
  const glass = (x: number, y: number, u: number, v: number): number => {
    const pixel = zoomSample(b, width, height, x, y, incoming);
    const streak = (((u / aspect - v) % 1.2) + 1.2) % 1.2;
    const glare = reflection > 0 && streak > 0.15 && streak < 0.15 + 0.14 * reflection;
    return glare ? shade(pixel, tones.brightest, 0.5, x, y) : pixel;
  };
  drawPortal(c, {
    shape: windowShape(aspect),
    size,
    cx,
    cy,
    inside: glass,
    outside: (x, y, u, v) => {
      const part = windowPart(grid, u, v);
      if (part === 'pane') return glass(x, y, u, v);
      if (part === 'outline') return tones.darkest;
      if (part === 'frame' || part === 'sill') return paint;
      if (part === 'sill-shade') return paintShade;
      return zoomSample(a, width, height, x, y, outside);
    },
  });
};

const KEYHOLE_SIZE = 0.3;
const PLATE_W = 0.78;
const PLATE_H = 1.25;
const PLATE_R = 0.45;

/**
 * Keyhole: a dark door with a brass keyhole plate closes in around the subject, the new shot
 * appears through the keyhole, then the camera pushes through it.
 */
export const enterKeyhole: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, p, tones } = c;
  const [fx, fy] = focusPixels(c);
  const view = KEYHOLE_SIZE * height;
  const close = smoothstep(phase(p, 0, 0.36));
  const open = phase(p, 0.58, 1);
  const cx = lerp(fx, width / 2, close);
  const cy = lerp(fy, height / 2, close);
  const size =
    open > 0
      ? scaleLerp(view, coverSize(keyholeShape, cx, cy, width, height) * 1.3, easeIn(open))
      : scaleLerp(coverSize(keyholeShape, fx, fy, width, height) * 1.3, view, close);
  const outgoing = outgoingView(fx, fy, cx, cy, 1 + 0.6 * close);
  const incoming = outgoingView(cx, cy, cx, cy, 1 + 0.6 * (1 - smoothstep(phase(p, 0.38, 1))));
  const swap = phase(p, 0.38, 0.5);
  const door = tones.nearest(0x1a1446);
  const doorLine = tones.nearest(0x2d1b69);
  const brass = tones.nearest(0xc49a7a);
  const brassLight = tones.nearest(0xffb26b);
  const brassDark = tones.nearest(0x7d321c);
  drawPortal(c, {
    shape: keyholeShape,
    size,
    cx,
    cy,
    inside: (x, y) =>
      dither(
        zoomSample(a, width, height, x, y, outgoing),
        zoomSample(b, width, height, x, y, incoming),
        swap,
        x,
        y,
      ),
    outside: (_x, _y, u, v, d) => {
      if (d <= 1 + 3 / size) return tones.darkest;
      const ax = Math.abs(u) - (PLATE_W - PLATE_R);
      const ay = Math.abs(v + 0.05) - (PLATE_H - PLATE_R);
      const plate = (ax > 0 && ay > 0 ? Math.sqrt(ax * ax + ay * ay) : Math.max(ax, ay)) - PLATE_R;
      if (plate <= 0) {
        const screw = Math.min(u * u + (v + 0.98) ** 2, u * u + (v - 0.88) ** 2) * 900;
        if (plate > -0.05 || screw < 1.4) return tones.darkest;
        if (screw < 3) return brassDark;
        if (plate > -0.12) return u + v < 0 ? brassLight : brassDark;
        return brass;
      }
      const grain = (((u + 40) * 1.6) % 1) * size;
      return grain < 2 ? doorLine : door;
    },
  });
};
