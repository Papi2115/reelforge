/**
 * Test scene for the Grim Ink vocabulary golden sheets (PLAN.md#14.20): every family of
 * `env.ink.{props, instruments, crowd, acting, fx}` drawn in cells with several parameter variants
 * (kinds, states, wear, values mid-change), through the checked scene-facing functions. Runs in the
 * page (served by ccam-module-server.ts + ccam-zod-route.ts); the acting sheets take two people
 * modules imported by the page from their sources. Pure function of its inputs.
 */
import { C } from '../../src/worlds/c-cam/core.js';
import { DEFAULT_ENV, type BrushEnv } from '../../src/worlds/c-cam/draw/brushes.js';
import { asPaint2D, type Paint2D } from '../../src/worlds/c-cam/draw/paint.js';
import { pool } from '../../src/worlds/c-cam/draw/scenery.js';
import { personFromModule, type InkPerson } from '../../src/worlds/c-cam/modules/person.js';
import { VOCAB } from '../../src/worlds/c-cam/vocabulary/index.js';

const W = 1920;
const H = 1080;
const E: BrushEnv = DEFAULT_ENV;
const { props: P, instruments: I, crowd: K, acting: A, fx: F } = VOCAB;

/** A muddy wall and floor per cell (cols x rows), then `draw(cx, cy, cellW, cellH, i)` per cell. */
function cells(
  g: Paint2D,
  cols: number,
  rows: number,
  draw: (x: number, y: number, w: number, h: number, i: number) => void,
): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = C.PLASTER;
  g.fillRect(0, 0, W, H);
  const w = W / cols;
  const h = H / rows;
  for (let i = 0; i < cols * rows; i += 1) {
    const x = (i % cols) * w;
    const y = Math.floor(i / cols) * h;
    g.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#8f866a' : '#968d70';
    g.fillRect(x, y, w, h * 0.72);
    g.fillStyle = '#5f5644';
    g.fillRect(x, y + h * 0.72, w, h * 0.28);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    draw(x, y, w, h, i);
    g.restore();
  }
}

