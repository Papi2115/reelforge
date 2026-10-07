/**
 * One Game B1 frame for t, from scratch (nothing survives a frame; seek order cannot matter):
 * 1. the picture INSIDE the TV: the scene's painters with 2600 rules (or the idle attract mode),
 *    then the in-game boss cards;
 * 2. the room around it at the camera's view, the picture blitted into the TV glass and given the
 *    CRT there; while the camera pushes INTO the TV (`inTv` 0..1) the picture grows from the
 *    glass to the full frame, so inTv = 1 is exactly the TV-only frame (continuity);
 * 3. the glass (sticky notes, outside the CRT) through the same glass transform;
 * 4. the film HUD on top.
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
import { C } from '../palette.js';
import { livingRoom, type GlassRect } from '../room/living-room.js';
import { RoomPen, TV_GLASS, VIEWS, viewAt, type CameraKey, type View } from '../room/view.js';
import { crt } from '../tv/crt.js';
import { TvPainter } from '../tv/painter.js';

export const SCREEN_W = 640;
export const SCREEN_H = 360;

export type Painter = (g: TvPainter, t: number) => void;

export interface RoomModel {
  readonly calendar: { month: string; mark: number; ring: readonly [number, number] } | undefined;
  readonly tree: boolean;
  readonly presents: boolean;
  readonly gift:
    | {
        slot: readonly [number, number];
        tag: readonly string[];
        tagAt: readonly [number, number];
        blink: number | undefined;
      }
    | undefined;
  readonly lamp: boolean;
  readonly carts: number;
}

const FULL: GlassRect = [0, 0, SCREEN_W, SCREEN_H];

export class ScreenModel {
  readonly painters: Painter[] = [];
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
  private readonly frame = new IndexCanvas(SCREEN_W, SCREEN_H);
  private readonly picture = new IndexCanvas(SCREEN_W, SCREEN_H);
  private readonly pen = new RoomPen(this.frame);

  constructor(
    readonly seed: number,
    readonly duration: number,
    private readonly flickerLimit: number,
  ) {}

  /** The camera's view at t (inside the TV when there is no room). */
  viewAt(t: number): View {
    return this.room === undefined ? VIEWS.tv : viewAt(this.camera, t, VIEWS.room);
  }

  render(t: number): Uint8Array {
    const view = this.viewAt(t);
    const inside = view.inTv >= 1;
    const pic = inside ? this.frame : this.picture;
    this.paintPicture(pic, t);
    if (inside) this.finishGlass(FULL, t, 22, true, false);
    else this.paintRoom(t, view);
    this.paintHud(t);
    return this.frame.d;
  }

  private paintPicture(pic: IndexCanvas, t: number): void {
    pic.clip();
    pic.fill(C.VOID);
    const g = new TvPainter(pic, t, this.flickerLimit);
    if (this.painters.length === 0) g.attract();
    for (const painter of this.painters) painter(g, t);
    g.flush();
    for (const boss of this.bosses) drawBossCard(pic, boss, t);
  }

  /** CRT + glass on a rect of the frame; `blit` copies the picture into it first. */
  private finishGlass(rect: GlassRect, t: number, radius: number, hum: boolean, blit: boolean) {
    const [x, y, w, h] = rect;
    if (blit) this.frame.blitScaled(this.picture, x, y, w, h);
    crt(this.frame, x, y, w, h, t, { radius, hum });
    const glass: GlassTransform = { ox: x, oy: y, kx: w / SCREEN_W, ky: h / SCREEN_H };
    for (const note of this.notes) drawNote(this.frame, note, t, glass);
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
    const k = EASES.in(view.inTv);
    const [gx, gy, gw, gh] = this.pen.box(TV_GLASS.x, TV_GLASS.y, TV_GLASS.w, TV_GLASS.h);
    const rect: GlassRect = [
      Math.round(lerp(gx, 0, k)),
      Math.round(lerp(gy, 0, k)),
      Math.round(lerp(gw, SCREEN_W, k)),
      Math.round(lerp(gh, SCREEN_H, k)),
    ];
    this.finishGlass(rect, t, Math.round(lerp(roomRadius, 22, k)), true, true);
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

  private paintHud(t: number): void {
    const cv = this.frame;
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
