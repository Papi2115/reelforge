/**
 * Draws the timeline lanes onto a 2D canvas (PLAN.md#6.5): ruler, shots, narration (sentences when
 * zoomed out, words when zoomed in), sfx markers, waveform, cards, ambience/music ranges, snap
 * guide and playhead. Only what is in view is drawn (binary search for words), labels are fitted
 * by an average glyph width (no per-label measureText), so a 10-minute project draws in a few ms.
 */
import { formatRulerLabel, rulerTicks } from '../layout/timeline-scale.js';
import { peakColumns, type PeakSource } from './peak-columns.js';
import { itemKey } from './selection.js';
import {
  rangeLane,
  trackRow,
  TRACK_ROWS,
  LANES_HEIGHT,
  type TimelineHit,
  type TimelineModel,
  type TrackId,
} from './timeline-model.js';
import { timeToX, visibleRange, type TimelineView } from './timeline-view.js';
import { visibleSpans, WORD_DETAIL_PX_PER_SECOND } from './word-index.js';

export type DrawContext = Pick<
  CanvasRenderingContext2D,
  | 'fillRect'
  | 'strokeRect'
  | 'fillText'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'stroke'
  | 'fill'
  | 'save'
  | 'restore'
  | 'rect'
  | 'clip'
  | 'setLineDash'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textBaseline'
>;

export type WaveformView =
  | { readonly kind: 'ok'; readonly source: PeakSource }
  | { readonly kind: 'message'; readonly text: string };

export interface DrawInput {
  readonly model: TimelineModel;
  readonly view: TimelineView;
  readonly time: number;
  readonly selected: ReadonlySet<string>;
  readonly waveform: WaveformView;
  readonly hover: TimelineHit | undefined;
  /** Word boundary a drag snapped to (guide line). */
  readonly snapAt: number | undefined;
  /** Shown in rows without content. */
  readonly emptyText: Readonly<Partial<Record<TrackId, string>>>;
}

export interface DrawStats {
  readonly narration: 'words' | 'sentences';
  /** Blocks, markers and ranges drawn (virtualization check). */
  readonly items: number;
}

const COLORS = {
  lane: '#15161c',
  laneAlt: '#17181f',
  ruler: '#1d1f28',
  separator: '#21232d',
  tick: '#2b2e3a',
  muted: '#a0a3b5',
  text: '#ececf1',
  accent: '#ff8a3d',
  accentText: '#ffb07a',
  shot: ['#4a2a14', '#b8652b'],
  shotSelected: ['#7a3f17', '#ff8a3d'],
  word: ['#1c2a3b', '#3d5c80'],
  wordSelected: ['#2d4a6e', '#8fb8e8'],
  sfx: '#f2c14e',
  wave: '#5b8cc9',
  ambience: ['#18301f', '#3f7356'],
  music: ['#2a1f3d', '#7a5fb0'],
  rangeSelected: '#ececf1',
} as const;

const UI_FONT = "11px system-ui, 'Segoe UI', Roboto, sans-serif";
const MONO_FONT = "10px ui-monospace, 'Cascadia Mono', Consolas, monospace";
/** Average glyph width of UI_FONT, slightly generous so fitted labels never spill. */
const CHAR_PX = 6;
const LABEL_PAD = 3;

/** `text` cut (with an ellipsis) to roughly `px` pixels; empty when nothing useful fits. */
export function fitLabel(text: string, px: number): string {
  const chars = Math.floor((px - 2 * LABEL_PAD) / CHAR_PX);
  if (chars >= text.length) return text;
  return chars >= 3 ? `${text.slice(0, chars - 1)}…` : '';
}

interface Lane {
  readonly ctx: DrawContext;
  readonly view: TimelineView;
}

function block(
  lane: Lane,
  from: number,
  to: number,
  top: number,
  height: number,
  colors: readonly [string, string],
  label: string,
): void {
  const { ctx, view } = lane;
  const x0 = Math.max(timeToX(view, from), -2);
  const x1 = Math.min(timeToX(view, to), view.width + 2);
  const width = Math.max(x1 - x0, 1);
  ctx.fillStyle = colors[0];
  ctx.fillRect(x0, top, width, height);
  ctx.strokeStyle = colors[1];
  ctx.strokeRect(x0 + 0.5, top + 0.5, Math.max(width - 1, 0), height - 1);
  const text = fitLabel(label, width);
  if (text === '') return;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, Math.max(x0, 0) + LABEL_PAD, top + height / 2 + 0.5);
}

