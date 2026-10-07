/**
 * The automap of a Game B2 shot (showcase shot 4, generalised): the level seen from above, drawn
 * on in pencil order as the plan says, the arrow replaying or following the walk, marks, labels
 * typed beside rooms, a margin note, and the two continuity moves with the HUD minimap: it
 * unfolds out of the minimap (same centre = the player, same heading, 3 px per cell growing to
 * the map's scale) or dithers in from it, and folds back into it (the map frozen at the fold,
 * shrunk in held steps onto the minimap at 3 px per cell, then dithered into the real one). A
 * pure function of t: every frame is composed from scratch.
 */
import { Bmp } from '../core/bitmap.js';
import { bayer, EASES, hash3, lerp, seg } from '../core/rand.js';
import { C } from '../palette.js';
import type { CameraPath } from '../ray/camera.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import {
  arrow,
  cross,
  diamond,
  fillCells,
  handText,
  handTextWidth,
  label,
  legend,
  noteArrow,
  pen,
  pickup,
  type MapFrame,
  type PenStyle,
} from './automap-draw.js';
import { SCREEN_CX, SCREEN_CY, type AutomapPlan, type RoomPlan } from './automap-plan.js';
import { pencilOrder, type PenLine } from './rooms.js';

/** The HUD minimap's inner rect (plate 538,12,86,66 inset by 4) and its 3 px per cell. */
export const MINI = { x: 542, y: 16, w: 78, h: 58, cell: 3 } as const;

/** What the map covers on screen at t: the HUD clears its persistent elements there. */
export interface MapCover {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** True where the map (not the view under it) is on screen. */
  shows(x: number, y: number): boolean;
}

interface Ordered {
  readonly order: readonly { line: PenLine; flip: boolean }[];
  readonly weight: number;
}

const LOOK: Readonly<Record<RoomPlan['state'], readonly [number, number, PenStyle]>> = {
  done: [C.SAGE, C.GREEN, 'solid'],
  next: [C.GREY, C.SLATE, 'dashed'],
  ahead: [C.SLATE, C.SLATE, 'dashed'],
};
const LABEL_COLOURS: Readonly<Record<RoomPlan['state'], readonly [number, number]>> = {
  done: [C.SAGE, C.GREEN],
  next: [C.SAND, C.WOOD],
  ahead: [C.GREY, C.SLATE],
};

export class Automap {
  readonly plan: AutomapPlan;
  private readonly path: CameraPath;
  private readonly seed: number;
  private readonly scratch = new Bmp(SCREEN_W, SCREEN_H, C.VOID);
  private readonly ordered = new Map<number, Ordered>();
  private frozen: Bmp | undefined;

  constructor(plan: AutomapPlan, path: CameraPath, seed: number) {
    this.plan = plan;
    this.path = path;
    this.seed = seed;
    const { geometry } = plan;
    for (const room of plan.rooms)
      this.ordered.set(room.room, pencilOrder(geometry.lines[room.room] ?? [], room.entry));
    geometry.doors.forEach((door, k) => {
      const area = geometry.rooms.length + k;
      this.ordered.set(area, pencilOrder(geometry.lines[area] ?? [], [door.x, door.y]));
    });
  }

  /** Path time the arrow shows at t (the replay, else the live walk). */
  private arrowTime(t: number): number {
    const replay = this.plan.replay;
    if (replay === undefined || t >= replay.until) return t;
    return lerp(replay.from, replay.to, seg(t, replay.at, replay.until));
  }

  /** Camera centre (cells) at t: holds and eased moves with anticipation and overshoot. */
  private centre(t: number): { x: number; y: number } {
    const { camera, scale } = this.plan;
    let previous = camera[0] ?? { x: 0, y: 0 };
    let x = previous.x;
    let y = previous.y;
    for (const key of camera.slice(1)) {
      if (t <= key.at) break;
      const travel = EASES.inOut(seg(t, key.at + 0.14, key.at + 0.86));
      const antic = Math.sin(Math.PI * seg(t, key.at, key.at + 0.16)) * 3;
      const over = Math.sin(Math.PI * seg(t, key.at + 0.74, key.at + 1.1)) * 5;
      const length = Math.hypot(key.x - previous.x, key.y - previous.y) || 1;
      const push = (over - antic) / scale;
      x = lerp(previous.x, key.x, travel) + ((key.x - previous.x) / length) * push;
      y = lerp(previous.y, key.y, travel) + ((key.y - previous.y) / length) * push;
      previous = key;
    }
    return { x, y };
  }