/** Sheet 1: building pieces, furniture and light. */
function paintProps(g: Paint2D): void {
  cells(g, 4, 3, (x, y, w, h, i) => {
    const fy = y + h * 0.86;
    const cx = x + w / 2;
    [
      () => {
        P.door(g, E, {
          x: cx - 100,
          y: fy,
          w: 150,
          h: 230,
          kind: 'plank',
          state: 'planked',
          wear: 0.8,
          seed: 11,
        });
        P.door(g, E, { x: cx + 110, y: fy, w: 140, h: 230, kind: 'arch', state: 'ajar' });
      },
      () => {
        P.door(g, E, { x: cx - 110, y: fy, w: 130, h: 220, kind: 'iron', state: 'barred' });
        P.door(g, E, {
          x: cx + 100,
          y: fy,
          w: 130,
          h: 220,
          kind: 'curtain',
          state: 'open',
          tone: 'GREYBLUE',
        });
      },
      () => {
        P.windowFrame(g, E, {
          x: cx - 110,
          y: y + 120,
          w: 150,
          h: 170,
          kind: 'arched',
          state: 'dusk',
        });
        P.windowFrame(g, E, {
          x: cx + 100,
          y: y + 120,
          w: 160,
          h: 150,
          kind: 'barred',
          state: 'night',
        });
      },
      () => {
        const lit = P.windowFrame(g, E, {
          x: cx - 100,
          y: y + 130,
          w: 170,
          h: 170,
          kind: 'screen',
          state: 'lit',
          wear: 0.7,
        });
        if (lit.light) pool(g, lit.light.x, lit.light.y, 160, 80, lit.light.color, 0.1);
        P.windowFrame(g, E, {
          x: cx + 115,
          y: y + 120,
          w: 140,
          h: 140,
          kind: 'porthole',
          state: 'broken',
        });
      },
      () => {
        P.table(g, E, { x: cx, y: fy, w: 400, h: 120, kind: 'long', cloth: true });
      },
      () => {
        P.table(g, E, { x: cx - 90, y: fy, w: 220, h: 130, kind: 'desk', wear: 0.6 });
        P.table(g, E, { x: cx + 130, y: fy, w: 180, h: 110, kind: 'trestle', state: 'broken' });
      },
      () => {
        P.seat(g, E, { x: cx - 140, y: fy, kind: 'highBack', size: 0.45 });
        P.seat(g, E, { x: cx, y: fy, kind: 'stool', size: 0.5 });
        P.seat(g, E, { x: cx + 140, y: fy, kind: 'chair', size: 0.45, state: 'broken' });
      },
      () => {
        P.seat(g, E, { x: cx - 80, y: fy, kind: 'bench', w: 220, size: 0.6 });
        P.seat(g, E, { x: cx + 140, y: fy, kind: 'cushion', tone: 'RUST', size: 0.6 });
      },
      () => {
        P.lamp(g, E, {
          x: cx - 120,
          y: fy,
          kind: 'stand',
          level: 0.4,
          t: 1.2,
          pool: true,
          size: 0.6,
        });
        P.lamp(g, E, { x: cx, y: y + 150, kind: 'torch', t: 0.6, size: 0.7, rot: 12 });
        P.lamp(g, E, { x: cx + 130, y: y + 40, kind: 'lantern', t: 0.3, size: 0.8 });
      },
      () => {
        P.lamp(g, E, { x: cx - 120, y: fy, kind: 'paper', size: 0.7 });
        P.lamp(g, E, { x: cx, y: y + 60, kind: 'hanging', size: 0.6 });
        P.lamp(g, E, { x: cx + 130, y: fy - 20, kind: 'oil', t: 0.8 });
        P.lamp(g, E, { x: cx + 60, y: y + 40, kind: 'bulb', state: 'out', size: 0.6 });
      },
      () => {
        P.banner(g, E, {
          x: cx - 160,
          y: y + 50,
          w: 170,
          h: 110,
          kind: 'flag',
          emblem: 'disc',
          t: 0.4,
          wind: 0.8,
        });
        P.banner(g, E, {
          x: cx + 60,
          y: y + 40,
          w: 70,
          h: 220,
          kind: 'hanging',
          emblem: 'chevron',
          tone: 'GREYBLUE',
          state: 'torn',
        });
      },
      () => {
        P.banner(g, E, {
          x: cx - 170,
          y: y + 40,
          w: 200,
          h: 140,
          kind: 'curtain',
          emblem: 'stripe',
          t: 0.7,
        });
        P.banner(g, E, {
          x: cx + 70,
          y: y + 70,
          w: 140,
          h: 80,
          kind: 'sign',
          tone: 'wood',
          emblem: 'star',
          t: 0.2,
        });
      },
    ][i]?.();
  });
}

