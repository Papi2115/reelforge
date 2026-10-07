/**
 * One Game B2 location over time: the compiled level, the camera walk and the scene's timed
 * events (doors, lights switching on with a stutter, NPCs talking or shaking their head, props
 * dropping in, screen shake, fog, the hand, thrown items and the sprites they hit, automaps).
 * `render(t, screen)` paints the 640x360 index screen from scratch, a pure function of t (no
 * state carried between frames, any seek order).
 */
import { EASES, hash3, seg } from '../core/rand.js';
import type { CompiledLevel, CompiledSprite } from '../level/compile.js';
import type { CameraPath, Camera } from '../ray/camera.js';
import { RoomLights, type FrameState, type SpriteDraw } from '../ray/lighting.js';
import { createWorldBuffers, renderWorld, roomAt, VIEW_H, VIEW_W } from '../ray/raycast.js';
import { bulb, type Sprite } from '../ray/sprites-props.js';
import type { Automap, MapCover } from '../map/automap.js';
import { drawHand, HandTrack } from './hand.js';
import { SCREEN_W } from './output.js';
import { flinching, flinchOffset, throwSprites, type Flinch, type ThrowEvent } from './throw.js';

export type NpcAct = 'talk' | 'no';

interface Placed {
  readonly sprite: CompiledSprite;
  readonly at: number;
  readonly fall: number;
}

interface DoorEvent {
  readonly x: number;
  readonly y: number;
  readonly at: number;
  readonly end: number;
}

const BULB_ON = bulb(true);
const BULB_OFF = bulb(false);
/** A switched light clicks on with two uneven stutters: [s after the switch, level]. */
const STUTTER: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.08, 0],
  [0.16, 0.6],
  [0.21, 0],
  [0.29, 1],
];

export class B2World {
  readonly level: CompiledLevel;
  readonly path: CameraPath;
  readonly hand = new HandTrack();
  private readonly seed: number;
  private readonly bob: number;
  private readonly doors: DoorEvent[] = [];
  private readonly switches = new Map<string, number>();
  private readonly acts: { id: string; act: NpcAct; at: number; until: number }[] = [];
  private readonly placed: Placed[] = [];
  private readonly shakes: { at: number; amp: number }[] = [];
  private readonly fogs: { at: number; until: number; amount: number }[] = [];
  private readonly throws: ThrowEvent[] = [];
  private readonly flinches: Flinch[] = [];
  private readonly automaps: Automap[] = [];
  /** Spans an opaque HUD screen (a tally) covers: the 3D view need not render there. */
  private readonly occluded: { at: number; until: number }[] = [];
  private readonly buffers = createWorldBuffers();
  private readonly doorOpen: Float32Array;
  private readonly glow: Float32Array;
  private readonly lights: RoomLights;

  constructor(level: CompiledLevel, path: CameraPath, seed: number, bob: number) {
    this.level = level;
    this.path = path;
    this.seed = seed;
    this.bob = bob;
    this.doorOpen = new Float32Array(level.w * level.h);
    this.glow = new Float32Array(level.textures.length);
    this.lights = new RoomLights(level.regions.length);
  }

  open(x: number, y: number, at: number, duration: number): void {
    this.doors.push({ x, y, at, end: at + duration });
  }

  switchOn(id: string, at: number): void {
    this.switches.set(id, at);
  }

  act(id: string, act: NpcAct, at: number, until: number): void {
    this.acts.push({ id, act, at, until });
  }

  place(sprite: CompiledSprite, at: number, fall: number): void {
    this.placed.push({ sprite, at, fall });
  }

  shake(at: number, amp: number): void {
    this.shakes.push({ at, amp });
  }

  /** A fog bank rolls in over 0.6 s, holds and clears (an interlude: time passes). */
  fog(at: number, until: number, amount: number): void {
    this.fogs.push({ at, until, amount });
  }

