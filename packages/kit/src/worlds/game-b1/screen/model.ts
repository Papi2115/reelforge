/**
 * One Game B1 frame for t, from scratch (nothing survives a frame; seek order cannot matter):
 * 1. the picture INSIDE the TV: the scene's painters with 2600 rules (or the idle attract mode),
 *    the in-game boss cards, then the picture overlays (high-score table, level select, continue
 *    screen);
 * 2. the room around it at the camera's view, the picture blitted into the TV glass and given the
 *    CRT there; while the camera pushes INTO the TV (`inTv` 0..1) the picture grows from the
 *    glass to the full frame, so inTv = 1 is exactly the TV-only frame (continuity). A cartridge
 *    insert / pull swaps in the console close-up of the same room; a calendar zoom pushes into
 *    the wall calendar and redraws the frame line by line as the next place;
 * 3. the glass (sticky notes, grease-pencil marks, outside the CRT) through the same transform;
 * 4. paper layers (the instruction manual) over everything but the HUD;
 * 5. the film HUD on top, in paper ink where a page covers it.
 */
import { IndexCanvas } from '../core/canvas.js';
import { EASES, lerp, seg } from '../core/math.js';
import { drawBossCard, type BossSpec } from '../hud/boss-card.js';
import { drawDialogue, type DialogueSpec } from '../hud/dialogue.js';
import { drawNote, type GlassTransform, type NoteSpec } from '../hud/note.js';
import {
  drawCheckpoint,
  drawLives,
  drawProgress,
  drawScore,
  drawYear,
  type CheckpointSpec,
  type LivesSpec,
  type ProgressSpec,
  type ScoreSpec,
  type YearKey,
} from '../hud/overlay.js';
import { C, INK_FLIP, T } from '../palette.js';
import { livingRoom, type GlassRect } from '../room/living-room.js';
import { RoomPen, TV_GLASS, VIEWS, viewAt, type CameraKey, type View } from '../room/view.js';
import { paintCartridge, type CartridgePlan } from '../seams/cartridge.js';
import { paintZoomWipe, zoomView, type ZoomPlan } from '../seams/calendar-zoom.js';
import { crt } from '../tv/crt.js';
import { TvPainter } from '../tv/painter.js';
import type { RoomModel } from './room-model.js';

export type { RoomModel } from './room-model.js';

export const SCREEN_W = 640;
export const SCREEN_H = 360;

export type Painter = (g: TvPainter, t: number) => void;

/** Drawn on the TV picture after the painters and the boss cards (px, picture canvas). */
export type Overlay = (cv: IndexCanvas, t: number) => void;

/** Drawn on the glass after the CRT, through the glass transform (grease pencil, prints). */
export type GlassPainter = (cv: IndexCanvas, t: number, glass: GlassTransform) => void;

/** The x range [x0, x1) a paper layer covers in frame row y (empty when x1 <= x0). */
export type Cover = (y: number) => readonly [number, number];

/** A layer over the whole frame (the manual): returns its cover while it is on screen. */
export interface PaperLayer {
  paint(frame: IndexCanvas, t: number): Cover | undefined;
}

const FULL: GlassRect = [0, 0, SCREEN_W, SCREEN_H];

export class ScreenModel {
  readonly painters: Painter[] = [];
  readonly overlays: Overlay[] = [];
  readonly glassPainters: GlassPainter[] = [];
  room: RoomModel | undefined;
  readonly camera: CameraKey[] = [];
  readonly years: YearKey[] = [];
  score: ScoreSpec | undefined;
  progress: ProgressSpec | undefined;
  lives: LivesSpec | undefined;
  readonly checkpoints: CheckpointSpec[] = [];
  readonly bosses: BossSpec[] = [];
  readonly dialogues: DialogueSpec[] = [];
  readonly notes: NoteSpec[] = [];
  zoom: ZoomPlan | undefined;
  readonly cartridges: CartridgePlan[] = [];
  readonly papers: PaperLayer[] = [];
  readonly frame = new IndexCanvas(SCREEN_W, SCREEN_H);
  readonly picture = new IndexCanvas(SCREEN_W, SCREEN_H);
  readonly pen = new RoomPen(this.frame);
  private scratch: IndexCanvas | undefined;

  constructor(
    readonly seed: number,
    readonly duration: number,
    private readonly flickerLimit: number,
  ) {}

  /** A second full frame (seams that blend two frames, the HUD on paper); made on first use. */
  get spare(): IndexCanvas {
    this.scratch ??= new IndexCanvas(SCREEN_W, SCREEN_H);
    return this.scratch;
  }

  /** The camera's view at t (inside the TV when there is no room). */
  viewAt(t: number): View {
    if (this.room === undefined) return VIEWS.tv;
    const camera = (u: number): View => viewAt(this.camera, u, VIEWS.room);
    return this.zoom === undefined ? camera(t) : zoomView(this.zoom, t, camera);
  }

  render(t: number): Uint8Array {
    const cart = this.cartridges.find((plan) => t >= plan.at && t < plan.end);
    if (cart !== undefined) paintCartridge(this, cart, t);
    else if (this.zoom !== undefined && paintZoomWipe(this, this.zoom, t)) {
      // the calendar zoom redraws the frame line by line
    } else this.paintView(t, this.viewAt(t));
    let cover: Cover | undefined;
    for (const paper of this.papers) cover = paper.paint(this.frame, t) ?? cover;
    this.paintHud(t, cover);
    return this.frame.d;
  }