/** Sheet 2: goods, paper and table things. */
function paintGoods(g: Paint2D): void {
  cells(g, 4, 3, (x, y, w, h, i) => {
    const fy = y + h * 0.86;
    const cx = x + w / 2;
    [
      () => {
        P.container(g, E, { x: cx - 130, y: fy, kind: 'barrel', size: 0.8, wear: 0.7 });
        P.container(g, E, { x: cx + 10, y: fy, kind: 'crate', state: 'open', size: 0.7 });
        P.container(g, E, { x: cx + 150, y: fy, kind: 'jar', state: 'broken', size: 0.7 });
      },
      () => {
        P.container(g, E, { x: cx - 120, y: fy, kind: 'bale', size: 0.8 });
        P.container(g, E, {
          x: cx + 60,
          y: fy,
          kind: 'sack',
          state: 'spilled',
          contents: 'paleWood',
          size: 0.8,
        });
      },
      () => {
        P.container(g, E, {
          x: cx - 110,
          y: fy,
          kind: 'basket',
          state: 'open',
          contents: 'RED',
          size: 0.8,
        });
        P.container(g, E, { x: cx + 100, y: fy, kind: 'tub', size: 0.8 });
      },
      () => {
        P.coins(g, E, { x: cx - 120, y: y + 150, n: 5 });
        P.coins(g, E, { x: cx, y: y + 200, n: 8, spread: 'stack', kind: 'round', tone: 'steel' });
        P.coins(g, E, { x: cx + 130, y: y + 150, n: 4, kind: 'bar' });
      },
      () => {
        P.paper(g, E, { x: cx - 110, y: y + 160, kind: 'stack', n: 9, w: 150, tie: true });
        P.paper(g, E, { x: cx + 110, y: y + 140, kind: 'sheet', rot: -8, state: 'torn' });
      },
      () => {
        P.paper(g, E, { x: cx, y: y + 110, kind: 'book', state: 'open', w: 200, page: 0.35, n: 2 });
      },
      () => {
        P.paper(g, E, { x: cx - 110, y: y + 160, kind: 'scroll', state: 'open', w: 150 });
        P.paper(g, E, { x: cx + 90, y: y + 120, kind: 'scroll', tie: true, w: 160, rot: 20 });
        P.paper(g, E, { x: cx + 100, y: y + 220, kind: 'book', w: 120, rot: -6 });
      },
      () => {
        P.paper(g, E, { x: cx - 110, y: y + 160, kind: 'tablet', w: 140 });
        P.paper(g, E, { x: cx + 100, y: y + 200, kind: 'cards', w: 50 });
        P.paper(g, E, { x: cx + 60, y: y + 60, kind: 'sheet', state: 'crumpled', w: 90 });
      },
      () => {
        P.paper(g, E, { x: x + 40, y: y + 50, kind: 'tags', w: 380, n: 7 });
      },
      () => {
        ['quill', 'brush', 'stylus', 'pencil', 'pen', 'chalk'].forEach((kind, k) =>
          P.pen(g, E, { x: x + 60 + k * 70, y: y + 150, kind: kind as 'quill', rot: -20 + k * 8 }),
        );
      },
      () => {
        P.vessel(g, E, { x: cx - 160, y: fy - 30, kind: 'mug', steam: true, t: 0.5, size: 0.9 });
        P.vessel(g, E, { x: cx - 60, y: fy - 30, kind: 'goblet' });
        P.vessel(g, E, { x: cx + 40, y: fy - 30, kind: 'bottle', tilt: -20 });
        P.vessel(g, E, { x: cx + 150, y: fy - 30, kind: 'jug', state: 'broken' });
      },
      () => {
        P.vessel(g, E, { x: cx - 120, y: fy - 10, kind: 'plate' });
        P.food(g, E, { x: cx - 120, y: fy - 40, kind: 'loaf', state: 'bitten', size: 0.8 });
        P.food(g, E, { x: cx + 30, y: fy - 50, kind: 'fish', rot: -10 });
        P.food(g, E, { x: cx + 140, y: fy - 120, kind: 'fruit' });
        P.food(g, E, { x: cx + 150, y: fy - 40, kind: 'cheese', state: 'rotten', size: 0.7 });
      },
    ][i]?.();
  });
}

