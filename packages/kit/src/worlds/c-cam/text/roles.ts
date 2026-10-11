/**
 * Text roles of the Grim Ink world (PLAN.md#14.18, brief 11 addendum 2: PROTOTYPE FIDELITY). The
 * prototype films letter with system fonts (`docs/concepts/c-cam-style/films/*\/js/{brushes,
 * timeline}.js`): captions in bold 46 px Arial Black with a bone fill and an 11 px ink outline,
 * poster words and labels in Impact / Arial Black, ledgers in Georgia, the DSKY digits in Courier
 * New. This world exception (docs/worlds/c-cam-STYLE.md, "Exceptions to engine rules"; ADR-005
 * addendum) draws the same fonts through canvas `fillText` / `strokeText` INSIDE the kit, never in
 * scene source, and only when the font is installed on the machine (nothing is shipped). On a
 * machine without it (CI Linux, cloud) the role falls back to the world's CC0 ink-stroke lettering
 * (lettering/), so goldens stay deterministic.
 *
 * Availability is probed once per realm (= per frame source) with `measureText` against the
 * generic families: a family is installed when a test string measures differently with it first.
 */
import type { FaceName } from '../lettering/types.js';

export const TEXT_ROLES = ['caption', 'poster', 'title', 'label', 'ledger', 'digits'] as const;
export type TextRole = (typeof TEXT_ROLES)[number];

export interface RoleSpec {
  /** CSS font stack exactly as the prototypes wrote it (the browser picks the first installed). */
  readonly stack: string;
  /** The named families of the stack (probed; generic families are never "installed"). */
  readonly families: readonly string[];
  /** CSS weight prefix ('bold' or ''). */
  readonly weight: string;
  /** Font size in px when the call gives none. */
  readonly size: number;
  readonly fill: string;
  /** Outline colour (ink) and width relative to the size; undefined = no outline. */
  readonly outline: string | undefined;
  readonly outlineScale: number;
  /** The CC0 lettering face of the fallback and its cap height per px of font size. */
  readonly face: FaceName;
  readonly capScale: number;
  /** Extra glyph spacing of the fallback (glyph units) so a line keeps the system face's width. */
  readonly track: number;
  /** Ink width of the fallback per cap height (undefined: the face's own; Arial Black is heavy). */
  readonly inkWeight: number | undefined;
}

const INK = '#16120e';
const BONE = '#e2d8b8';
const POSTER_BONE = '#cdbf94';
const IMPACT = "Impact, 'Arial Black', sans-serif";

/**
 * Role -> font stack, copied from the prototypes. Cap scales (fallback cap height per px of font
 * size) match the cap heights measured in Chromium (Windows fonts): Arial Black 33 px at 46 px
 * (0.716), Impact 36 at 46 (0.78), Georgia 18 at 26 (0.69), Courier New 23 at 40 (0.575). Tracks
 * keep a line's width: "SO WHAT DO YOU DO WITH FREEDOM?" is 985 px in bold 46 px Arial Black and
 * 886 px in the poster face at cap 33 (track 1.25 -> 985); Impact is condensed, the poster face
 * is not (track -1 narrows it a little without letters touching).
 */