function drawRows(ctx: DrawContext, view: TimelineView): void {
  TRACK_ROWS.forEach((row, index) => {
    ctx.fillStyle = row.id === 'ruler' ? COLORS.ruler : index % 2 ? COLORS.lane : COLORS.laneAlt;
    ctx.fillRect(0, row.top, view.width, row.height);
    ctx.fillStyle = COLORS.separator;
    ctx.fillRect(0, row.top + row.height - 1, view.width, 1);
  });
}

function drawRuler(ctx: DrawContext, view: TimelineView): void {
  const row = trackRow('ruler');
  const { from, to } = visibleRange(view);
  ctx.font = MONO_FONT;
  for (const tick of rulerTicks(from, Math.min(to, view.duration), view.pxPerSecond)) {
    const x = Math.round(timeToX(view, tick)) + 0.5;
    ctx.fillStyle = COLORS.tick;
    ctx.fillRect(x - 0.5, row.top, 1, row.height);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(formatRulerLabel(tick), x + 4, row.top + row.height / 2 + 0.5);
  }
  ctx.font = UI_FONT;
}

function drawShots(lane: Lane, input: DrawInput): number {
  const { model, view, selected, hover } = input;
  const row = trackRow('shots');
  const { from, to } = visibleRange(view);
  let drawn = 0;
  model.shots.forEach((shot, index) => {
    if (shot.t1 < from || shot.t0 > to) return;
    const isSelected = selected.has(itemKey({ kind: 'shot', id: shot.id }));
    const colors = isSelected ? COLORS.shotSelected : COLORS.shot;
    block(
      lane,
      shot.t0,
      shot.t1,
      row.top + 3,
      row.height - 6,
      colors,
      `${shot.id} · ${shot.treatment}`,
    );
    drawn += 1;
    if (hover?.kind === 'boundary' && hover.left === index) {
      lane.ctx.fillStyle = COLORS.accent;
      lane.ctx.fillRect(Math.round(timeToX(view, shot.t1)) - 1, row.top + 1, 3, row.height - 2);
    }
  });
  return drawn;
}

function drawNarration(lane: Lane, input: DrawInput): { items: number; words: boolean } {
  const { model, view, selected } = input;
  const row = trackRow('narration');
  const { from, to } = visibleRange(view);
  const words = view.pxPerSecond >= WORD_DETAIL_PX_PER_SECOND;
  const spans = words ? model.words : model.sentences;
  const { start, end } = visibleSpans(spans, from, to);
  for (let index = start; index < end; index += 1) {
    const span = spans[index];
    if (!span) continue;
    let isSelected = false;
    if ('first' in span) {
      for (let word = span.first; word <= span.last && !isSelected; word += 1) {
        isSelected = selected.has(itemKey({ kind: 'word', index: word }));
      }
    } else {
      isSelected = selected.has(itemKey({ kind: 'word', index }));
    }
    const colors = isSelected ? COLORS.wordSelected : COLORS.word;
    block(lane, span.t, span.tEnd, row.top + 3, row.height - 6, colors, span.text);
  }
  return { items: end - start, words };
}

function drawSfx(lane: Lane, input: DrawInput): number {
  const { ctx, view } = lane;
  const row = trackRow('cues');
  const { from, to } = visibleRange(view);
  let drawn = 0;
  input.model.cues.sfx.forEach((cue, index) => {
    if (cue.t < from - 1 || cue.t > to) return;
    const x = Math.round(timeToX(view, cue.t));
    const isSelected = input.selected.has(itemKey({ kind: 'cue', track: 'sfx', index }));
    ctx.fillStyle = isSelected ? COLORS.text : COLORS.sfx;
    ctx.fillRect(x - 1, row.top + 3, isSelected ? 3 : 2, row.height - 6);
    ctx.beginPath();
    ctx.moveTo(x, row.top + 2);
    ctx.lineTo(x + 5, row.top + 7);
    ctx.lineTo(x, row.top + 12);
    ctx.lineTo(x - 5, row.top + 7);
    ctx.closePath();
    ctx.fill();
    const label = fitLabel(cue.label, 90);
    if (view.pxPerSecond >= 30 && label !== '') {
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(label, x + 7, row.top + row.height / 2 + 2);
    }
    drawn += 1;
  });
  return drawn;
}

