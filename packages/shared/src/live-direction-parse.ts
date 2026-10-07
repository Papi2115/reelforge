/**
 * Command parser of live co-direction (PLAN.md#12.14): a short English or Polish command typed
 * while the film plays ("slower", "ciemniej", "arrow on the word light", "podkreśl szkło",
 * "zoom in", "usuń strzałkę", "undo") becomes the shot's next direction plus a confirmation line.
 * Pure, deterministic, local and instant. Anything it does not understand ("make it a terminal")
 * is `needs-claude`: the app sends it to the chat as a rebuild request for the shot.
 */
import {
  DIRECTION_RATE_MAX,
  DIRECTION_RATE_MIN,
  DIRECTION_ZOOM_MAX,
  normalizeDirection,
  type ShotDirection,
} from './live-direction.js';
import { addOverlay, kindOf, removeOverlays, round3 } from './live-direction-overlays.js';
import { foldText, type DirectionWord } from './live-direction-words.js';

export interface DirectionCommandContext {
  readonly shot: { readonly id: string; readonly t0: number; readonly t1: number };
  /** The shot's direction now (directions.json). */
  readonly current: ShotDirection | undefined;
  /** All timed words of the film (words.json order). */
  readonly words: readonly DirectionWord[];
  /** Film time of the playhead. */
  readonly playhead: number;
  /** Last point clicked in the preview (normalized), used when no region is named. */
  readonly point?: { readonly x: number; readonly y: number } | undefined;
}

export type DirectionCommandResult =
  | {
      readonly kind: 'direction';
      readonly shotId: string;
      /** The shot's next direction (undefined = cleared). */
      readonly next: ShotDirection | undefined;
      readonly confirmation: string;
    }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | { readonly kind: 'needs-claude'; readonly shotId: string; readonly request: string }
  | { readonly kind: 'error'; readonly message: string };

const RATE_STEP = 0.2;
const DIM_STEP = 0.25;
const ZOOM_STEP = 0.1;

/** Lowercase words without diacritics or punctuation (quotes kept for "quoted words"). */
function words(command: string): string[] {
  return command
    .split(/\s+/)
    .map((part) => foldText(part))
    .filter((part) => part !== '');
}

const FILLERS = new Set(['please', 'prosze', 'a', 'bit', 'little', 'troche', 'nieco', 'more']);
const STRONG = new Set(['much', 'lot', 'duzo', 'znacznie', 'mocno', 'bardzo', 'bardziej']);

function stepped(value: number, step: number, min: number, max: number): number {
  return round3(Math.min(max, Math.max(min, value + step)));
}

function confirmationRate(rate: number): string {
  return rate === 1 ? 'normal speed' : `${rate.toFixed(1)}x between the spoken hits`;
}

interface Parsed {
  readonly tokens: readonly string[];
  readonly strength: number;
}

function prepare(command: string): Parsed {
  const all = words(command);
  const strength = all.some((word) => STRONG.has(word)) ? 2 : 1;
  return { tokens: all.filter((word) => !FILLERS.has(word) && !STRONG.has(word)), strength };
}

type Simple = (current: ShotDirection, strength: number) => ShotDirection | string;

