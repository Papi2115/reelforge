/**
 * Drawing a B1 level (level-plan.ts) with the TV painter, 2600 rules intact: the sky as colour
 * bands, the floor and ledges as playfield blocks scrolled in whole blocks, scenery as playfield
 * (outside the sprite limit), items / enemies / the goal as players (they flicker when a line is
 * crowded), the hero as the one solid player. Game feel from the plan's derived events: hit-stop,
 * one flash frame and a decaying shake on a hit, then the hero blinks; a collected item pops a
 * sparkle; a stomped enemy squashes flat; the goal blinks when reached; labels type themselves.
 */
import type { TvPainter } from '../tv/painter.js';
import { B1_SWATCHES } from '../palette.js';
import { cameraX, heroAt, patrolX } from './level-motion.js';
import { VIEW_W, type LevelEvent, type LevelPlan, type ThingPlan } from './level-plan.js';

const swatch = (index: number): string => B1_SWATCHES[index] ?? 'void';

function lastEvent(plan: LevelPlan, kind: LevelEvent['kind'], t: number): LevelEvent | undefined {
  let found: LevelEvent | undefined;
  for (const event of plan.events) if (event.kind === kind && event.t <= t) found = event;
  return found;
}

function eventOf(plan: LevelPlan, thing: number): LevelEvent | undefined {
  return plan.events.find((event) => event.thing === thing && event.kind !== 'hit');
}

/** The time the level shows: frozen for `hitStop` after a hit (the hit-stop). */
function shownTime(plan: LevelPlan, t: number): number {
  const hit = lastEvent(plan, 'hit', t);
  return hit !== undefined && t < hit.t + plan.hitStop ? hit.t : t;
}

function drawFloor(g: TvPainter, plan: LevelPlan, cam: number): void {
  const { ground } = plan;
  if (ground.field !== undefined) g.field(ground.field, ground.y, { shift: Math.floor(cam / 4) });
  else g.rect(0, ground.y, VIEW_W, 180 - ground.y, swatch(ground.colour));
  if (ground.edge !== undefined) g.rect(0, ground.y, VIEW_W, 1, swatch(ground.edge));
  for (const [x0, x1] of ground.pits) {
    const left = Math.max(0, x0 - cam);
    const right = Math.min(VIEW_W, x1 - cam);
    if (right > left) g.rect(left, ground.y, right - left, 180 - ground.y, 'void');
  }
  for (const p of plan.platforms) {
    const left = Math.max(0, p.x - cam);
    const right = Math.min(VIEW_W, p.x + p.w - cam);
    if (right > left) g.rect(left, p.y, right - left, 3, swatch(p.colour));
  }
}

function sparkle(g: TvPainter, x: number, y: number, k: number): void {
  const r = 2 + Math.round(k * 4);
  g.rect(x - r, y, 2, 1, 'white');
  g.rect(x + r - 1, y, 2, 1, 'white');
  g.rect(x, y - r, 1, 2, 'gold');
  g.rect(x, y + r - 1, 1, 2, 'gold');
}

function drawThing(
  g: TvPainter,
  plan: LevelPlan,
  thing: ThingPlan,
  i: number,
  t: number,
  cam: number,
) {
  if (thing.appear !== undefined && t < thing.appear) return;
  const x = patrolX(thing, t, plan.fps) - cam;
  if (x + thing.w < 0 || x >= VIEW_W) return;
  const done = eventOf(plan, i);
  const since = done === undefined ? -1 : t - done.t;
  if (done !== undefined && since >= 0) {
    if (done.kind === 'collect') {
      if (since < 0.24)
        sparkle(g, x + Math.floor(thing.w / 2), thing.y + Math.floor(thing.h / 2), since / 0.24);
      return;
    }
    if (done.kind === 'stomp') {
      if (since < 0.3) g.draw(thing.sprite.id, x, thing.y, { squash: 0.3, flicker: false });
      return;
    }
    // the goal blinks three times with uneven holds, then stays lit
    const off = [0.06, 0.2, 0.37].some((a) => since >= a && since < a + 0.08);
    if (!off)
      g.draw(thing.sprite.id, x, thing.y, {
        flicker: false,
        ...(since < 0.6 ? { colour: 'gold' } : {}),
      });
    return;
  }
  const face =
    thing.patrol === undefined
      ? undefined
      : patrolX(thing, t + 1 / plan.fps, plan.fps) >= patrolX(thing, t, plan.fps)
        ? ('right' as const)
        : ('left' as const);
  g.draw(thing.sprite.id, x, thing.y, {
    ...(thing.role === 'scenery' ? { playfield: true } : {}),
    ...(face === undefined ? {} : { face }),
  });
}

function drawLabels(g: TvPainter, plan: LevelPlan, t: number, cam: number): void {
  plan.things.forEach((thing, i) => {
    if (thing.label === undefined || t < thing.labelAt) return;
    if (thing.appear !== undefined && t < thing.appear) return;
    const done = eventOf(plan, i);
    if (done !== undefined && done.kind !== 'goal' && t >= done.t) return; // gone with its thing
    const width = thing.label.length * 3;
    const mid = patrolX(thing, t, plan.fps) + Math.floor(thing.w / 2) - cam;
    const x = Math.max(2, Math.min(VIEW_W - width - 2, mid - Math.floor(width / 2)));
    const y = Math.max(2, thing.y - 9);
    if (mid < -8 || mid > VIEW_W + 8) return;
    g.text(thing.label, x, y, {
      colour: thing.role === 'enemy' ? 'crimson' : 'cream',
      size: 2,
      type: { at: thing.labelAt, cps: 16 },
    });
  });
}

function drawHero(g: TvPainter, plan: LevelPlan, t: number, cam: number): void {
  const hero = heroAt(plan, t);
  const hit = lastEvent(plan, 'hit', t);
  if (hit !== undefined && t >= hit.t + plan.hitStop && t < hit.t + 0.6)
    if (Math.floor((t - hit.t) * 15) % 2 === 1) return; // the blink after a hit
  const squash = hero.sinceLanding < 0.1 ? 0.8 : undefined;
  g.draw(plan.heroSprite, hero.x - cam, hero.y, {
    flicker: false,
    ...(hero.moving || hero.airborne ? {} : { frame: 0 }),
    ...(hero.dir < 0 ? { face: 'left' as const } : hero.dir > 0 ? { face: 'right' as const } : {}),
    ...(squash === undefined ? {} : { squash }),
  });
}

/** The level painter for `screen.tv`-order drawing (call order = z order). */
export function drawLevel(g: TvPainter, plan: LevelPlan, t: number): void {
  if (t < plan.at || t >= plan.until) return;
  const shown = shownTime(plan, t);
  const cam = plan.camera === 'follow' ? cameraX(plan.width, true, heroAt(plan, shown)) : 0;
  const hit = lastEvent(plan, 'hit', t);
  const shake = hit === undefined ? { x: 0, y: 0 } : g.util.shake(t, hit.t, 3, 9, 77);
  g.offset(shake.x * 2, shake.y * 2);
  g.bands(
    0,
    VIEW_W,
    plan.sky.map(([y, ink]) => [y, swatch(ink)] as const),
  );
  drawFloor(g, plan, cam);
  plan.things.forEach((thing, i) => {
    drawThing(g, plan, thing, i, shown, cam);
  });
  drawHero(g, plan, shown, cam);
  drawLabels(g, plan, t, cam);
  g.offset(0, 0);
  if (hit !== undefined && t >= hit.t && t < hit.t + 0.067) g.remap('flash');
}
