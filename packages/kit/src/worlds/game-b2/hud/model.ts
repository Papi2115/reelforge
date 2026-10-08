/**
 * The Game B2 HUD as data over time: the scene registers its elements once (build time, seconds
 * already resolved) and `draw(t, cam, world)` paints them in a fixed order from scratch:
 * persistent elements (cleared where the automap covers the screen), menus, tallies, level cards, toasts,
 * dialogue, choices, damage numbers, stingers, then the HUD shake. The typewriter times are
 * seeded per line; the tally's still parts are memos of pure functions, so a frame is a pure
 * function of t.
 */
import { Bmp } from '../core/bitmap.js';
import { typeTimes } from '../core/font.js';
import { T } from '../palette.js';
import type { Camera } from '../ray/camera.js';
import type { B2World } from '../view/world.js';
import { SCREEN_H, SCREEN_W } from '../view/output.js';
import {
  drawBoss,
  drawCompass,
  drawMeterAndStatus,
  drawProgress,
  meterLevel,
  presence,
  type Boss,
  type Checkpoint,
  type Compass,
  type Meter,
  type Progress,
  type Status,
} from './bars.js';
import {
  drawChoice,
  drawDialogue,
  drawToasts,
  type Choice,
  type Line,
  type Toast,
} from './boxes.js';
import { drawInventory, type Inventory } from './inventory.js';
import { drawLevelCard, type LevelCard } from './level-card.js';
import { drawMinimap } from './map.js';
import { drawMenu, type Menu } from './menu.js';
import {
  drawDamage,
  drawStinger,
  hudShake,
  shiftScreen,
  type Damage,
  type Shake,
  type Stinger,
} from './stinger.js';
import { drawTally, tallyBase } from './tally.js';
import type { TallyPlan } from './tally-plan.js';

export interface Span {
  readonly at: number;
  readonly end: number;
}

export class HudModel {
  readonly screen = new Bmp(SCREEN_W, SCREEN_H);
  private readonly seed: number;
  private readonly shotLength: number;
  private compassEl: Compass | undefined;
  private minimapEl: { at: number; until: number } | undefined;
  private meterEl: Meter | undefined;
  private progressEl: Progress | undefined;
  private readonly statuses: Status[] = [];
  private readonly bosses: Boss[] = [];
  private readonly checkpoints: Checkpoint[] = [];
  private readonly toasts: Toast[] = [];
  private readonly lines: Line[] = [];
  private readonly choices: Choice[] = [];
  private readonly inventories: Inventory[] = [];
  private readonly menus: Menu[] = [];
  private readonly tallies: TallyPlan[] = [];
  private readonly stingers: Stinger[] = [];
  private readonly damages: Damage[] = [];
  private readonly shakes: Shake[] = [];
  private readonly levelCards: LevelCard[] = [];
  private readonly tallyStill = new Map<TallyPlan, { base: Bmp; before?: Uint8Array }>();
  private work: Bmp | undefined;

  constructor(seed: number, shotLength: number) {
    this.seed = seed;
    this.shotLength = shotLength;
  }

  compass(element: Compass): void {
    this.compassEl = element;
  }

  minimap(at: number, until: number): void {
    this.minimapEl = { at, until };
  }

  meter(element: Meter): void {
    this.meterEl = element;
  }

  status(element: Status): void {
    this.statuses.push(element);
  }

  boss(element: Boss): void {
    this.bosses.push(element);
  }

  progress(element: Progress): void {
    this.progressEl = element;
  }

  checkpoint(element: Checkpoint): void {
    this.checkpoints.push(element);
  }

  toast(head: string, body: string, at: number, until: number): Span {
    const times = typeTimes(body, this.seed + 900 + this.toasts.length, at + 0.2, 0.03);
    this.toasts.push({ head, body, at, until, times });
    return { at, end: times.at(-1) ?? at };
  }

  /** A dialogue line (speaker) or narration (speaker ''); returns when its typing ends. */
  say(text: string, speaker: string, at: number, until: number | undefined): Span {
    const times = typeTimes(text, this.seed + 500 + this.lines.length * 17, at + 0.16, 0.036);
    const typed = times.at(-1) ?? at;
    this.lines.push({ text, speaker, at, until: until ?? typed + 1.2, times });
    this.lines.sort((a, b) => a.at - b.at);
    return { at, end: typed };
  }

  choose(element: Choice): void {
    this.choices.push(element);
  }

  inventory(element: Inventory): void {
    this.inventories.push(element);
  }

  menu(element: Menu): void {
    this.menus.push(element);
  }

  tally(element: TallyPlan): void {
    this.tallies.push(element);
  }

  stinger(element: Stinger): void {
    this.stingers.push(element);
  }

