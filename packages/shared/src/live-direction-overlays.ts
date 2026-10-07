/**
 * Mark commands of live co-direction (live-direction-parse.ts parses the rest): "arrow on the word
 * light", "ring at the top left", "usuń strzałkę". A mark lands on a spoken word of the shot, at a
 * named screen region or at the last clicked point.
 */
import {
  MAX_DIRECTION_OVERLAYS,
  clampOverlayPoint,
  normalizeDirection,
  regionPoint,
  type DirectionOverlay,
  type DirectionOverlayKind,
  type ScreenRegion,
} from './live-direction.js';
import type { DirectionCommandContext, DirectionCommandResult } from './live-direction-parse.js';
import { findWord, wordAtPlayhead, wordRange, type WordMatch } from './live-direction-words.js';

/** How long a mark stays after its word ends (s), and the shortest it is shown. */
const OVERLAY_HOLD_S = 1.5;
const OVERLAY_MIN_S = 2;

export const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const KIND_PATTERNS: readonly (readonly [DirectionOverlayKind, RegExp])[] = [
  ['arrow', /^(arrows?|strzalk\w*|strzaleczk\w*)$/],
  ['ring', /^(ring|circle|zakresl\w*|kolk\w*|kolo|obwodk\w*|okrag\w*|otocz)$/],
  ['underline', /^(underline|podkresl\w*)$/],
  ['highlight', /^(highlight|spotlight|zaznacz\w*|wyroznij|wyroznien\w*|podswietl\w*)$/],
  ['callout', /^(callout|label|note|dymek|dymk\w*|notk\w*|etykiet\w*|podpis\w*)$/],
  ['badge', /^(badge|odznak\w*|znaczek|znaczk\w*|wykrzyknik)$/],
];

export function kindOf(word: string | undefined): DirectionOverlayKind | undefined {
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

export function removeOverlays(
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

export function addOverlay(
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