/** Sheet 3: weapons, tools, vehicles and structure pieces. */
function paintGear(g: Paint2D): void {
  cells(g, 4, 3, (x, y, w, h, i) => {
    const fy = y + h * 0.86;
    const cx = x + w / 2;
    [
      () => {
        P.weapon(g, E, { x: x + 80, y: y + 80, kind: 'sword', gleam: 0.8 });
        P.weapon(g, E, { x: x + 80, y: y + 160, kind: 'sword', state: 'sheathed', size: 0.9 });
        P.weapon(g, E, { x: x + 80, y: y + 240, kind: 'sword', state: 'broken', wear: 0.9 });
      },
      () => {
        P.weapon(g, E, { x: x + 40, y: y + 90, kind: 'spear', size: 0.65, rot: -6 });
        P.weapon(g, E, { x: x + 80, y: y + 200, kind: 'club', size: 0.8 });
        P.weapon(g, E, { x: x + 260, y: y + 180, kind: 'dagger', rot: 40, state: 'bent' });
      },
      () => {
        P.weapon(g, E, {
          x: cx - 100,
          y: y + 160,
          kind: 'shield',
          size: 0.7,
          wear: 0.7,
          state: 'broken',
        });
        P.weapon(g, E, { x: cx + 40, y: y + 230, kind: 'axe', rot: -60, size: 0.7 });
      },
      () => {
        P.tool(g, E, { x: x + 60, y: y + 70, kind: 'hammer', size: 0.8 });
        P.tool(g, E, { x: x + 60, y: y + 170, kind: 'key', size: 0.8 });
        P.tool(g, E, { x: x + 300, y: y + 170, kind: 'key', size: 0.6, turn: 0.6, rot: 10 });
        P.tool(g, E, { x: x + 80, y: y + 250, kind: 'saw', size: 0.6 });
      },
      () => {
        P.tool(g, E, { x: x + 40, y: y + 70, kind: 'shovel', size: 0.45 });
        P.tool(g, E, { x: x + 40, y: y + 170, kind: 'broom', size: 0.45 });
        P.tool(g, E, { x: x + 70, y: y + 250, kind: 'wrench', size: 0.8, state: 'broken' });
      },
      () => {
        P.tool(g, E, { x: cx - 120, y: y + 60, kind: 'stick', rot: 100, size: 0.7 });
        P.tool(g, E, { x: cx + 60, y: y + 120, kind: 'stamp', rot: 90, size: 1.2 });
      },
      () => {
        P.cart(g, E, { x: cx, y: fy, kind: 'handcart', load: 'straw', size: 0.6, roll: 40 });
      },
      () => {
        P.cart(g, E, { x: cx - 60, y: fy, kind: 'barrow', size: 0.6, load: 'stone' });
        P.cart(g, E, { x: cx + 150, y: fy, kind: 'wagon', size: 0.3, state: 'broken' });
      },
      () => {
        P.boat(g, E, { x: cx - 70, y: fy - 20, kind: 'rowboat', size: 0.6, t: 0.4 });
        P.boat(g, E, { x: cx + 160, y: fy + 10, kind: 'raft', size: 0.35, state: 'sinking' });
      },
      () => {
        P.column(g, E, { x: x + 70, y: fy, h: 280, w: 60 });
        P.column(g, E, { x: x + 170, y: fy, h: 280, w: 50, kind: 'square', state: 'broken' });
        P.column(g, E, { x: x + 260, y: fy, h: 280, w: 40, kind: 'timber' });
        P.column(g, E, { x: x + 350, y: fy, h: 280, w: 30, kind: 'iron' });
      },
      () => {
        P.arch(g, E, { x: cx - 70, y: fy, w: 200, h: 260, thick: 40, state: 'cracked', wear: 0.6 });
        P.ladder(g, E, { x0: cx + 140, y0: fy, x1: cx + 90, y1: y + 30, width: 50 });
      },
      () => {
        P.panel(g, E, { x: x + 30, y: y + 30, w: 200, h: 200, tape: true, wear: 0.6 });
        P.board(g, E, { x: cx + 60, y: y + 230, len: 260, rot: -10 });
        P.board(g, E, { x: cx + 120, y: y + 120, len: 110, w: 46, kind: 'tile' });
        P.bell(g, E, { x: cx + 110, y: y + 20, size: 0.7, swing: 22 });
      },
    ][i]?.();
  });
}

