/**
 * Resolves an automap spec against the shot's level and walk into a plan of plain numbers (what
 * draws on when, where the camera holds, where every label sits) and rejects what would read
 * badly: a room cell in a wall, a label off screen or under the narration box when it types, two
 * labels on top of each other, a second accent item, a replay that ends somewhere else than the
 * walk. Errors are sentences that say what to change. Pure: same inputs, same plan.
 */
import { textWidth, typeTimes, unsupportedChars } from '../core/font.js';
import { hash3 } from '../core/rand.js';
import type { CompiledLevel } from '../level/compile.js';
import type { CameraPath } from '../ray/camera.js';
import { handTextWidth, labelSize } from './automap-draw.js';
import type { AutomapSpec, RoomState } from './automap-spec.js';
import { mapGeometry, roomOfPoint, type MapGeometry } from './rooms.js';

export const SCREEN_CX = 320;
export const SCREEN_CY = 180;
export const ENTER_S = { unfold: 0.55, wipe: 0.5, cut: 0 } as const;
export const EXIT_S = { fold: 1.0, cut: 0 } as const;
/** The HUD narration box (labels there would be hidden) and the legend corner. */
const CAPTION = [24, 236, 380, 320] as const;
const LEGEND = [514, 288, 630, 318] as const;
const SAFE = [38, 22, 602, 338] as const;

export interface RoomPlan {
  readonly room: number;
  readonly state: Exclude<RoomState, 'hidden'>;
  readonly drawAt: number;
  readonly drawEnd: number;
  /** Where the pen starts (cells). */
  readonly entry: readonly [number, number];
  readonly label?: {
    readonly name: string;
    readonly sub: string;
    /** Map px (unscrolled) of the label's top-left. */
    readonly x: number;
    readonly y: number;
    readonly at: number;
    readonly tick: number;
  };
}

export interface AutomapPlan {
  readonly intent: string;
  readonly at: number;
  readonly until: number;
  readonly open: number;
  readonly foldAt: number;
  readonly enter: AutomapSpec['enter'];
  readonly exit: AutomapSpec['exit'];
  readonly scale: number;
  readonly geometry: MapGeometry;
  readonly rooms: readonly RoomPlan[];
  readonly replay?: { from: number; to: number; at: number; until: number };
  readonly marks: readonly { kind: 'objective' | 'item' | 'cross'; x: number; y: number; at: number }[];
  readonly note?: {
    text: string;
    x: number;
    y: number;
    to?: readonly [number, number];
    at: number;
    times: readonly number[];
  };
  /** Camera holds: from `at` the centre moves to (x, y) (cells). The first one is the start. */
  readonly camera: readonly { at: number; x: number; y: number }[];
  readonly legend: { done: string; ahead: string } | null;
}

export type Time = (when: number | string, what: string) => number;

interface Visit {
  readonly room: number;
  /** Path time it was entered and the point. */
  readonly t: number;
  readonly x: number;
  readonly y: number;
}

/** Rooms the walk enters between path times t0 and t1, in order. */
function visits(level: CompiledLevel, geometry: MapGeometry, path: CameraPath, t0: number, t1: number) {
  const out: Visit[] = [];
  for (let t = t0; t <= t1 + 1e-9; t += 0.05) {
    const p = path.at(Math.min(t, t1));
    const room = roomOfPoint(geometry, level, p.x, p.y);
    if (room >= 0 && !out.some((visit) => visit.room === room))
      out.push({ room, t: Math.min(t, t1), x: p.x, y: p.y });
  }
  return out;
}

function drawLength(geometry: MapGeometry, room: number): number {
  const weight = (geometry.lines[room] ?? []).reduce((s, l) => s + (l.a1 - l.a0) * l.speed, 0);
  return Math.min(1.1, Math.max(0.4, weight * 0.018));
}

function checkText(text: string, where: string, maxWidth: number, fail: (m: string) => never) {
  const bad = unsupportedChars(text);
  if (bad.length > 0)
    fail(`${where}: "${text}" has characters the pixel face cannot draw: ${bad.join(' ')}`);
  if (textWidth(text) > maxWidth)
    fail(`${where}: "${text}" is too wide (max ${String(maxWidth)} px); shorten it`);
}

type Box = readonly [number, number, number, number];
const overlaps = (a: Box, b: Box): boolean =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Camera centre (cells) at t from the holds (the move itself is eased in automap.ts). */
export function holdAt(camera: AutomapPlan['camera'], t: number): { x: number; y: number } {
  let current = camera[0] ?? { x: 0, y: 0 };
  for (const key of camera) if (key.at + 1.1 <= t) current = key;
  return current;
}