  private frame(ox: number, oy: number, s: number): MapFrame {
    const seed = this.seed;
    return {
      ox,
      oy,
      s,
      jitter: (area) => [
        Math.round((hash3(area, 3, seed) - 0.5) * 2.6),
        Math.round((hash3(area, 4, seed) - 0.5) * 2.6),
      ],
    };
  }

  private progress(room: RoomPlan, t: number): number {
    return room.drawEnd <= room.drawAt ? (t >= room.drawAt ? 1 : 0) : seg(t, room.drawAt, room.drawEnd);
  }

  private walls(b: Bmp, frame: MapFrame, area: number, p: number, state: RoomPlan['state']): void {
    const ordered = this.ordered.get(area);
    if (ordered === undefined || p <= 0) return;
    const [shell, inner, style] = LOOK[state];
    let left = p * ordered.weight;
    for (const { line, flip } of ordered.order) {
      if (left <= 0) return;
      const weight = (line.a1 - line.a0) * line.speed;
      pen(b, frame, line, flip, Math.min(1, left / weight), line.cls === 0 ? shell : inner, style);
      left -= weight;
    }
  }

  private floors(b: Bmp, frame: MapFrame, t: number): void {
    const { geometry } = this.plan;
    for (const room of this.plan.rooms) {
      const cells = geometry.rooms[room.room]?.cells ?? [];
      if (room.state === 'done')
        fillCells(b, frame, cells, room.room, seg(t, room.drawEnd - 0.25, room.drawEnd + 0.3), (x, y) =>
          b.px(x, y, C.MOSS_D),
        );
      else
        fillCells(b, frame, cells, room.room, seg(t, room.drawAt, room.drawAt + 0.4), (x, y, mx, my) => {
          if ((mx + my) % 6 === 0) b.px(x, y, C.CHAR);
        });
    }
  }

  private doors(b: Bmp, frame: MapFrame, t: number): void {
    const { geometry, rooms, marks } = this.plan;
    const objective = marks.find((mark) => mark.kind === 'objective');
    geometry.doors.forEach((door, k) => {
      const sides = rooms.filter((room) => door.rooms.includes(room.room));
      const first = sides.reduce<RoomPlan | undefined>(
        (best, room) => (best === undefined || room.drawAt < best.drawAt ? room : best),
        undefined,
      );
      if (first === undefined) return;
      const state = sides.some((room) => room.state === 'done') ? 'done' : first.state;
      this.walls(b, frame, geometry.rooms.length + k, this.progress(first, t), state);
      if (t < first.drawAt + 0.25) return;
      const warm = objective !== undefined && t > objective.at && sides.some((r) => r.state === 'next');
      const c = warm ? C.SAND_L : C.TAN;
      const [jx, jy] = frame.jitter(door.rooms[0]);
      const x = Math.round(frame.ox + door.x * frame.s) + jx;
      const y = Math.round(frame.oy + door.y * frame.s) + jy;
      const s = Math.round(frame.s);
      const mid = Math.round(s / 2);
      if (door.axis === 1) {
        b.rect(x + mid, y, 1, 2, c);
        b.rect(x + mid, y + s - 2, 1, 2, c);
      } else {
        b.rect(x, y + mid, 2, 1, c);
        b.rect(x + s - 2, y + mid, 2, 1, c);
      }
    });
  }

  private footprints(b: Bmp, frame: MapFrame, pathT: number): void {
    const steps = this.path.stepsUntil(pathT);
    steps.forEach((step, k) => {
      const p = this.path.pointAt(step);
      const length = Math.hypot(p.dx, p.dy) || 1;
      const side = k % 2 ? 0.2 : -0.2;
      const x = frame.ox + (p.x - (p.dy / length) * side) * frame.s;
      const y = frame.oy + (p.y + (p.dx / length) * side) * frame.s;
      b.px(x, y, steps.length - k < 18 ? C.SAND : C.SLATE);
    });
  }

