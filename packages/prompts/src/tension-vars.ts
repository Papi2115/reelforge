/**
 * The tension prompt's variables (PLAN.md#12.22): the narration length, the point budget and an
 * example curve scaled to THIS narration. The example used to be a fixed 2.5-minute curve (points
 * at 61 and 130 s), which the quality lab's 28 s film got as its model (PLAN.md#14.17): now every
 * example time is a share of the narration, so the example always fits inside it.
 */

/** Shares of the narration where the example curve turns (the old example's 8.2/61/130.4/141 of ~150 s). */
const EXAMPLE_SHARES = { hook: 0.055, rise: 0.41, reveal: 0.87, release: 0.94 } as const;

const oneDecimal = (seconds: number): string => (Math.round(seconds * 10) / 10).toFixed(1);

/** m:ss of a time (the example note's "the reveal at 2:10"). */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
}

/** Every variable of the `tension` prompt for a narration of `durationS` seconds. */
export function tensionPromptVars(
  durationS: number,
  minPoints: number,
  maxPoints: number,
): Record<string, string | number> {
  const at = (share: number): string => oneDecimal(durationS * share);
  return {
    durationS: oneDecimal(durationS),
    minPoints,
    maxPoints,
    exampleHook: at(EXAMPLE_SHARES.hook),
    exampleRise: at(EXAMPLE_SHARES.rise),
    exampleReveal: at(EXAMPLE_SHARES.reveal),
    exampleRelease: at(EXAMPLE_SHARES.release),
    exampleRevealClock: clock(durationS * EXAMPLE_SHARES.reveal),
  };
}