export function planAutomap(
  spec: AutomapSpec,
  level: CompiledLevel,
  path: CameraPath,
  time: Time,
  fail: (message: string) => never,
): AutomapPlan {
  const geometry = mapGeometry(level);
  const s = spec.scale;
  const at = time(spec.at, 'automap.at');
  const until = time(spec.until, 'automap.until');
  const open = at + ENTER_S[spec.enter];
  const foldAt = until - EXIT_S[spec.exit];
  if (foldAt - open < 1.2)
    fail(`automap: ${String(until - at)} s is too short; the map needs >= 1.2 s open between unfolding and folding`);
  let replay: AutomapPlan['replay'];
  if (spec.replay !== undefined) {
    const to = spec.replay.to === undefined ? at : time(spec.replay.to, 'automap.replay.to');
    if (to <= spec.replay.from) fail('automap.replay: to must be after from (path times)');
    const dur = spec.replay.dur ?? Math.min(3.2, Math.max(1.2, (to - spec.replay.from) * 0.35));
    replay = { from: spec.replay.from, to, at: open + 0.1, until: open + 0.1 + dur };
    if (replay.until > foldAt) fail('automap.replay: the replay must end before the map folds');
    const a = path.at(to);
    const b = path.at(replay.until);
    if (Math.hypot(a.x - b.x, a.y - b.y) > 0.3)
      fail('automap.replay: the walk moves between replay.to and the replay end; hold the path still while the map is up');
  }
  const endTime = replay?.to ?? Math.max(at, 0);
  const walked = visits(level, geometry, path, replay?.from ?? 0, endTime);
  const realTime = (pathT: number): number =>
    replay === undefined || pathT <= replay.from
      ? open
      : replay.at + ((pathT - replay.from) / (replay.to - replay.from)) * (replay.until - replay.at);
  const listed = spec.rooms.map((room, i) => {
    const id = roomOfPoint(geometry, level, room.cell[0], room.cell[1]);
    if (id < 0)
      fail(`automap.rooms[${String(i)}]: [${String(room.cell[0])}, ${String(room.cell[1])}] is not inside a room (a wall, a door or outside the grid)`);
    if (room.label !== '') checkText(room.label, `automap.rooms[${String(i)}].label`, 140, fail);
    if (room.sub !== '') checkText(room.sub, `automap.rooms[${String(i)}].sub`, 140, fail);
    return { ...room, id, index: i };
  });
  const hidden = new Set(listed.filter((r) => r.state === 'hidden').map((r) => r.id));
  const plans: RoomPlan[] = [];
  let lastDone = open;
  walked.forEach((visit, k) => {
    if (hidden.has(visit.room)) return;
    const own = listed.find((r) => r.id === visit.room);
    if (own !== undefined && own.state !== 'done') return;
    const drawAt =
      own?.at !== undefined
        ? time(own.at, 'automap.rooms.at')
        : replay !== undefined
          ? realTime(visit.t)
          : spec.enter === 'unfold' && visit.t <= at
            ? at
            : open + 0.1 + k * 0.55 * (0.85 + 0.3 * hash3(k, visit.room, 3));
    const instant = replay === undefined && spec.enter === 'unfold' && visit.t <= at && own?.at === undefined;
    const drawEnd = instant ? drawAt : drawAt + drawLength(geometry, visit.room);
    lastDone = Math.max(lastDone, drawEnd);
    plans.push({ room: visit.room, state: 'done', drawAt, drawEnd, entry: [visit.x, visit.y] });
  });
  const firstMove = spec.camera.length > 0 ? time(spec.camera[0]?.at ?? 0, 'automap.camera') : -1;
  let stagger = Math.max(firstMove > open ? firstMove + 0.06 : lastDone + 0.2, open + 0.3);
  for (const room of listed) {
    if (room.state === 'hidden' || plans.some((plan) => plan.room === room.id)) continue;
    const box = geometry.rooms[room.id];
    const drawAt = room.at === undefined ? stagger : time(room.at, 'automap.rooms.at');
    if (room.at === undefined) stagger += 0.24 + 0.12 * hash3(room.index, 5, 9);
    const entry: [number, number] = [box?.x0 ?? 0, ((box?.y0 ?? 0) + (box?.y1 ?? 0)) / 2];
    const dur = room.state === 'done' ? drawLength(geometry, room.id) : 0.5;
    plans.push({ room: room.id, state: room.state, drawAt, drawEnd: drawAt + dur, entry });
  }
  const withLabels = plans.map((plan) => {
    const own = listed.find((r) => r.id === plan.room);
    if (own === undefined || own.label === '') return plan;
    const box = geometry.rooms[plan.room];
    const [, h] = labelSize(own.label, own.sub);
    const x = own.labelAt !== undefined ? own.labelAt[0] * s : (box?.x0 ?? 0) * s + 2;
    const above = (box?.y0 ?? 0) * s - h - 5;
    const y = own.labelAt !== undefined ? own.labelAt[1] * s : above >= 0 ? above : (box?.y1 ?? 0) * s + 4;
    const labelAt = plan.state === 'done' ? Math.max(plan.drawAt, plan.drawEnd - 0.1) : plan.drawAt + 0.13;
    const pace = 0.025 * (own.label.length + own.sub.length + 1) * 1.3;
    const tick = plan.state === 'done' ? labelAt + pace + 0.22 : -1;
    return { ...plan, label: { name: own.label, sub: own.sub, x, y, at: labelAt, tick } };
  });
  const items = spec.marks.filter((mark) => mark.kind === 'item');
  if (items.length > 1) fail('automap.marks: only ONE item mark (it is the accent: THE item of the story)');
  const marks = spec.marks.map((mark, i) => {
    const [x, y] = mark.pos;
    if (x < 0 || y < 0 || x > level.w || y > level.h)
      fail(`automap.marks[${String(i)}]: [${String(x)}, ${String(y)}] is outside the grid`);
    return { kind: mark.kind, x, y, at: time(mark.at, 'automap.marks.at') };
  });
  const startCam = spec.enter === 'cut' ? fitCentre(geometry, withLabels) : path.at(at);
  const camera = [{ at, x: startCam.x, y: startCam.y }];
  for (const key of spec.camera) camera.push({ at: time(key.at, 'automap.camera.at'), x: key.x, y: key.y });
  if (spec.camera.length === 0 && spec.enter !== 'cut') {
    const fit = fitCentre(geometry, withLabels);
    if (Math.hypot(fit.x - startCam.x, fit.y - startCam.y) > 1) camera.push({ at: open + 0.05, ...fit });
  }
  camera.sort((a, b) => a.at - b.at);
  let note: AutomapPlan['note'];
  if (spec.note !== undefined) {
    const { text, pos, to } = spec.note;
    checkText(text, 'automap.note', 400, fail);
    const noteAt = time(spec.note.at, 'automap.note.at');
    note = { text, x: pos[0] * s, y: pos[1] * s, at: noteAt, times: typeTimes(text, 4747, noteAt, 0.026), ...(to === undefined ? {} : { to }) };
  }
  const states = new Set(withLabels.map((plan) => plan.state));
  const legend =
    spec.legend === false || !states.has('done') || !(states.has('ahead') || states.has('next'))
      ? null
      : spec.legend === true
        ? { done: 'DONE', ahead: 'AHEAD' }
        : spec.legend;
  if (legend !== null) {
    checkText(legend.done, 'automap.legend.done', 80, fail);
    checkText(legend.ahead, 'automap.legend.ahead', 80, fail);
  }
  const plan: AutomapPlan = { intent: spec.intent, at, until, open, foldAt, enter: spec.enter, exit: spec.exit, scale: s, geometry, rooms: withLabels, marks, camera, legend, ...(replay === undefined ? {} : { replay }), ...(note === undefined ? {} : { note }) };
  checkLayout(plan, fail);
  return plan;
}

