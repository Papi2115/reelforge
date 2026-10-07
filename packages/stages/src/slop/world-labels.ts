/**
 * Per-world knowledge of the anti-slop guards (docs/worlds/QUALITY.md §8): the world's human-trace
 * helpers (what the scene source must call at least three times) and the labels that are obvious
 * real labels of the world's objects (not "invented text"). Keyed by world id; a world without an
 * entry gets no trace check (its helpers are unknown) and only the general labels.
 */

/** A source option that is a human trace when present on a call (jittered lettering, red pen). */
export interface TraceOption {
  readonly key: string;
  /** Required literal value; undefined = any value except the literal 0. */
  readonly value?: string | undefined;
  readonly trace: string;
}

export interface WorldSlopSpec {
  /** Trace helpers by method name -> how many traces one call counts for. */
  readonly traceMethods: Readonly<Record<string, number>>;
  readonly traceOptions: readonly TraceOption[];
  /** Words that are real labels of the world's objects ("p." on a notebook page). */
  readonly labels: readonly string[];
  /** Label patterns removed before the words are judged (page references, figure numbers). */
  readonly labelPatterns: readonly RegExp[];
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

const SPECS: Readonly<Record<string, WorldSlopSpec>> = { sketchbook: SKETCHBOOK };

export function worldSlopSpec(worldId: string | undefined): WorldSlopSpec | undefined {
  return worldId !== undefined && Object.hasOwn(SPECS, worldId) ? SPECS[worldId] : undefined;
}
