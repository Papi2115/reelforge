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
  MAX_DIRECTION_OVERLAYS,
  clampOverlayPoint,
  normalizeDirection,
  regionPoint,
  type DirectionOverlay,
  type DirectionOverlayKind,
  type ScreenRegion,
  type ShotDirection,
} from './live-direction.js';
import {
  findWord,
  foldText,
  wordAtPlayhead,
  wordRange,
  type DirectionWord,
  type WordMatch,
} from './live-direction-words.js';

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
/** How long a mark stays after its word ends (s), and the shortest it is shown. */
const OVERLAY_HOLD_S = 1.5;
const OVERLAY_MIN_S = 2;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Lowercase words without diacritics or punctuation (quotes kept for "quoted words"). */
function words(command: string): string[] {
  return command
    .split(/\s+/)
    .map((part) => foldText(part))
    .filter((part) => part !== '');
}

const FILLERS = new Set(['please', 'prosze', 'a', 'bit', 'little', 'troche', 'nieco', 'more']);
const STRONG = new Set(['much', 'lot', 'duzo', 'znacznie', 'mocno', 'bardzo', 'bardziej']);

const KIND_PATTERNS: readonly (readonly [DirectionOverlayKind, RegExp])[] = [
  ['arrow', /^(arrows?|strzalk\w*|strzaleczk\w*)$/],
  ['ring', /^(ring|circle|zakresl\w*|kolk\w*|kolo|obwodk\w*|okrag\w*|otocz)$/],
  ['underline', /^(underline|podkresl\w*)$/],
  ['highlight', /^(highlight|spotlight|zaznacz\w*|wyroznij|wyroznien\w*|podswietl\w*)$/],
  ['callout', /^(callout|label|note|dymek|dymk\w*|notk\w*|etykiet\w*|podpis\w*)$/],
  ['badge', /^(badge|odznak\w*|znaczek|znaczk\w*|wykrzyknik)$/],
];

function kindOf(word: string | undefined): DirectionOverlayKind | undefined {
  if (word === undefined) return undefined;
  return KIND_PATTERNS.find(([, pattern]) => pattern.test(word))?.[0];
}

const KIND_LABEL: Readonly<Record<DirectionOverlayKind, string>> = {
  arrow: 'Arrow',
  ring: 'Ring',
  underline: 'Underline',
  highlight: 'Highlight',
  callout: 'Callout',
  badge: 'Badge',
};

const REGION_WORDS: Readonly<Record<string, ScreenRegion>> = {
  center: 'center',
  centre: 'center',
  middle: 'center',
  srodek: 'center',
  srodku: 'center',
  left: 'left',
  lewo: 'left',
  lewej: 'left',
  right: 'right',
  prawo: 'right',
  prawej: 'right',
  top: 'top',
  gora: 'top',
  gorze: 'top',
  gory: 'top',
  bottom: 'bottom',
  dol: 'bottom',
  dole: 'bottom',
  dolu: 'bottom',
};

/** Trailing region words ("at the top left", "po lewej", "na dole") -> region, rest of the words. */
function splitRegion(rest: readonly string[]): { region?: ScreenRegion; words: string[] } {
  const parts = [...rest];
  const found: ScreenRegion[] = [];
  while (parts.length > 0) {
    const region = REGION_WORDS[parts.at(-1) ?? ''];
    if (region === undefined) break;
    found.unshift(region);
    parts.pop();
  }
  if (found.length === 0) return { words: parts };
  while (['at', 'on', 'in', 'to', 'the', 'w', 'na', 'po', 'u', 'z'].includes(parts.at(-1) ?? '')) {
    parts.pop();
  }
  const vertical = found.find((region) => region === 'top' || region === 'bottom');
  const horizontal = found.find((region) => region === 'left' || region === 'right');
  const region: ScreenRegion =
    vertical !== undefined && horizontal !== undefined
      ? (`${vertical}-${horizontal}` as ScreenRegion)
      : (vertical ?? horizontal ?? found[0] ?? 'center');
  return { region, words: parts };
}

const WORD_INTRO = new Set([
  'on',
  'the',
  'word',
  'at',
  'over',
  'to',
  'na',
  'slowie',
  'slowo',
  'wyrazie',
  'wyraz',
  'pod',
  'przy',
]);
const HERE = new Set([
  'this',
  'here',
  'it',
  'that',
  'to',
  'tu',
  'tutaj',
  'tym',
  'ten',
  'tego',
  'teraz',
  'now',
]);

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