  /** The whole map at t for a camera origin and scale; `detail` = labels, note and legend. */
  private compose(b: Bmp, t: number, ox: number, oy: number, s: number, detail: boolean): void {
    b.d.fill(C.VOID);
    const frame = this.frame(ox, oy, s);
    const grid = 2 * s;
    const gx = ((Math.round(ox) % grid) + grid) % grid;
    const gy = ((Math.round(oy) % grid) + grid) % grid;
    for (let y = gy; y < SCREEN_H; y += grid)
      for (let x = gx; x < SCREEN_W; x += grid) b.px(x, y, C.MOSS_D);
    this.floors(b, frame, t);
    for (const room of this.plan.rooms) this.walls(b, frame, room.room, this.progress(room, t), room.state);
    this.doors(b, frame, t);
    const pathT = this.arrowTime(t);
    this.footprints(b, frame, pathT);
    this.plan.marks.forEach((mark, i) => {
      const x = ox + mark.x * s;
      const y = oy + mark.y * s;
      if (mark.kind === 'item') pickup(b, x, y, t, mark.at);
      else if (mark.kind === 'cross') cross(b, x, y, t, mark.at, 120 + i * 3);
      else diamond(b, x, y, t, mark.at);
    });
    if (detail) this.details(b, t, ox, oy);
    const pose = this.path.at(pathT, 0, 0);
    const replayDone = this.plan.replay === undefined || t >= this.plan.replay.until;
    const blink = replayDone && hash3(Math.floor(t * 6.5), 9, this.seed) < 0.2;
    const size = Math.min(1.4, Math.max(0.55, s / 8));
    arrow(b, ox + pose.x * s, oy + pose.y * s, pose.a, blink ? C.TUNGSTEN : C.BULB, size);
  }

  private details(b: Bmp, t: number, ox: number, oy: number): void {
    this.plan.rooms.forEach((room, i) => {
      if (room.label === undefined) return;
      const [colour, subColour] = LABEL_COLOURS[room.state];
      const look = { ...room.label, colour, subColour, seed: i };
      label(b, Math.round(ox + room.label.x) + (i % 2 ? 1 : -1), Math.round(oy + room.label.y), look, t);
    });
    const note = this.plan.note;
    if (note !== undefined) {
      const nx = Math.round(ox + note.x);
      const ny = Math.round(oy + note.y);
      handText(b, note.text, nx, ny, C.SAND, note.times, t, 61);
      if (note.to !== undefined) {
        const w = handTextWidth(note.text);
        const start: [number, number] = [nx + Math.min(40, w * 0.3), ny + 20];
        const end: [number, number] = [ox + note.to[0] * this.plan.scale, oy + note.to[1] * this.plan.scale - 8];
        noteArrow(b, start, end, t, (note.times.at(-1) ?? note.at) + 0.2, 404);
      }
    }
    if (this.plan.legend !== null && t > this.plan.open) legend(b, this.plan.legend.done, this.plan.legend.ahead);
  }

  /** Map origin for a centre (cells) at the screen centre. */
  private origin(centre: { x: number; y: number }, s: number, cx = SCREEN_CX, cy = SCREEN_CY) {
    return { ox: Math.round(cx - centre.x * s), oy: Math.round(cy - centre.y * s) };
  }

  /** The unfold rect at t (from the minimap to the full screen). */
  private unfoldRect(t: number): { x: number; y: number; w: number; h: number; e: number } {
    const e = EASES.inOut(seg(t, this.plan.at, this.plan.open));
    return {
      x: lerp(MINI.x, 0, e),
      y: lerp(MINI.y, 0, e),
      w: lerp(MINI.w, SCREEN_W, e),
      h: lerp(MINI.h, SCREEN_H, e),
      e,
    };
  }

  /** The fold at t: the frozen map shrinks onto the minimap in held steps, then dithers away. */
  private foldState(t: number) {
    const { foldAt, scale } = this.plan;
    const steps = Math.floor(seg(t, foldAt + 0.1, foldAt + 0.7) * 8) / 8;
    const e = t < foldAt + 0.1 ? -0.018 * Math.sin(Math.PI * seg(t, foldAt, foldAt + 0.1)) : EASES.inOut(steps);
    const mix = seg(t, foldAt + 0.72, foldAt + 0.97);
    const centre = this.centre(foldAt);
    const pose = this.path.at(this.arrowTime(foldAt), 0, 0);
    const px = SCREEN_CX + (pose.x - centre.x) * scale;
    const py = SCREEN_CY + (pose.y - centre.y) * scale;
    const cw = (MINI.w * scale) / MINI.cell;
    const ch = (MINI.h * scale) / MINI.cell;
    return {
      sx: lerp(0, px - cw / 2, e),
      sy: lerp(0, py - ch / 2, e),
      sw: lerp(SCREEN_W, cw, e),
      sh: lerp(SCREEN_H, ch, e),
      dx: Math.round(lerp(0, MINI.x, e)),
      dy: Math.round(lerp(0, MINI.y, e)),
      dw: Math.round(lerp(SCREEN_W, MINI.w, e)),
      dh: Math.round(lerp(SCREEN_H, MINI.h, e)),
      mix,
    };
  }