/** Instruments: controls mid-change, readouts, displays, consoles. */
function paintInstruments(g: Paint2D): void {
  cells(g, 4, 3, (x, y, w, h, i) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    [
      () => {
        [0, 0.5, 1].forEach((pull, k) =>
          I.lever(g, E, {
            x: x + 110 + k * 130,
            y: cy + 60,
            pull,
            size: 0.8,
            tone: k === 2 ? 'RED' : 'BLACK',
          }),
        );
      },
      () => {
        I.joystick(g, E, { x: cx - 100, y: cy + 110, dx: -0.6, dy: 0.3, size: 0.9 });
        I.joystick(g, E, { x: cx + 100, y: cy + 110, dx: 0.8, press: 1, size: 0.9 });
      },
      () => {
        I.dial(g, E, { x: cx - 120, y: cy, r: 50, turn: 0.2 });
        I.dial(g, E, { x: cx + 10, y: cy, r: 40, turn: 0.85, tone: 'BROWN' });
        I.dial(g, E, { x: cx + 140, y: cy, r: 60, kind: 'wheel', turn: 0.3 });
      },
      () => {
        I.button(g, E, { x: cx - 130, y: cy, r: 32 });
        I.button(g, E, { x: cx, y: cy, r: 32, press: 1, lit: true, kind: 'mushroom' });
        I.button(g, E, { x: cx + 130, y: cy, r: 30, guard: 0.7, kind: 'square', tone: 'MUSTARD' });
      },
      () => {
        I.gauge(g, E, { x: cx - 100, y: cy, r: 90, value: 0.08, tremble: 1, t: 0.25 });
        I.gauge(g, E, { x: cx + 120, y: cy, r: 70, value: 0.7, zone: 'high' });
      },
      () => {
        I.switchPanel(g, E, {
          x: x + 70,
          y: cy - 60,
          cols: 7,
          rows: 3,
          gap: 44,
          flip: 9,
          press: 0.6,
        });
      },
      () => {
        I.keypad(g, E, { x: cx - 90, y: y + 40, press: 4, lit: 9, key: 50 });
      },
      () => {
        I.lights(g, E, { x: x + 60, y: cy - 60, n: 6, lit: '101101', t: 0, blink: true });
        I.lights(g, E, {
          x: x + 90,
          y: cy + 60,
          n: 2,
          kind: 'block',
          size: 50,
          lit: '10',
          tone: 'FIRE',
        });
      },
      () => {
        I.screen(g, E, { x: x + 30, y: y + 40, w: 190, h: 130, kind: 'radar', t: 0.6, value: 0.7 });
        I.screen(g, E, { x: x + 250, y: y + 40, w: 190, h: 130, kind: 'scope', t: 0.3 });
        I.screen(g, E, { x: x + 140, y: y + 200, w: 200, h: 120, kind: 'bars', value: 0.4 });
      },
      () => {
        I.flipBoard(g, E, { x: cx - 100, y: cy + 20, w: 150, h: 110, side: 'up' });
        I.flipBoard(g, E, { x: cx + 110, y: cy + 20, w: 150, h: 110, side: 'down', flip: 0.3 });
      },
      () => {
        I.counter(g, E, { x: cx, y: cy - 40, w: 300, tick: 3 });
        I.counter(g, E, { x: cx, y: cy + 90, w: 220, tick: 4, rot: -6, rods: 9 });
      },
      () => {
        I.console(g, E, {
          x: cx,
          y: cy + 60,
          w: 440,
          h: 200,
          elements: [
            { type: 'gauge', value: 0.2 },
            { type: 'switches', cols: 3, rows: 3, flip: 4, press: 1 },
            { type: 'lights', n: 3, lit: '110' },
            { type: 'lever', pull: 0.7 },
          ],
        });
      },
    ][i]?.();
  });
}