/** Commands without arguments: the phrase (folded, fillers dropped) -> how it changes the shot. */
const SIMPLE: readonly (readonly [RegExp, Simple, (next: ShotDirection) => string])[] = [
  [
    /^(slower|slow down|slow|wolniej|zwolnij|spowolnij)$/,
    (current, strength) => {
      const rate = current.rate ?? 1;
      if (rate <= DIRECTION_RATE_MIN) return 'Already at the slowest the hits allow.';
      return {
        ...current,
        rate: stepped(rate, -RATE_STEP * strength, DIRECTION_RATE_MIN, DIRECTION_RATE_MAX),
      };
    },
    (next) => `Slower: ${confirmationRate(next.rate ?? 1)}`,
  ],
  [
    /^(faster|speed up|quicker|szybciej|przyspiesz)$/,
    (current, strength) => {
      const rate = current.rate ?? 1;
      if (rate >= DIRECTION_RATE_MAX) return 'Already at the fastest the hits allow.';
      return {
        ...current,
        rate: stepped(rate, RATE_STEP * strength, DIRECTION_RATE_MIN, DIRECTION_RATE_MAX),
      };
    },
    (next) => `Faster: ${confirmationRate(next.rate ?? 1)}`,
  ],
  [
    /^(normal speed|real speed|normalnie|normalna predkosc|normalne tempo)$/,
    (current) => ({ ...current, rate: 1 }),
    () => 'Normal speed',
  ],
  [
    /^(darker|dimmer|dim|ciemniej|przyciemnij)$/,
    (current, strength) => {
      const dim = current.dim ?? 0;
      if (dim <= -1) return 'Already as dark as the palette goes.';
      return { ...current, dim: stepped(dim, -DIM_STEP * strength, -1, 1) };
    },
    (next) => `Darker: tone ${(next.dim ?? 0).toFixed(2)}`,
  ],
  [
    /^(brighter|lighter|jasniej|rozjasnij)$/,
    (current, strength) => {
      const dim = current.dim ?? 0;
      if (dim >= 1) return 'Already as light as the palette goes.';
      return { ...current, dim: stepped(dim, DIM_STEP * strength, -1, 1) };
    },
    (next) => `Brighter: tone ${(next.dim ?? 0).toFixed(2)}`,
  ],
  [
    /^(zoom in|zoom|closer|przybliz|zbliz|zblizenie|blizej)$/,
    (current, strength) => {
      const zoom = current.zoom ?? 1;
      if (zoom >= DIRECTION_ZOOM_MAX)
        return `Already at the closest zoom (${String(DIRECTION_ZOOM_MAX)}x).`;
      return { ...current, zoom: stepped(zoom, ZOOM_STEP * strength, 1, DIRECTION_ZOOM_MAX) };
    },
    (next) => `Zoom ${(next.zoom ?? 1).toFixed(1)}x`,
  ],
  [
    /^(zoom out|wider|oddal|dalej)$/,
    (current, strength) => {
      const zoom = current.zoom ?? 1;
      if (zoom <= 1) return 'Not zoomed in.';
      return { ...current, zoom: stepped(zoom, -ZOOM_STEP * strength, 1, DIRECTION_ZOOM_MAX) };
    },
    (next) => `Zoom ${(next.zoom ?? 1).toFixed(1)}x`,
  ],
];

const UNDO = /^(undo|cofnij|wstecz)$/;
const REDO = /^(redo|ponow|przywroc)$/;
const CLEAR =
  /^(reset|clear|clear directions|clear all|reset all|wyczysc|wyczysc wszystko|resetuj|zresetuj)$/;
const REMOVE = /^(remove|delete|hide|usun|skasuj|schowaj|wyrzuc|bez)$/;

/** Parses one command for the shot under the playhead (see the module comment). */
export function parseDirectionCommand(
  command: string,
  context: DirectionCommandContext,
): DirectionCommandResult {
  const { tokens, strength } = prepare(command);
  const phrase = tokens.join(' ');
  const shotId = context.shot.id;
  const current = context.current ?? {};
  if (phrase === '')
    return {
      kind: 'error',
      message: 'Type a command, e.g. "slower" or "arrow on the word light".',
    };
  if (UNDO.test(phrase)) return { kind: 'undo' };
  if (REDO.test(phrase)) return { kind: 'redo' };
  if (CLEAR.test(phrase)) {
    return {
      kind: 'direction',
      shotId,
      next: undefined,
      confirmation: `Cleared the directions of ${shotId}`,
    };
  }
  const simple = phrase.replace(/^(make it|make|zrob to|zrob|daj|go)\s+/, '');
  for (const [pattern, change, describe] of SIMPLE) {
    if (!pattern.test(simple)) continue;
    const next = change(current, strength);
    if (typeof next === 'string') return { kind: 'error', message: next };
    return {
      kind: 'direction',
      shotId,
      next: normalizeDirection(next),
      confirmation: describe(next),
    };
  }
  if (REMOVE.test(tokens[0] ?? '')) return removeOverlays(tokens.slice(1), context);
  const markIndex = tokens.findIndex((token) => kindOf(token) !== undefined);
  const kind = kindOf(tokens[markIndex]);
  // "add an arrow …", "dodaj strzałkę …", "put a ring …": the mark may follow a verb.
  if (kind !== undefined && markIndex <= 2)
    return addOverlay(kind, tokens.slice(markIndex + 1), context);
  return { kind: 'needs-claude', shotId, request: command.trim() };
}