  /** The screen area the map covers at t (null: no map). */
  cover(t: number): MapCover | null {
    const { at, until, open, foldAt, enter, exit } = this.plan;
    if (t < at || t >= until) return null;
    const full = (shows: (x: number, y: number) => boolean): MapCover => ({ x0: 0, y0: 0, x1: SCREEN_W, y1: SCREEN_H, shows });
    if (t < open && enter === 'unfold') {
      const r = this.unfoldRect(t);
      const [x0, y0, x1, y1] = [Math.floor(r.x), Math.floor(r.y), Math.ceil(r.x + r.w), Math.ceil(r.y + r.h)];
      return { x0, y0, x1, y1, shows: () => true };
    }
    if (t < open && enter === 'wipe') {
      const p = EASES.inOut(seg(t, at, open));
      const mcx = MINI.x + MINI.w / 2;
      const mcy = MINI.y + MINI.h / 2;
      const far = Math.hypot(mcx, SCREEN_H - mcy);
      return full((x, y) => (0.7 * Math.hypot(x - mcx, y - mcy)) / far + 0.3 * bayer(x, y) < p);
    }
    if (t < foldAt || exit === 'cut') return full(() => true);
    const f = this.foldState(t);
    return {
      x0: Math.max(0, f.dx - 1),
      y0: Math.max(0, f.dy - 1),
      x1: Math.min(SCREEN_W, f.dx + f.dw + 1),
      y1: Math.min(SCREEN_H, f.dy + f.dh + 1),
      shows: (x, y) => !(f.mix > 0 && bayer(x, y) < f.mix),
    };
  }

  /** True when the map covers the whole screen at t (the 3D view need not render). */
  opaque(t: number): boolean {
    const { open, foldAt, exit } = this.plan;
    return t >= open && (t < foldAt || exit === 'cut') && t < this.plan.until;
  }

  /** Paints the map part of frame t over `screen` (640x360 indices). */
  paint(t: number, screen: Uint8Array): void {
    const cover = this.cover(t);
    if (cover === null) return;
    const { scale, open, foldAt, exit, enter } = this.plan;
    const b = this.scratch;
    if (t >= foldAt && exit === 'fold') {
      this.paintFold(t, screen);
      return;
    }
    if (t < open && enter === 'unfold') {
      const r = this.unfoldRect(t);
      const s = lerp(MINI.cell, scale, r.e);
      const { ox, oy } = this.origin(this.centre(this.plan.at), s, r.x + r.w / 2, r.y + r.h / 2);
      this.compose(b, t, ox, oy, s, false);
      this.copy(screen, cover, true);
      return;
    }
    const { ox, oy } = this.origin(this.centre(t), scale);
    this.compose(b, t, ox, oy, scale, t >= open);
    this.copy(screen, cover, false);
  }

  private copy(screen: Uint8Array, cover: MapCover, rim: boolean): void {
    const src = this.scratch.d;
    for (let y = cover.y0; y < cover.y1; y += 1)
      for (let x = cover.x0; x < cover.x1; x += 1) {
        if (!cover.shows(x, y)) continue;
        const i = y * SCREEN_W + x;
        const edge = rim && (x === cover.x0 || y === cover.y0 || x === cover.x1 - 1 || y === cover.y1 - 1);
        screen[i] = edge ? C.VOID : (src[i] ?? C.VOID);
      }
  }

  private paintFold(t: number, screen: Uint8Array): void {
    const { foldAt, scale } = this.plan;
    if (this.frozen === undefined) {
      this.frozen = new Bmp(SCREEN_W, SCREEN_H, C.VOID);
      const { ox, oy } = this.origin(this.centre(foldAt), scale);
      this.compose(this.frozen, foldAt, ox, oy, scale, true);
    }
    const src = this.frozen.d;
    const f = this.foldState(t);
    for (let y = Math.max(0, f.dy - 1); y < Math.min(SCREEN_H, f.dy + f.dh + 1); y += 1)
      for (let x = Math.max(0, f.dx - 1); x < Math.min(SCREEN_W, f.dx + f.dw + 1); x += 1) {
        const i = y * SCREEN_W + x;
        const inside = x >= f.dx && y >= f.dy && x < f.dx + f.dw && y < f.dy + f.dh;
        if (!inside) {
          if (f.mix === 0) screen[i] = C.VOID;
          continue;
        }
        if (f.mix > 0 && bayer(x, y) < f.mix) continue;
        const qx = Math.floor(f.sx + ((x - f.dx + 0.5) * f.sw) / f.dw);
        const qy = Math.floor(f.sy + ((y - f.dy + 0.5) * f.sh) / f.dh);
        screen[i] = qx >= 0 && qy >= 0 && qx < SCREEN_W && qy < SCREEN_H ? (src[qy * SCREEN_W + qx] ?? C.VOID) : C.VOID;
      }
  }
}
