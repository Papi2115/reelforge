/**
 * Test scene for the Grim Ink acting render test (PLAN.md#14.9): the Apollo people with their
 * film props and every gag, and the Apollo places with their shot options and foregrounds, each
 * painted into a 1920x1080 canvas. Runs inside the page (served by ccam-module-server.ts +
 * ccam-zod-route.ts); the module namespaces are imported by the page from their sources. Pure
 * function of its inputs.
 */
import { C } from '../../src/worlds/c-cam/core.js';
import { GAG_KINDS, GAG_PERIOD, type GagKind } from '../../src/worlds/c-cam/draw/gags.js';
import { asPaint2D, type Paint2D } from '../../src/worlds/c-cam/draw/paint.js';
import type { Pose } from '../../src/worlds/c-cam/draw/poses.js';
import type { InkOptions } from '../../src/worlds/c-cam/modules/contract.js';
import { personFromModule, type InkPerson } from '../../src/worlds/c-cam/modules/person.js';
import { placeFromModule } from '../../src/worlds/c-cam/modules/place.js';

const W = 1920;
const H = 1080;

function backdrop(g: Paint2D, rows: number): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.PLASTER;
  g.fillRect(0, 0, W, H);
  g.fillStyle = C.STONE_D;
  for (let r = 1; r <= rows; r += 1) g.fillRect(0, (r * H) / rows - 14, W, 14);
}

function people(namespaces: Readonly<Record<string, unknown>>): Record<string, InkPerson> {
  const out: Record<string, InkPerson> = {};
  for (const [id, namespace] of Object.entries(namespaces)) {
    out[id] = personFromModule(namespace, `kit-ext/people/${id}.js`);
  }
  return out;
}

/** The film's props: 8 cells (4 x 2), each a person in a shot-like state. */
function propCells(cast: Record<string, InkPerson>) {
  const get = (id: string): InkPerson => {
    const person = cast[id];
    if (!person) throw new Error(`missing person ${id}`);
    return person;
  };
  const you = get('you');
  const director = get('director');
  const read: Partial<Pose> = {
    hL: [42, you.D.sy + 150, 112],
    hR: [-42, you.D.sy + 150, 112],
    kL: 'grip',
    kR: 'grip',
    poleL: [1, 0.6, -0.4],
    poleR: [-1, 0.6, -0.4],
  };
  const A = director.D.l1a + director.D.l2a;
  const sip: Partial<Pose> = {
    hR: [-(director.D.sw - 0.4 * A), director.D.sy - 0.09 * A, (director.D.sz || 0) + 0.42 * A],
    poleR: [-1, 0.8, -0.2],
  };
  return [
    { who: get('commander'), view: 0, t: 0.3, props: { chew: true, bubble: 0.7 } },
    { who: get('commander'), view: 1, t: 0.3, props: { helmet: 2 } },
    { who: you, view: 0, t: 0.3, props: { sweat: true, checklist: 0.3 }, over: read },
    { who: you, view: -1, t: 0.7, props: { helmet: 1, sweat: true } },
    { who: director, view: 1, t: 0.2, props: { mug: 0, steam: true } },
    { who: director, view: 0, t: 0.2, props: { mug: -40, sip: true }, over: sip },
    { who: get('orbiter'), view: 1, t: 0.4, props: { sandwich: 1 } },
    { who: get('guidance'), view: 0, t: 0.4, props: {} },
  ] as const;
}

/** Page 0: the film props; page 1: the 17 gags at mid-action (6 x 3). */
export function paintActing(
  ctx: CanvasRenderingContext2D,
  namespaces: Readonly<Record<string, unknown>>,
  page: number,
): void {
  const g = asPaint2D(ctx);
  const cast = people(namespaces);
  if (page === 0) {
    backdrop(g, 2);
    propCells(cast).forEach((cell, i) => {
      const x = ((i % 4) + 0.5) * (W / 4);
      const y = (Math.floor(i / 4) + 1) * (H / 2) - 14;
      const over = 'over' in cell ? cell.over : {};
      const pose = cell.who.pose('stand', 0, over);
      const props: InkOptions = cell.props;
      cell.who.draw(g, undefined, { x, y, s: 0.62, view: cell.view, t: cell.t, pose, props });
    });
    return;
  }
  backdrop(g, 3);
  const ids = Object.keys(cast);
  GAG_KINDS.forEach((kind: GagKind, i) => {
    const owner = Object.values(cast).find((p) => p.character.signatureGag?.kind === kind);
    const who = owner ?? cast[ids[i % ids.length] ?? ''];
    if (!who) return;
    const x = ((i % 6) + 0.5) * (W / 6);
    const y = (Math.floor(i / 6) + 1) * (H / 3) - 14;
    const t = GAG_PERIOD[kind] * MID[kind];
    const view = kind === 'glance' || kind === 'sighPuff' ? 1 : 0;
    who.draw(g, undefined, { x, y, s: 0.38, view, t, gag: { kind, visor: true } });
  });
}

/** Phase that shows each gag mid-action. */
const MID: Readonly<Record<GagKind, number>> = {
  gum: 0.6,
  sweat: 0.5,
  sip: 0.62,
  eat: 0.5,
  thumbs: 0.5,
  checklist: 0.7,
  helmet: 0.5,
  fidget: 0.5,
  glance: 0.25,
  yawn: 0.5,
  scratchHead: 0.5,
  sighPuff: 0.6,
  cough: 0.375,
  clockCheck: 0.5,
  tugCollar: 0.5,
  wipeBrow: 0.62,
  penClick: 0.5,
};

/** The places with shot options, 2 x 2 at half size: lm alarm, control front, surface, wall. */
export function paintPlaceOptions(
  ctx: CanvasRenderingContext2D,
  namespaces: Readonly<Record<string, unknown>>,
): void {
  const g = asPaint2D(ctx);
  const cells: readonly (readonly [string, InkOptions, boolean])[] = [
    ['lm', { alarm: true, k: 0.6, scroll: 120, boulders: 30 }, false],
    ['control', {}, true],
    ['surface', { lander: [960, 760, 0.95], flame: 0.9 }, false],
    ['panelWall', { seed: 420 }, false],
  ];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.INK;
  g.fillRect(0, 0, W, H);
  cells.forEach(([id, opts, front], i) => {
    const place = placeFromModule(namespaces[id], `kit-ext/places/${id}.js`);
    g.save();
    g.translate((i % 2) * (W / 2), Math.floor(i / 2) * (H / 2));
    g.scale(0.5, 0.5);
    g.beginPath();
    g.rect(0, 0, W, H);
    g.clip();
    place.draw(g, undefined, 1.5, opts);
    if (front) place.foreground(g, undefined, 1.5, opts);
    g.restore();
  });
}