  /** The frame at `view` without the HUD: the TV picture alone (inTv = 1) or the room. */
  paintView(t: number, view: View): void {
    const inside = view.inTv >= 1;
    this.paintPicture(inside ? this.frame : this.picture, t);
    if (inside) this.finishGlass(FULL, t, 22, true, false);
    else this.paintRoom(t, view);
  }

  paintPicture(pic: IndexCanvas, t: number): void {
    pic.clip();
    pic.fill(C.VOID);
    const g = new TvPainter(pic, t, this.flickerLimit);
    if (this.painters.length === 0) g.attract();
    for (const painter of this.painters) painter(g, t);
    g.flush();
    for (const boss of this.bosses) drawBossCard(pic, boss, t);
    for (const overlay of this.overlays) {
      pic.clip();
      overlay(pic, t);
    }
    pic.clip();
  }

  /** CRT + glass on a rect of the frame; `blit` copies the picture into it first. */
  finishGlass(rect: GlassRect, t: number, radius: number, hum: boolean, blit: boolean): void {
    const [x, y, w, h] = rect;
    if (blit) this.frame.blitScaled(this.picture, x, y, w, h);
    crt(this.frame, x, y, w, h, t, { radius, hum });
    const glass: GlassTransform = { ox: x, oy: y, kx: w / SCREEN_W, ky: h / SCREEN_H };
    for (const note of this.notes) drawNote(this.frame, note, t, glass);
    for (const painter of this.glassPainters) {
      this.frame.clip(x, y, w, h);
      painter(this.frame, t, glass);
    }
    this.frame.clip();
  }

  /** The picture grown from the room-scale rect `from` toward the full frame by k (0..1). */
  growGlass(from: GlassRect, k: number, t: number, radius: number): void {
    const e = EASES.in(k);
    const rect: GlassRect = [
      Math.round(lerp(from[0], 0, e)),
      Math.round(lerp(from[1], 0, e)),
      Math.round(lerp(from[2], SCREEN_W, e)),
      Math.round(lerp(from[3], SCREEN_H, e)),
    ];
    this.finishGlass(rect, t, Math.round(lerp(radius, 22, e)), true, true);
  }

  private paintRoom(t: number, view: View): void {
    const room = this.room;
    if (room === undefined) return;
    this.frame.clip();
    this.frame.fill(C.VOID);
    this.pen.set(view);
    const roomRadius = Math.round(5 * view.s);
    livingRoom(this.pen, t, this.roomState(room, t), (rect) => {
      if (view.inTv <= 0) this.finishGlass(rect, t, roomRadius, false, true);
    });
    if (view.inTv <= 0) return;
    const glass = this.pen.box(TV_GLASS.x, TV_GLASS.y, TV_GLASS.w, TV_GLASS.h);
    this.growGlass(glass, view.inTv, t, roomRadius);
  }

  private roomState(room: RoomModel, t: number) {
    const gift = room.gift;
    return {
      calendar:
        room.calendar === undefined
          ? undefined
          : {
              month: room.calendar.month,
              mark: room.calendar.mark,
              ring: seg(t, room.calendar.ring[0], room.calendar.ring[1]),
            },
      tree: room.tree,
      presents: room.presents,
      gift:
        gift === undefined
          ? undefined
          : {
              slot: seg(t, gift.slot[0], gift.slot[1]),
              tag: seg(t, gift.tagAt[0], gift.tagAt[1]),
              lines: gift.tag,
              blink:
                gift.blink !== undefined && t > gift.blink && t < gift.blink + 0.34
                  ? t - gift.blink
                  : undefined,
            },
      lamp: room.lamp,
      carts: room.carts,
      seed: this.seed,
    };
  }

  private paintHud(t: number, cover: Cover | undefined): void {
    if (cover === undefined) {
      this.drawHud(this.frame, t);
      return;
    }
    // On paper: the HUD is drawn on a clear layer and printed in paper ink where a page is.
    const layer = this.spare;
    layer.clip();
    layer.fill(T);
    this.drawHud(layer, t);
    const [src, dst, flip] = [layer.d, this.frame.d, INK_FLIP];
    for (let y = 0; y < SCREEN_H; y += 1) {
      const [x0, x1] = cover(y);
      const row = y * SCREEN_W;
      for (let x = 0; x < SCREEN_W; x += 1) {
        const v = src[row + x] ?? T;
        if (v !== T) dst[row + x] = x >= x0 && x < x1 ? (flip[v] ?? v) : v;
      }
    }
  }

  private drawHud(cv: IndexCanvas, t: number): void {
    cv.clip();
    drawYear(cv, this.years, t);
    if (this.score !== undefined) drawScore(cv, this.score, t);
    if (this.progress !== undefined) drawProgress(cv, this.progress, t, this.duration);
    for (const checkpoint of this.checkpoints)
      drawCheckpoint(cv, checkpoint, this.progress, t, this.duration);
    if (this.lives !== undefined) drawLives(cv, this.lives, t);
    for (const dialogue of this.dialogues) drawDialogue(cv, dialogue, t);
  }
}
