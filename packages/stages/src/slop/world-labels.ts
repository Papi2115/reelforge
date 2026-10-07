/**
 * Per-world knowledge of the anti-slop guards (docs/worlds/QUALITY.md §8): the world's human-trace
 * helpers (what the scene source must call at least three times) and the labels that are obvious
 * real labels of the world's objects (not "invented text"). Keyed by world id; a world without an
 * entry gets no trace check (its helpers are unknown) and only the general labels.
 */

/** A source option that is a human trace when present on a call (jittered lettering, red pen). */
export interface TraceOption {
  readonly key: string;
  /** Required literal value; undefined = any value except the literal 0 or `false`. */
  readonly value?: string | undefined;
  readonly trace: string;
}

export interface WorldSlopSpec {
  /** Trace helpers by method name -> how many traces one call counts for. */
  readonly traceMethods: Readonly<Record<string, number>>;
  /** At most this many traces from one helper (seeded jitter counts once, not per call). */
  readonly traceCaps?: Readonly<Record<string, number>> | undefined;
  readonly traceOptions: readonly TraceOption[];
  /** Words that are real labels of the world's objects ("p." on a notebook page). */
  readonly labels: readonly string[];
  /** Label patterns removed before the words are judged (page references, figure numbers). */
  readonly labelPatterns: readonly RegExp[];
  /** The world's own lettering calls: their first argument is on-screen text. */
  readonly textMethods?: readonly string[] | undefined;
  /** The world's own text options (string values on screen). */
  readonly textKeys?: readonly string[] | undefined;
  /** Lettering calls of sounds (onomatopoeia): `soundWords` are not invented there. */
  readonly soundMethods?: readonly string[] | undefined;
  readonly soundWords?: ReadonlySet<string> | undefined;
  /**
   * Breakthrough calls with a required `intent` (the claim) and the options that make their
   * mechanism, with the kit's defaults: never the same mechanism twice in a film.
   */
  readonly breakthroughs?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined;
}

/** Labels of real things in every film: months, weekdays, eras, units and short marks. */
export const GENERAL_LABELS: ReadonlySet<string> = new Set(
  (
    'january february march april may june july august september october november december ' +
    'jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday ' +
    'saturday sunday mon tue wed thu fri sat sun ad bc bce ce am pm min max sec ms hr hrs km cm mm ' +
    'kg mb kb gb tb vs approx yes ok yr yrs wk wks mo'
  ).split(' '),
);

/**
 * Sketchbook (packages/kit/src/worlds/sketchbook, page API): physical traces (tape, coffee ring,
 * clip, sticky note, smudge, ruler), hand marks (loop, underline, crossOut, two-stroke arrow), the
 * red correcting pen (`tool: 'red'`) and jittered lettering (`rot`). `popup` and `strip` draw
 * their own traces (compass arc, glue, torn tape, crooked tag; creases, tape over the joins) and
 * count for three.
 */
const SKETCHBOOK: WorldSlopSpec = {
  traceMethods: {
    tape: 1,
    coffeeRing: 1,
    clip: 1,
    sticky: 1,
    smudge: 1,
    ruler: 1,
    loop: 1,
    underline: 1,
    crossOut: 1,
    arrow: 1,
    popup: 3,
    strip: 3,
  },
  traceOptions: [
    { key: 'rot', trace: 'rot (jittered lettering)' },
    { key: 'tool', value: 'red', trace: "tool: 'red' (correction)" },
  ],
  labels: ['p', 'pp', 'fig', 'nb', 'ps', 'eg', 'ie', 'etc', 'note', 'notes', 'now', 'today'],
  labelPatterns: [/\bp{1,2}\.\s?\d+(?:\s?[-–]\s?\d+)?/giu, /\bfig\.\s?\d+/giu],
};

/** Comic sound words (onomatopoeia are drawn, never narrated). */
const COMIC_SOUNDS =
  'bam bang beep blam bonk boom bump buzz clack clang clank click clunk crack crash creak crunch ' +
  'ding dong drip fizz hiss honk kaboom klunk knock krak plop pop pow ring rumble screech shh ' +
  'slam smash snap splash splat swish swoosh tap thud thump thwack tick tock vroom wham whack ' +
  'whir whirr whoosh woosh zap zip zoom';

/**
 * Comic (packages/kit/src/worlds/comic, page API): physical traces (thumbprint, smudge, coffee
 * ring), pencil marks (margin note, two-stroke arrow, loop, tick, strike, highlighter, a pencil
 * rough), a worn stamp, the plates landing one by one (`press`), lettering off-square (`tilt`,
 * `slant`, sfx `angles`/`rise`), an entrance with its pencil rough (`rough: true`) and seeded
 * jitter (`rnd`/`range`, once each). `flashback` and `spread` draw their own traces (foxing, aged
 * edge, torn strip; spine crease, out-of-register pieces) and count for three. Text lives in the
 * page's lettering and the painter's `g.text`/`g.standing`/`g.digits`/`g.bigLetter`; `sfx` letters
 * sounds.
 */
const COMIC: WorldSlopSpec = {
  traceMethods: {
    thumbprint: 1,
    smudge: 1,
    coffeeRing: 1,
    note: 1,
    arrow: 1,
    loop: 1,
    tick: 1,
    strike: 1,
    highlight: 1,
    stamp: 1,
    press: 1,
    rough: 1,
    pencil: 1,
    rnd: 1,
    range: 1,
    flashback: 3,
    spread: 3,
  },
  traceCaps: { rnd: 1, range: 1 },
  traceOptions: [
    { key: 'rough', trace: 'rough: true (pencil rough before the panel)' },
    { key: 'tilt', trace: 'tilt (lettering off-square)' },
    { key: 'slant', trace: 'slant (varied baseline)' },
    { key: 'angles', trace: 'angles (letters off-square)' },
    { key: 'rise', trace: 'rise (uneven baseline)' },
  ],
  // Time-stamp captions of the comic page and the end marks of a gauge drawn as panel art.
  labels: [
    'meanwhile',
    'later',
    'earlier',
    'ago',
    'elsewhere',
    'suddenly',
    'continued',
    'cont',
    'end',
    'full',
    'empty',
  ],
  labelPatterns: [],
  textMethods: [
    'caption',
    'balloon',
    'sfx',
    'note',
    'stamp',
    'text',
    'standing',
    'digits',
    'bigLetter',
  ],
  textKeys: ['when'],
  soundMethods: ['sfx', 'bigLetter'],
  soundWords: new Set(COMIC_SOUNDS.split(' ')),
  breakthroughs: {
    flashback: { cover: 'page', arrange: 'rows' },
    spread: { assemble: 'merge', pieces: 'grid' },
  },
};

const SPECS: Readonly<Record<string, WorldSlopSpec>> = { sketchbook: SKETCHBOOK, comic: COMIC };

export function worldSlopSpec(worldId: string | undefined): WorldSlopSpec | undefined {
  return worldId !== undefined && Object.hasOwn(SPECS, worldId) ? SPECS[worldId] : undefined;
}