/** Crowd: rows with tiers cheering, every reaction, foreground pieces. */
function paintCrowd(g: Paint2D): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#7c7258';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#5a4c3a';
  g.fillRect(0, 700, W, 380);
  K.rows(g, E, {
    x0: 40,
    x1: 940,
    y: 600,
    rows: 3,
    s: 0.62,
    step: 90,
    tiers: true,
    reaction: 'cheer',
    t: 1.2,
    t0: 0.5,
    density: 1.1,
    seed: 31,
  });
  K.rows(g, E, {
    x0: 1000,
    x1: 1880,
    y: 600,
    rows: 2,
    s: 0.6,
    view: 'back',
    reaction: 'wave',
    mix: 0.5,
    t: 0.9,
    palette: 'robes',
    seed: 47,
  });
  const reactions = [
    'stand',
    'cheer',
    'gasp',
    'hush',
    'wave',
    'point',
    'lean',
    'mutter',
    'work',
    'hold',
    'sit',
    'cover',
  ] as const;
  reactions.forEach((reaction, k) => {
    K.figure(g, E, {
      x: 90 + k * 140,
      y: 960,
      s: 0.72,
      view: k % 3 === 2 ? 1 : 0,
      reaction,
      t: 0.55,
      palette: k % 2 ? 'muted' : 'office',
      seed: 300 + k * 11,
    });
  });
  K.foreground(g, E, { kind: 'heads', x: 1500, y: 1080, s: 0.5, n: 4, w: 600, bob: true, t: 0.3 });
  K.foreground(g, E, { kind: 'arm', x: 1960, y: 760, toward: [1500, 600], s: 0.7 });
  K.foreground(g, E, { kind: 'back', x: 60, y: 1130, s: 0.55 });
}

const cast = (namespaces: Readonly<Record<string, unknown>>, id: string): InkPerson =>
  personFromModule(namespaces[id], `kit-ext/people/${id}.js`);

/** Acting: two people mid-gag per cell (3 x 2), on sheet 0 or 1. */
function paintActing(
  g: Paint2D,
  namespaces: Readonly<Record<string, unknown>>,
  page: number,
): void {
  const one = cast(namespaces, 'nightBaker');
  const two = cast(namespaces, 'guidance');
  cells(g, 3, 2, (x, y, w, h, i) => {
    const fy = y + h * 0.9;
    // stage each pair within reach of its gag: far apart for blades, bows, falls, turns
    const gap = [0, 5, 6, 8, 10].includes(page * 6 + i) ? 0.2 : page * 6 + i === 4 ? 0.08 : 0.11;
    const a = { who: one, x: x + w * (0.5 - gap), y: fy, s: 0.42, view: 1 } as const;
    const b = { who: two, x: x + w * (0.5 + gap), y: fy, s: 0.4, view: -1 } as const;
    const draw = (res: { readonly a: object; readonly b: object }, t: number) => {
      one.draw(g, E, { ...res.a, t });
      two.draw(g, E, { ...res.b, t });
    };
    const gag = page * 6 + i;
    if (gag === 0) {
      // the swords meet point to point in front of them (gap = the blade's length)
      const res = A.clink({ a, b, t: 0.5, t0: 0, gap: 75 });
      draw(res, 0.5);
      if (res.gripA && res.gripB) {
        P.weapon(g, E, { x: res.gripA[0], y: res.gripA[1], rot: res.rotA ?? 0, size: 0.25 });
        P.weapon(g, E, { x: res.gripB[0], y: res.gripB[1], rot: res.rotB ?? 0, size: 0.25 });
      }
      if (res.impact) F.impact(g, E, { ...res.impact, t: 0.5, size: 0.6 });
    }
    if (gag === 1) {
      const res = A.handOver({ a, b, t: 0.6, t0: 0, weight: 0.8 });
      draw(res, 0.6);
      if (res.item)
        P.container(g, E, { x: res.item.x, y: res.item.y + 30, kind: 'bale', size: 0.35 });
    }
    if (gag === 2) {
      const res = A.dropCatch({ a, b, t: 0.45, t0: 0 });
      draw(res, 0.45);
      if (res.item)
        P.vessel(g, E, {
          x: res.item.x,
          y: res.item.y,
          kind: 'cup',
          tilt: res.item.rot,
          size: 0.5,
        });
    }
    if (gag === 3) draw(A.handshake({ a, b, t: 0.8, t0: 0 }), 0.8);
    if (gag === 4) draw(A.push({ a, b, t: 0.5, t0: 0 }), 0.5);
    if (gag === 5)
      draw(
        A.bow({ a: { ...a, view: 2 }, b: { ...b, view: -2 }, t: 1.2, t0: 0, depth: 22, outdo: 12 }),
        1.2,
      );
    if (gag === 6) draw(A.stumble({ a, b, t: 0.3, t0: 0 }), 0.3);
    if (gag === 7) draw(A.flinch({ a, b, t: 0.3, t0: 0 }), 0.3);
    if (gag === 8) draw(A.pointTurn({ a, b: { ...b, view: 3 }, t: 0.75, t0: 0 }), 0.75);
    if (gag === 9) {
      const res = A.tug({ a, b, t: 1.0, t0: 0, len: 120 });
      draw(res, 1.0);
      if (res.item) P.board(g, E, { x: res.item.x, y: res.item.y, len: 150, w: 18, nails: false });
    }
    if (gag === 10) {
      const res = A.doubleTake({ a, b, t: 0.7, t0: 0 });
      draw(res, 0.7);
      F.marks(g, E, { x: a.x + 60, y: fy - 300, t: 0.7, size: 0.6 });
    }
    if (gag === 11) draw(A.handOn({ a, b, t: 0.7, t0: 0, on: 'shoulderNear', squeeze: true }), 0.7);
  });
}