export const ROLE_SPECS: Readonly<Record<TextRole, RoleSpec>> = Object.freeze({
  // timeline.js caption(): "bold 46px 'Arial Black', Arial, sans-serif", fill #e2d8b8, lw 11.
  caption: {
    stack: "'Arial Black', Arial, sans-serif",
    families: ['Arial Black', 'Arial'],
    weight: 'bold',
    size: 46,
    fill: BONE,
    outline: INK,
    outlineScale: 11 / 46,
    face: 'poster',
    capScale: 0.716,
    track: 1.25,
    inkWeight: 0.3,
  },
  // shots-a.js posterWord(): `${size}px Impact, 'Arial Black'`, bone #cdbf94, ink lw size x 0.1.
  poster: {
    stack: IMPACT,
    families: ['Impact', 'Arial Black'],
    weight: '',
    size: 120,
    fill: POSTER_BONE,
    outline: INK,
    outlineScale: 0.1,
    face: 'poster',
    capScale: 0.79,
    track: -1,
    inkWeight: undefined,
  },
  title: {
    stack: IMPACT,
    families: ['Impact', 'Arial Black'],
    weight: '',
    size: 150,
    fill: POSTER_BONE,
    outline: INK,
    outlineScale: 0.1,
    face: 'poster',
    capScale: 0.79,
    track: -1,
    inkWeight: undefined,
  },
  // brushes.js ST.label(): default `${size || 40}px Impact, 'Arial Black'`, fill C.INK.
  label: {
    stack: IMPACT,
    families: ['Impact', 'Arial Black'],
    weight: '',
    size: 40,
    fill: INK,
    outline: undefined,
    outlineScale: 0,
    face: 'poster',
    capScale: 0.79,
    track: -1,
    inkWeight: undefined,
  },
  // Ledger entries and slates (films 01 / 02): Georgia bold, Times New Roman.
  ledger: {
    stack: "Georgia, 'Times New Roman', serif",
    families: ['Georgia', 'Times New Roman'],
    weight: 'bold',
    size: 26,
    fill: INK,
    outline: undefined,
    outlineScale: 0,
    face: 'hand',
    capScale: 0.69,
    track: 2,
    inkWeight: undefined,
  },
  // lunar.js DSKY: `bold ${40k}px 'Courier New', monospace`.
  digits: {
    stack: "'Courier New', monospace",
    families: ['Courier New'],
    weight: 'bold',
    size: 40,
    fill: INK,
    outline: undefined,
    outlineScale: 0,
    face: 'poster',
    capScale: 0.57,
    track: 0,
    inkWeight: undefined,
  },
});

/** The part of a canvas context font probing needs. */
export interface MeasureTarget {
  font: string;
  measureText(text: string): { readonly width: number };
}

const PROBE_TEXT = 'mmmmmmmmmmlli10OQ@W';
const PROBE_SIZE = 72;
const GENERICS = ['monospace', 'serif'] as const;

/** Installed families, probed once per realm (the frame source): name -> installed. */
const probed = new Map<string, boolean>();

function measure(target: MeasureTarget, font: string): number {
  target.font = font;
  return target.measureText(PROBE_TEXT).width;
}

/** True when `family` is installed: it measures differently from each generic fallback. */
export function familyInstalled(target: MeasureTarget, family: string): boolean {
  const known = probed.get(family);
  if (known !== undefined) return known;
  const previous = target.font;
  const installed = GENERICS.some(
    (generic) =>
      measure(target, `${String(PROBE_SIZE)}px '${family}', ${generic}`) !==
      measure(target, `${String(PROBE_SIZE)}px ${generic}`),
  );
  target.font = previous;
  probed.set(family, installed);
  return installed;
}

/** A role draws with system fonts when any named family of its stack is installed. */
export function roleUsesSystemFont(target: MeasureTarget | undefined, role: TextRole): boolean {
  if (target === undefined) return false;
  return ROLE_SPECS[role].families.some((family) => familyInstalled(target, family));
}

/** Every named family of the roles (the font report). */
export const ROLE_FAMILIES: readonly string[] = [
  ...new Set(TEXT_ROLES.flatMap((role) => ROLE_SPECS[role].families)),
].sort();

export interface InkFontReport {
  /** True when at least one role draws with the CC0 ink lettering instead of its system font. */
  readonly fallback: boolean;
  /** Families of the roles that are not installed (sorted). */
  readonly missing: readonly string[];
  /** Roles that fall back. */
  readonly fallbackRoles: readonly TextRole[];
}

/** Probes every role family on `target` (undefined: no canvas, every role falls back). */
export function inkFontReport(target: MeasureTarget | undefined): InkFontReport {
  const missing =
    target === undefined
      ? [...ROLE_FAMILIES]
      : ROLE_FAMILIES.filter((family) => !familyInstalled(target, family));
  const fallbackRoles = TEXT_ROLES.filter((role) => !roleUsesSystemFont(target, role));
  return { fallback: fallbackRoles.length > 0, missing, fallbackRoles };
}

/** Test seam: forget the probed families. */
export function resetFontProbe(): void {
  probed.clear();
}