  damage(element: Damage): void {
    this.damages.push(element);
  }

  shake(element: Shake): void {
    this.shakes.push(element);
  }

  levelCard(element: LevelCard): void {
    this.levelCards.push(element);
  }

  /** Where a damage number pops: the meter's current end or the boss bar's fill end. */
  anchorOf(where: 'meter' | 'boss', t: number): readonly [number, number] {
    if (where === 'meter' && this.meterEl !== undefined) {
      const label = this.meterEl.label.length * 6;
      return [25 + label + 6 + meterLevel(this.meterEl, t) * 8, 50];
    }
    const boss = this.bosses.find((entry) => entry.at <= t && t < entry.until) ?? this.bosses[0];
    if (boss === undefined) return [320, 120];
    const share = boss.keys.filter(([at]) => at <= t + 0.35).at(-1)?.[1] ?? 0;
    return [262 + Math.round(share * 186), 44];
  }

  /** Below the meter and the status rows that share the inventory's time. */
  private leftColumnTop(inventory: Inventory): number {
    const rows =
      (this.meterEl === undefined ? 0 : 1) +
      this.statuses.filter((status) => status.at < inventory.until && inventory.at < status.until)
        .length;
    return 56 + rows * 14;
  }

  /** The first time a choice box covers the dialogue slot (lines yield to it). */
  private quietFrom(t: number): number {
    const open = this.choices.find((choice) => choice.at <= t && t < choice.until);
    return open === undefined ? Number.POSITIVE_INFINITY : open.at;
  }

  /** Compass, minimap, meter, status, boss bars, progress and inventories. */
  private drawPersistent(
    b: Bmp,
    t: number,
    cam: Camera | undefined,
    world: B2World | undefined,
  ): void {
    if (this.compassEl !== undefined) drawCompass(b, this.compassEl, t, cam);
    if (this.minimapEl !== undefined && world !== undefined && cam !== undefined)
      drawMinimap(
        b,
        world.level,
        world.path,
        cam,
        t,
        presence(t, this.minimapEl.at, this.minimapEl.until),
      );
    drawMeterAndStatus(b, this.meterEl, this.statuses, t);
    for (const boss of this.bosses) drawBoss(b, boss, t);
    if (this.progressEl !== undefined)
      drawProgress(b, this.progressEl, this.checkpoints, t, this.shotLength);
    for (const inventory of this.inventories)
      drawInventory(b, inventory, t, this.leftColumnTop(inventory));
  }

  /** The tally's still parts: the frozen level behind it and the frame its melt slides away. */
  private still(tally: TallyPlan, world: B2World | undefined) {
    const hit = this.tallyStill.get(tally);
    if (hit !== undefined) return hit;
    let view: Uint8Array | undefined;
    let before: Uint8Array | undefined;
    if (world !== undefined) {
      view = new Uint8Array(SCREEN_W * SCREEN_H);
      const cam = world.paint(tally.at, view);
      before = view.slice();
      const hud = new Bmp(SCREEN_W, SCREEN_H);
      this.drawPersistent(hud, tally.at, cam, world);
      hud.d.forEach((c, i) => {
        if (c !== T && before !== undefined) before[i] = c;
      });
    }
    const made = { base: tallyBase(tally, view), ...(before === undefined ? {} : { before }) };
    this.tallyStill.set(tally, made);
    return made;
  }

  draw(t: number, cam: Camera | undefined, world: B2World | undefined): Bmp {
    const b = this.screen;
    b.d.fill(T);
    this.drawPersistent(b, t, cam, world);
    const cover = world?.mapCover(t) ?? null;
    if (cover !== null)
      for (let y = cover.y0; y < cover.y1; y += 1)
        for (let x = cover.x0; x < cover.x1; x += 1)
          if (cover.shows(x, y)) b.d[y * SCREEN_W + x] = T;
    for (const menu of this.menus) drawMenu(b, menu, t);
    for (const tally of this.tallies) {
      if (t < tally.at || t >= tally.until) continue;
      const still = this.still(tally, world);
      this.work ??= new Bmp(SCREEN_W, SCREEN_H);
      drawTally(b, tally, t, still.base, still.before, this.work);
    }
    for (const card of this.levelCards) drawLevelCard(b, card, t);
    drawToasts(b, this.toasts, t, this.progressEl === undefined ? 86 : 100);
    drawDialogue(b, this.lines, t, this.quietFrom(t));
    for (const choice of this.choices) drawChoice(b, choice, t);
    for (const damage of this.damages) drawDamage(b, damage, t);
    for (const stinger of this.stingers) drawStinger(b, stinger, t);
    const [dx, dy] = hudShake(this.shakes, t);
    shiftScreen(b, dx, dy);
    return b;
  }
}
