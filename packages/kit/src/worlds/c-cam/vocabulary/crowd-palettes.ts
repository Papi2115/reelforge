/**
 * Grim Ink crowd (PLAN.md#14.20): tone sets of background people, the films' TOWN_TONES
 * (`02-papal-conclave/js/shots/shots-a.js`) and their crowd colours (`cast/crowd.js` of films 1-3).
 */
/** Tone triples `[cloth, cloth shade, skin]` (the films' TOWN_TONES and their crowd colours). */
export const CROWD_PALETTES = {
  town: [
    ['#4a4438', '#3a352c', '#6e5f4c'],
    ['#5a5040', '#463e32', '#86705a'],
    ['#526068', '#3a454c', '#98785e'],
    ['#646238', '#46452a', '#8a6a52'],
  ],
  muted: [
    ['#5a4a52', '#45383f', '#8a7058'],
    ['#4f5a50', '#3c453d', '#86705a'],
    ['#5a4a40', '#463a32', '#7e6450'],
    ['#60563e', '#4a4230', '#8a7058'],
  ],
  office: [
    ['#a49c80', '#5c5a50', '#8a7058'],
    ['#8e8a7a', '#5c5a50', '#98785e'],
    ['#9a9278', '#5c5a50', '#7e6450'],
    ['#526068', '#3a454c', '#8a7058'],
  ],
  robes: [
    ['#7e3f2b', '#5c2c1d', '#94735c'],
    ['#5a4736', '#3f3125', '#86705a'],
    ['#2a2623', '#1b1816', '#8a7058'],
    ['#867d62', '#5d584a', '#98785e'],
  ],
  dark: [
    ['#38322a', '#27231d', '#4a4034'],
    ['#2e2a24', '#201d18', '#40372c'],
    ['#332e27', '#24201b', '#463c31'],
    ['#2b2822', '#1e1b17', '#3d352b'],
  ],
} as const satisfies Readonly<Record<string, readonly (readonly [string, string, string])[]>>;
export type CrowdPalette = keyof typeof CROWD_PALETTES;