/** Effects at mid-action. */
function paintFx(g: Paint2D): void {
  cells(g, 4, 3, (x, y, w, h, i) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const fy = y + h * 0.86;
    [
      () => F.dust(g, E, { x: cx, y: fy, t: 0.4, size: 0.7, spread: 0.6 }),
      () => F.impact(g, E, { x: cx, y: cy, t: 0.1 }),
      () => F.impact(g, E, { x: cx, y: cy, t: 0.17, kind: 'star', size: 0.8 }),
      () => {
        F.spark(g, E, { x: cx - 90, y: cy, t: 0.17 });
        F.spark(g, E, { x: cx + 90, y: cy + 40, t: 0.17, kind: 'sparks' });
      },
      () => F.sweat(g, E, { x: cx, y: cy - 40, t: 0.5, n: 5, spread: 80, size: 1.6 }),
      () => {
        F.steam(g, E, { x: cx - 60, y: cy + 80, t: 0.3 });
        F.smoke(g, E, { x: cx + 80, y: cy + 80, t: 0.6, n: 1 });
      },
      () => {
        F.marks(g, E, { x: cx - 60, y: cy, t: 0.1 });
        F.marks(g, E, { x: cx + 60, y: cy, t: 0.1, dir: -1 });
      },
      () => F.shakeLines(g, E, { x: cx + 40, y: cy - 120, t: 0.1, kind: 'slam' }),
      () => {
        F.shakeLines(g, E, { x: cx - 100, y: cy - 40, t: 0.1, kind: 'clang', size: 1.4 });
        F.shakeLines(g, E, { x: cx + 120, y: cy - 40, t: 0.1, kind: 'click' });
      },
      () => F.ripple(g, E, { x: cx, y: cy, r: 40, t: 0.25 }),
      () => {
        const [dx] = F.shake({ t: 0.09, px: 20 });
        P.container(g, E, { x: cx + dx, y: fy, kind: 'crate', size: 0.8 });
        F.dust(g, E, { x: cx, y: fy, t: 0.2, size: 0.25 });
      },
      () => {
        P.weapon(g, E, { x: x + 80, y: cy, kind: 'sword', size: 0.9 });
        F.spark(g, E, { x: x + 240, y: cy - 4, t: 0.1 });
      },
    ][i]?.();
  });
}

/** `sheet`: props | goods | gear | instruments | crowd | acting-0 | acting-1 | fx. */
export function paintVocab(
  ctx: CanvasRenderingContext2D,
  sheet: string,
  namespaces: Readonly<Record<string, unknown>> = {},
): void {
  const g = asPaint2D(ctx);
  if (sheet === 'props') paintProps(g);
  if (sheet === 'goods') paintGoods(g);
  if (sheet === 'gear') paintGear(g);
  if (sheet === 'instruments') paintInstruments(g);
  if (sheet === 'crowd') paintCrowd(g);
  if (sheet === 'acting-0') paintActing(g, namespaces, 0);
  if (sheet === 'acting-1') paintActing(g, namespaces, 1);
  if (sheet === 'fx') paintFx(g);
}