  /** A thrown item; the sprite it hits (if any) flinches when it lands. */
  throwItem(event: ThrowEvent, hit: string | undefined): void {
    this.throws.push(event);
    if (hit === undefined) return;
    const dx = event.to[0] - event.from[0];
    const dy = event.to[1] - event.from[1];
    const length = Math.hypot(dx, dy) || 1;
    this.flinches.push({ id: hit, at: event.land, dx: dx / length, dy: dy / length });
  }

  /** Nothing of the view shows in [at, until) (an opaque HUD screen covers it). */
  occlude(at: number, until: number): void {
    this.occluded.push({ at, until });
  }

  addAutomap(automap: Automap): void {
    this.automaps.push(automap);
  }

  /** What the automap covers at t (the HUD clears its persistent elements there). */
  mapCover(t: number): MapCover | null {
    for (const automap of this.automaps) {
      const cover = automap.cover(t);
      if (cover !== null) return cover;
    }
    return null;
  }

  private fogBoost(t: number): number {
    let boost = 0;
    for (const { at, until, amount } of this.fogs)
      boost = Math.max(
        boost,
        amount * EASES.inOut(seg(t, at, at + 0.6)) * (1 - EASES.inOut(seg(t, until - 0.6, until))),
      );
    return boost;
  }

  /** The faulty tube: mostly on, dips and blackouts on a seeded uneven cadence. */
  private tube(t: number): number {
    const h = hash3(Math.floor(t * 14), 31, this.seed);
    return h < 0.07 ? 0.1 : h < 0.11 ? 0.55 : 1;
  }

  private switchLevel(id: string | undefined, t: number): number {
    const at = id === undefined ? undefined : this.switches.get(id);
    if (at === undefined) return 1;
    let level = 0;
    for (const [offset, value] of STUTTER) if (t >= at + offset) level = value;
    return level;
  }

  camera(t: number): Camera {
    let shake = 0;
    for (const { at, amp } of this.shakes)
      if (t > at) shake += amp * Math.exp(-(t - at) * 9) * Math.sin((t - at) * 70);
    return this.path.at(t, shake, this.bob);
  }

  private frameOf(sprite: CompiledSprite, t: number): Sprite {
    const frames = sprite.frames;
    const pick = (index: number): Sprite => frames[index] ?? frames[0] ?? BULB_OFF;
    if (frames.length === 1) return pick(0);
    if (sprite.kind === 'desk') return pick(hash3(Math.floor(t * 7), 2, this.seed) < 0.55 ? 1 : 0);
    if (sprite.kind === 'clerk' && flinching(this.flinches, sprite.id, t))
      return pick(Math.floor(t * 14) % 2 ? 2 : 3);
    const act = this.acts.find((a) => a.id === sprite.id && a.at <= t && t < a.until);
    if (act === undefined) return pick(0);
    const tick = Math.floor(t * 14);
    if (act.act === 'no') return pick(tick % 2 ? 2 : 3);
    return pick(hash3(tick, 9, this.seed) < 0.55 ? 1 : 0);
  }

  /** An opening door spills the brighter room's light into the darker one. */
  private doorSpill(door: DoorEvent, open: number): void {
    const { level } = this;
    const alongX = level.doorAxis[door.y * level.w + door.x] === 1;
    const sides = alongX
      ? [-1, 1].map((s) => [door.x + s, door.y, s] as const)
      : [-1, 1].map((s) => [door.x, door.y + s, s] as const);
    const [a, b] = sides.map(([x, y, s]) => ({ room: roomAt(level, x + 0.5, y + 0.5), s }));
    if (a === undefined || b === undefined || a.room === b.room) return;
    const ambient = (room: number): number => level.regions[room]?.ambient ?? 0;
    const dark = ambient(a.room) <= ambient(b.room) ? a : b;
    const x = door.x + 0.5 + (alongX ? dark.s * 0.8 : 0);
    const y = door.y + 0.5 + (alongX ? 0 : dark.s * 0.8);
    this.lights.add(dark.room, x, y, 0.5, 1.2 * open, 1 / 4);
  }