function drawWaveform(ctx: DrawContext, view: TimelineView, waveform: WaveformView): boolean {
  if (waveform.kind !== 'ok') return false;
  const row = trackRow('audio');
  const { from } = visibleRange(view);
  const columns = peakColumns(waveform.source, from, 1 / view.pxPerSecond, Math.ceil(view.width));
  const middle = row.top + row.height / 2;
  const half = row.height / 2 - 2;
  ctx.fillStyle = COLORS.wave;
  for (let column = 0; column < columns.length; column += 1) {
    const peak = columns[column] ?? 0;
    if (peak === 0) continue;
    const height = Math.max(1, Math.pow(peak / 255, 0.7) * half);
    ctx.fillRect(column, middle - height, 1, height * 2);
  }
  return true;
}

function drawRanges(lane: Lane, input: DrawInput): number {
  const { view } = lane;
  const { from, to } = visibleRange(view);
  let drawn = 0;
  for (const track of ['ambience', 'music'] as const) {
    const area = rangeLane(track);
    input.model.cues[track].forEach((range, index) => {
      if (range.to < from || range.from > to) return;
      const isSelected = input.selected.has(itemKey({ kind: 'cue', track, index }));
      const colors = COLORS[track];
      const gain =
        range.gainDb === 0 ? '' : ` · ${range.gainDb > 0 ? '+' : ''}${String(range.gainDb)} dB`;
      block(
        lane,
        range.from,
        range.to,
        area.top + 1,
        area.height - 2,
        colors,
        `${range.label}${gain}`,
      );
      if (isSelected) {
        lane.ctx.strokeStyle = COLORS.rangeSelected;
        const x0 = timeToX(view, range.from);
        lane.ctx.strokeRect(
          x0 + 0.5,
          area.top + 1.5,
          timeToX(view, range.to) - x0 - 1,
          area.height - 3,
        );
      }
      drawn += 1;
    });
  }
  return drawn;
}

function drawEmpty(ctx: DrawContext, id: TrackId, text: string | undefined): void {
  if (text === undefined) return;
  const row = trackRow(id);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(text, 8, row.top + row.height / 2 + 0.5);
}

function drawGuides(ctx: DrawContext, input: DrawInput): void {
  const { view } = input;
  if (input.snapAt !== undefined) {
    const x = Math.round(timeToX(view, input.snapAt)) + 0.5;
    ctx.strokeStyle = COLORS.accentText;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LANES_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const x = Math.round(timeToX(view, input.time));
  if (x < -6 || x > view.width + 6) return;
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(x - 1, 0, 2, LANES_HEIGHT);
  ctx.beginPath();
  ctx.moveTo(x - 5, 0);
  ctx.lineTo(x + 5, 0);
  ctx.lineTo(x, 7);
  ctx.closePath();
  ctx.fill();
}

/** Draws everything (CSS px coordinates: the caller applies the device pixel ratio). */
export function drawTimeline(ctx: DrawContext, input: DrawInput): DrawStats {
  const { view, model, emptyText } = input;
  const lane: Lane = { ctx, view };
  ctx.lineWidth = 1;
  ctx.textBaseline = 'middle';
  ctx.font = UI_FONT;
  drawRows(ctx, view);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, view.width, LANES_HEIGHT);
  ctx.clip();
  drawRuler(ctx, view);
  const shots = drawShots(lane, input);
  const narration = drawNarration(lane, input);
  const sfx = drawSfx(lane, input);
  const wave = drawWaveform(ctx, view, input.waveform);
  const ranges = drawRanges(lane, input);
  if (model.shots.length === 0) drawEmpty(ctx, 'shots', emptyText.shots);
  if (model.words.length === 0) drawEmpty(ctx, 'narration', emptyText.narration);
  if (model.cues.sfx.length === 0) drawEmpty(ctx, 'cues', emptyText.cues);
  if (!wave) drawEmpty(ctx, 'audio', input.waveform.kind === 'message' ? input.waveform.text : '');
  drawEmpty(ctx, 'cards', emptyText.cards);
  if (model.cues.ambience.length + model.cues.music.length === 0) {
    drawEmpty(ctx, 'ambience', emptyText.ambience);
  }
  drawGuides(ctx, input);
  ctx.restore();
  return {
    narration: narration.words ? 'words' : 'sentences',
    items: shots + narration.items + sfx + ranges,
  };
}