function removeOverlays(
  rest: readonly string[],
  context: DirectionCommandContext,
): DirectionCommandResult {
  const shotId = context.shot.id;
  const overlays = context.current?.overlays ?? [];
  if (overlays.length === 0) return { kind: 'error', message: `${shotId} has no marks to remove.` };
  const kind = rest.map(kindOf).find((found) => found !== undefined);
  const all = rest.some((word) =>
    ['all', 'everything', 'marks', 'wszystko', 'wszystkie', 'znaczniki'].includes(word),
  );
  if (kind === undefined && !all) {
    const last = overlays.at(-1);
    const kept = overlays.slice(0, -1);
    return {
      kind: 'direction',
      shotId,
      next: normalizeDirection({ ...context.current, overlays: kept }),
      confirmation: `Removed the ${last === undefined ? 'last mark' : KIND_LABEL[last.kind].toLowerCase()}`,
    };
  }
  if (kind === undefined) {
    return {
      kind: 'direction',
      shotId,
      next: normalizeDirection({ ...context.current, overlays: [] }),
      confirmation: `Removed all marks of ${shotId}`,
    };
  }
  const lastIndex = overlays.findLastIndex((overlay) => overlay.kind === kind);
  if (lastIndex < 0)
    return {
      kind: 'error',
      message: `${shotId} has no ${KIND_LABEL[kind].toLowerCase()} to remove.`,
    };
  return {
    kind: 'direction',
    shotId,
    next: normalizeDirection({
      ...context.current,
      overlays: overlays.filter((_, index) => index !== lastIndex),
    }),
    confirmation: `Removed the ${KIND_LABEL[kind].toLowerCase()}`,
  };
}

function overlayId(kind: DirectionOverlayKind, overlays: readonly DirectionOverlay[]): string {
  const taken = new Set(overlays.map((overlay) => overlay.id));
  let count = 1;
  while (taken.has(`${kind}-${String(count)}`)) count += 1;
  return `${kind}-${String(count)}`;
}

function resolveWord(
  rest: readonly string[],
  context: DirectionCommandContext,
): WordMatch | string {
  const { shot, words: spoken, playhead } = context;
  const range = wordRange(spoken, shot.t0, shot.t1);
  if (range.to <= range.from) return `${shot.id} has no timed words (run Words timed first).`;
  const query = rest.filter(
    (word, index) =>
      !(WORD_INTRO.has(word) && rest.slice(0, index).every((before) => WORD_INTRO.has(before))),
  );
  if (query.length === 0 || query.every((word) => HERE.has(word))) {
    return wordAtPlayhead(spoken, range, playhead) ?? `${shot.id} has no timed words.`;
  }
  const found = findWord(spoken, query.join(' '), range, playhead);
  if (found !== undefined) return found;
  const elsewhere = findWord(spoken, query.join(' '), { from: 0, to: spoken.length }, playhead);
  return elsewhere === undefined
    ? `"${query.join(' ')}" is not spoken in ${shot.id}.`
    : `"${elsewhere.text}" is spoken in another shot (at ${elsewhere.t.toFixed(1)} s), not in ${shot.id}.`;
}

function addOverlay(
  kind: DirectionOverlayKind,
  rest: readonly string[],
  context: DirectionCommandContext,
): DirectionCommandResult {
  const { shot } = context;
  const overlays = context.current?.overlays ?? [];
  if (overlays.length >= MAX_DIRECTION_OVERLAYS) {
    return {
      kind: 'error',
      message: `${shot.id} already has ${String(MAX_DIRECTION_OVERLAYS)} marks; remove one first.`,
    };
  }
  const split = splitRegion(rest);
  // "arrow on the word right": the region word is the word itself.
  const namesWord = rest.some((word) =>
    ['word', 'slowie', 'slowo', 'wyrazie', 'wyraz'].includes(word),
  );
  const regionIsWord = namesWord && split.words.every((word) => WORD_INTRO.has(word));
  const region = regionIsWord ? undefined : split.region;
  const wordPart = regionIsWord ? rest : split.words;
  const word = resolveWord(wordPart, context);
  if (typeof word === 'string') return { kind: 'error', message: word };
  const point =
    region !== undefined
      ? regionPoint(region)
      : context.point === undefined
        ? regionPoint('center')
        : clampOverlayPoint(context.point.x, context.point.y);
  const at = round3(word.t);
  const until = round3(
    Math.max(at + 0.5, Math.min(shot.t1, Math.max(word.tEnd + OVERLAY_HOLD_S, at + OVERLAY_MIN_S))),
  );
  const text = word.text
    .replace(/[^\p{L}\p{N}\s'-]+/gu, '')
    .trim()
    .slice(0, 40);
  const overlay: DirectionOverlay = {
    id: overlayId(kind, overlays),
    kind,
    x: point.x,
    y: point.y,
    ...(region === undefined
      ? context.point === undefined
        ? { region: 'center' as const }
        : {}
      : { region }),
    at,
    until,
    word: { index: word.index, text: word.text.slice(0, 80) },
    ...(kind === 'callout' && text !== '' ? { text: text.toUpperCase() } : {}),
  };
  const where = overlay.region ?? 'the clicked point';
  const note =
    word.others > 0
      ? ` (nearest of ${String(word.others + 1)})`
      : word.fuzzy
        ? ' (closest match)'
        : '';
  return {
    kind: 'direction',
    shotId: shot.id,
    next: normalizeDirection({ ...context.current, overlays: [...overlays, overlay] }),
    confirmation: `${KIND_LABEL[kind]} on "${word.text}"${note} at ${at.toFixed(1)} s, ${where}`,
  };
}