  private state(t: number): FrameState {
    const { level } = this;
    this.doorOpen.fill(0);
    this.lights.clear();
    for (const door of this.doors) {
      const open = EASES.inOut(seg(t, door.at, door.end));
      const cell = door.y * level.w + door.x;
      this.doorOpen[cell] = Math.max(this.doorOpen[cell] ?? 0, open);
      if (open > 0) this.doorSpill(door, open);
    }
    const tube = this.tube(t);
    level.textures.forEach((texture, id) => {
      this.glow[id] = texture.flicker ? (tube > 0.5 ? texture.glow : 0) : texture.glow;
    });
    const sprites: SpriteDraw[] = [];
    for (const light of level.lights) {
      const on = this.switchLevel(light.id, t);
      const flicker =
        light.flicker === 'tube'
          ? tube
          : light.flicker === 'bulb' && hash3(Math.floor(t * 11), 5, this.seed) < 0.04
            ? 0.7
            : 1;
      const sway = light.bulb ? 0.035 * Math.sin(t * 1.9) + 0.012 * Math.sin(t * 4.3 + 1) : 0;
      this.lights.add(
        light.region,
        light.x + sway,
        light.y,
        light.z,
        light.power * on * flicker,
        light.inv,
      );
      if (light.bulb)
        sprites.push({
          spr: on > 0.5 ? BULB_ON : BULB_OFF,
          region: light.region,
          x: light.x + sway,
          y: light.y,
          z: light.z - 0.04,
          w: 0.1,
          h: 0.4,
        });
    }
    const knocked = (entry: CompiledSprite, z: number): SpriteDraw => {
      const off = flinchOffset(this.flinches, entry.id, t);
      const spr = this.frameOf(entry, t);
      return off === undefined
        ? { ...entry, z, spr }
        : { ...entry, x: entry.x + off.dx, y: entry.y + off.dy, z: z + off.dz, spr };
    };
    for (const sprite of level.sprites) sprites.push(knocked(sprite, sprite.z));
    for (const { sprite, at, fall } of this.placed) {
      if (t < at) continue;
      const drop = (1 - EASES.outBack(seg(t, at, at + 0.22))) * fall;
      sprites.push(knocked(sprite, sprite.z + drop));
    }
    throwSprites(this.throws, t, sprites);
    return {
      doorOpen: this.doorOpen,
      lights: this.lights,
      glow: this.glow,
      sprites,
      fogBoost: this.fogBoost(t),
    };
  }

  /**
   * Paints frame t into `screen` (640x360 indices, the 3D view doubled, the automap over it);
   * under an opaque HUD screen (`occlude`) it paints nothing.
   */
  render(t: number, screen: Uint8Array): Camera {
    if (this.occluded.some((span) => span.at <= t && t < span.until)) return this.camera(t);
    return this.paint(t, screen);
  }

  /** Paints frame t whatever covers it (the frozen frame behind a tally). */
  paint(t: number, screen: Uint8Array): Camera {
    const cam = this.camera(t);
    const automap = this.automaps.find((entry) => entry.cover(t) !== null);
    if (automap !== undefined && automap.opaque(t)) {
      automap.paint(t, screen);
      return cam;
    }
    this.renderView(t, cam, screen);
    automap?.paint(t, screen);
    return cam;
  }

  private renderView(t: number, cam: Camera, screen: Uint8Array): void {
    const state = this.state(t);
    const { buf } = this.buffers;
    renderWorld(this.level, cam, state, this.buffers);
    const pose = this.hand.at(t, cam);
    const room = roomAt(this.level, cam.x, cam.y);
    const region = this.level.regions[room];
    if (pose !== null && region !== undefined) {
      const light = Math.min(
        1.15,
        region.ambient + state.lights.sum(room, cam.x, cam.y, 0.3) + 0.12,
      );
      drawHand(buf, pose, region.cmap, light);
    }
    for (let y = 0; y < VIEW_H; y += 1)
      for (let x = 0; x < VIEW_W; x += 1) {
        const c = buf[y * VIEW_W + x] ?? 0;
        const p = y * 2 * SCREEN_W + x * 2;
        screen[p] = c;
        screen[p + 1] = c;
        screen[p + SCREEN_W] = c;
        screen[p + SCREEN_W + 1] = c;
      }
  }
}