function fitCentre(geometry: MapGeometry, plans: readonly RoomPlan[]): { x: number; y: number } {
  const boxes = plans.map((plan) => geometry.rooms[plan.room]).filter((box) => box !== undefined);
  if (boxes.length === 0) return { x: 0, y: 0 };
  const x0 = Math.min(...boxes.map((box) => box.x0));
  const x1 = Math.max(...boxes.map((box) => box.x1));
  const y0 = Math.min(...boxes.map((box) => box.y0));
  const y1 = Math.max(...boxes.map((box) => box.y1));
  // Sit a little above the middle: the narration box takes the bottom of the frame.
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 1.5 };
}

/** Screen box of map px (x, y, w, h) when the camera holds at `centre` (cells). */
function onScreen(plan: AutomapPlan, centre: { x: number; y: number }, x: number, y: number, w: number, h: number): Box {
  const sx = SCREEN_CX + x - centre.x * plan.scale;
  const sy = SCREEN_CY + y - centre.y * plan.scale;
  return [sx, sy, sx + w, sy + h];
}

function checkLayout(plan: AutomapPlan, fail: (message: string) => never): void {
  const placed: { box: Box; what: string }[] = [];
  const inSafe = (box: Box): boolean =>
    box[0] >= SAFE[0] && box[1] >= SAFE[1] && box[2] <= SAFE[2] && box[3] <= SAFE[3];
  const check = (what: string, x: number, y: number, w: number, h: number, t: number): void => {
    const box = onScreen(plan, holdAt(plan.camera, t + 0.3), x, y, w, h);
    if (!inSafe(box))
      fail(`${what} is off screen when it appears (t ${t.toFixed(2)}); pan the camera there first or move it (labelAt / pos)`);
    if (overlaps(box, CAPTION))
      fail(`${what} sits under the narration box when it appears (t ${t.toFixed(2)}); move it up (labelAt / pos) or pan the camera`);
    if (plan.legend !== null && overlaps(box, LEGEND))
      fail(`${what} sits on the legend (bottom right); move it`);
    const map: Box = [x - 3, y - 3, x + w + 3, y + h + 3];
    const clash = placed.find((other) => overlaps(other.box, map));
    if (clash !== undefined) fail(`${what} collides with ${clash.what}; move one of them (labelAt / pos)`);
    placed.push({ box: map, what });
  };
  plan.rooms.forEach((room) => {
    if (room.label === undefined) return;
    const [w, h] = labelSize(room.label.name, room.label.sub);
    check(`automap label "${room.label.name}"`, room.label.x - 14, room.label.y, w + 14, h, room.label.at);
  });
  if (plan.note !== undefined) {
    const { text, x, y, at } = plan.note;
    const w = handTextWidth(text);
    check(`automap.note "${text}"`, x, y - Math.round(w * 0.035), w, 16 + Math.round(w * 0.035), at);
  }
}
