/**
 * `ink.titleCard({ title, subtitle?, cast, place?, accent? })` (PLAN.md#14.18, brief 11 addendum:
 * the opening frame is a ready thumbnail): the prototypes' title shot (`films/03-apollo-11/js/
 * shots/shots-a.js` 'title') as one call in look C `ink-poster`: the place behind (or a mud poster
 * field with one warm light), the episode's main people lined up at the bottom, the title as heavy
 * poster words thudding in on twos (two lines: the lead-in smaller, the hook big), then a subtitle
 * tag in the accent colour once the title has landed. Screen space (1920x1080 = the frame) under
 * whatever transform the painter set (a slow push-in like the prototype's), a pure function of the
 * stage time `t`.
 */
import { KitError } from '../../../errors.js';
import { C, H, W } from '../core.js';
import { DEFAULT_ENV } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { gloom, pool, rect, rough } from '../draw/scenery.js';
import type { PersonDrawOptions } from '../modules/person.js';
import { inkText, measureInkText, type TextTarget } from './ink-text.js';
import { posterWord, posterWordSettled } from './poster-word.js';

/** One person of the line-up: the person handle and how it stands. */
export interface TitleCast extends PersonDrawOptions {
  readonly person: {
    draw(g: Paint2D, env: { readonly t: number }, opts?: PersonDrawOptions): unknown;
  };
}

export interface TitlePlace {
  draw(g: Paint2D, env: { readonly t: number }, t: number, opts?: Record<string, unknown>): void;
}

export interface TitleCardSpec {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly cast?: readonly TitleCast[] | undefined;
  /** The place behind (`ctx.kit.places.<id>`); absent = a mud poster field with one light. */
  readonly place?: TitlePlace | undefined;
  readonly placeOptions?: Record<string, unknown> | undefined;
  /** Colour of the subtitle tag (default mustard). */
  readonly accent?: string | undefined;
  /** When the title starts thudding in (stage seconds, default 0.15). */
  readonly t0?: number | undefined;
}

export interface TitleCardResult {
  /** Stage time (s) the whole card has landed: the moment for the thumbnail. */
  readonly settled: number;
}

/** Widest a title line may be (px); a longer line shrinks. */
const MAX_LINE = 1720;
/** Prototype sizes: lead-in 104 px, the hook 150 px, at y 100 / 236. */
const LEAD = { size: 104, y: 100 } as const;
const HOOK = { size: 150, y: 236 } as const;
const SINGLE_Y = 170;
/** The second line starts this long after the first (the prototype's 0.15 -> 0.9). */
const SECOND_LINE_DELAY = 0.75;

/** The title as one or two lines: a long title splits at the word nearest a third of it. */
export function titleLines(title: string): readonly string[] {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.join(' ').length <= 16) return [words.join(' ')];
  let best = 1;
  let bestCost = Infinity;
  const total = words.join(' ').length;
  for (let cut = 1; cut < words.length; cut += 1) {
    const cost = Math.abs(words.slice(0, cut).join(' ').length - total * 0.42);
    if (cost < bestCost) {
      bestCost = cost;
      best = cut;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function fitted(target: TextTarget | undefined, line: string, size: number): number {
  const width = measureInkText(target, line, 'title', size);
  return width <= MAX_LINE ? size : Math.floor((size * MAX_LINE) / width);
}

function background(g: Paint2D, t: number, spec: TitleCardSpec): void {
  if (spec.place !== undefined) {
    spec.place.draw(g, { t }, t, spec.placeOptions ?? {});
    return;
  }
  rect(g, DEFAULT_ENV, 0, 0, W, H, C.OLIVE_D, { lw: 0, seed: 11 });
  pool(g, W / 2, H * 0.72, 760, 300, C.FIRE, 0.12);
  gloom(g, 0, 0, W, H, W / 2, H * 0.6, 720, C.INK, 0.3);
}

function subtitleTag(
  g: Paint2D,
  target: TextTarget | undefined,
  text: string,
  y: number,
  accent: string,
): void {
  const size = 44;
  const half = measureInkText(target, text, 'label', size) / 2 + 30;
  const cx = W / 2;
  // prettier-ignore
  rough(g, DEFAULT_ENV, [cx - half, y - 28, cx + half, y - 38, cx + half + 10, y + 30, cx - half - 10, y + 38], C.INK, { seed: 79, lw: 6, lineColor: accent });
  inkText(g, target, text, { role: 'label', x: cx + 5, y, size, fill: accent, rot: -1 });
}

function checkSpec(spec: unknown): TitleCardSpec {
  const o = spec as Partial<TitleCardSpec> | null;
  if (typeof o !== 'object' || o === null || typeof o.title !== 'string' || o.title.trim() === '') {
    throw new KitError(
      'invalid-params',
      'env.ink.titleCard({ title, subtitle?, cast: [{ person, view, pose, expr, x, y, s }], place?, accent? }): title must be a non-empty string',
    );
  }
  if (o.cast !== undefined && !Array.isArray(o.cast)) {
    throw new KitError('invalid-params', 'env.ink.titleCard: cast must be a list of people');
  }
  return o as TitleCardSpec;
}

/** Paints the title card at stage time `t`; returns when it has landed. */
export function titleCard(
  g: Paint2D,
  target: TextTarget | undefined,
  t: number,
  input: TitleCardSpec,
): TitleCardResult {
  const spec = checkSpec(input);
  const t0 = spec.t0 ?? 0.15;
  g.save();
  background(g, t, spec);
  for (const member of spec.cast ?? []) {
    const { person, ...opts } = member;
    person.draw(g, { t }, { t, ...opts });
  }
  const lines = titleLines(spec.title);
  const layout =
    lines.length === 1
      ? [{ line: lines[0] ?? '', size: HOOK.size, y: SINGLE_Y, start: t0, rot: -1 }]
      : [
          { line: lines[0] ?? '', size: LEAD.size, y: LEAD.y, start: t0, rot: -2 },
          {
            line: lines[1] ?? '',
            size: HOOK.size,
            y: HOOK.y,
            start: t0 + SECOND_LINE_DELAY,
            rot: 1,
          },
        ];
  let settled = t0;
  layout.forEach((entry, index) => {
    const size = fitted(target, entry.line, entry.size);
    posterWord(g, target, entry.line, t, {
      x: W / 2,
      y: entry.y,
      size,
      t0: entry.start,
      rot: entry.rot,
      seed: 77 + index * 13,
    });
    settled = Math.max(settled, posterWordSettled(entry.line, entry.start));
  });
  const last = layout.at(-1);
  if (spec.subtitle !== undefined && spec.subtitle.trim() !== '') {
    if (t >= settled) {
      const y = (last?.y ?? SINGLE_Y) + 126;
      subtitleTag(g, target, spec.subtitle.trim(), y, spec.accent ?? C.MUSTARD);
    }
  }
  g.restore();
  return { settled };
}
