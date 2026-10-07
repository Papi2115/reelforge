/**
 * Anti-slop guards v1 (PLAN.md#13.7, docs/worlds/QUALITY.md §8): programmatic checks of a shot's
 * scene source and frames that report ⚠ `slop` findings — warnings only, so they never start a fix
 * turn, never block a stage and never change the gating; they show as ⚠ in the scenes report, the
 * final review and the app's chips. On per project with `antiSlopGuards` (absent: on for world
 * styles, off for the built-in styles, so existing projects behave exactly as before).
 */
import type { AnyNode } from 'acorn';
import { resolveStyle } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { ok, type Result } from '@reelforge/claude-bridge';
import type { World } from '@reelforge/kit';
import {
  projectAntiSlopGuards,
  type AssetRecord,
  type ProjectFile,
  type QaFinding,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { FILES } from '../paths.js';
import { finding } from '../scenes/checks.js';
import type { StageError } from '../types.js';
import {
  compositionSignature,
  frameMetrics,
  MIN_JUDGED_CONTENT,
  parseHex,
  signatureDistance,
  type FrameMetrics,
} from './frame-guards.js';
import { breakthroughIntentFindings } from './breakthrough-intent.js';
import { popupIntentFindings } from './popup-intent.js';
import { countTraces, MIN_HUMAN_TRACES, uniformTimings } from './source-guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { strokeLettering, type StrokeLettering } from './stroke-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary, type Vocabulary } from './vocabulary.js';
import { worldSlopSpec, type WorldSlopSpec } from './world-labels.js';

/** Competing elements per frame (QUALITY.md §3: 6 competing items). */
export const ELEMENT_BUDGET = 6;
/** Accent-colour pixel share per frame. */
export const MAX_ACCENT_SHARE = 0.12;
/** Mirror similarity from which a frame with a centred hero is "centred and symmetric". */
export const SYMMETRY_THRESHOLD = 0.8;
/** Content centroid and hero centre within this share of the width from the centre = centred. */
export const CENTRED_OFFSET = 0.05;
/** Key frames of consecutive shots closer than this (signature distance) = same composition. */
export const SAME_COMPOSITION_DISTANCE = 0.2;
/** Invented strings named in one finding. */
const MAX_NAMED = 4;

export interface AntiSlopSetup {
  /** Narration, research notes and asset titles. */
  readonly vocabulary: Vocabulary;
  /** The world's trace helpers and labels (undefined: no world or no entry). */
  readonly spec: WorldSlopSpec | undefined;
  /** The style's accent1 swatch (undefined: unknown style). */
  readonly accent: readonly [number, number, number] | undefined;
}

export interface AntiSlopInputs {
  readonly projectDir: string;
  readonly project: ProjectFile;
  readonly world: World | undefined;
  readonly words: WordsFile | undefined;
  readonly assets: readonly AssetRecord[];
}

function styleAccent(project: ProjectFile): readonly [number, number, number] | undefined {
  try {
    const style = resolveStyle({ style: project.style, palette: project.palette });
    return parseHex(style.palette.accent1);
  } catch (error) {
    // An unknown style or a broken palette override: the render reports it; no accent check.
    if (error instanceof Error) return undefined;
    throw error;
  }
}

/** The guards' inputs, read once per scene job; undefined when the project has them off. */
export async function loadAntiSlop(
  inputs: AntiSlopInputs,
): Promise<Result<AntiSlopSetup | undefined, StageError>> {
  const { project, world } = inputs;
  if (!projectAntiSlopGuards(project, world !== undefined)) return ok(undefined);
  const texts: string[] = [];
  for (const file of [FILES.script, FILES.research]) {
    const text = await readProjectText(inputs.projectDir, file);
    if (!text.ok) return text;
    if (text.value !== undefined) texts.push(text.value);
  }
  texts.push((inputs.words?.words ?? []).map((word) => word.text).join(' '));
  texts.push(...inputs.assets.map((asset) => asset.title));
  return ok({
    vocabulary: buildVocabulary(texts),
    spec: worldSlopSpec(world?.id),
    accent: styleAccent(project),
  });
}

const slop = (message: string, t?: number): QaFinding => finding('slop', 'warning', message, { t });

function textFindings(
  setup: AntiSlopSetup,
  program: AnyNode,
  strokes: StrokeLettering,
  file: string,
): QaFinding[] {
  const texts = [...onScreenTexts(program, setup.spec), ...strokes.texts];
  const invented = inventedTexts(texts, setup.vocabulary, setup.spec);
  if (invented.length === 0) return [];
  const named = invented
    .slice(0, MAX_NAMED)
    .map((entry) => `"${entry.text}" (${file}:${String(entry.line)}: ${entry.unknown.join(', ')})`)
    .join('; ');
  const more =
    invented.length > MAX_NAMED ? ` and ${String(invented.length - MAX_NAMED)} more` : '';
  return [
    slop(
      `invented text: ${named}${more} - not in the narration, research notes or asset titles. Show the narrator's words or a research fact, or drop it.`,
    ),
  ];
}

/** Home-made stroke lettering (kit lint): its letters bypass `page.write` and the text checks. */
function strokeLetteringSlop(strokes: StrokeLettering, file: string): QaFinding[] {
  const [first] = strokes.findings;
  if (first === undefined) return [];
  return [
    slop(
      `letters drawn from strokes (${file}:${String(first.line)}): text drawn outside page.write cannot be provenance-checked (${first.message.replace(/^line \d+: /, '')}).`,
    ),
  ];
}

function traceFindings(spec: WorldSlopSpec, program: AnyNode, file: string): QaFinding[] {
  const traces = countTraces(program, spec);
  if (traces.total >= MIN_HUMAN_TRACES) return [];
  const found = [...traces.found].map(([name, count]) => `${name} x${String(count)}`).join(', ');
  const helpers = Object.keys(spec.traceMethods).join(', ');
  return [
    slop(
      `too few human traces in ${file}: ${String(traces.total)} (needs ≥ ${String(MIN_HUMAN_TRACES)}; found: ${found || 'none'}). Add the world's marks (${helpers}, a red correction, rotated lettering).`,
    ),
  ];
}

/**
 * Text provenance (with stroke-drawn letters), pop-up and breakthrough intents, human traces
 * (world scenes) and stagger variance of a scene's source.
 */
export function slopSourceFindings(
  setup: AntiSlopSetup,
  source: string,
  file: string,
): QaFinding[] {
  const program = parseScene(source);
  if (program === undefined) return [];
  const uniform = uniformTimings(program).map((entry) =>
    slop(
      `stagger variance: ${entry.what} (${file}:${String(entry.line)}). Vary the gaps and durations (±30 %), hold the key beat.`,
    ),
  );
  const strokes = strokeLettering(source, program);
  const breakthroughs = setup.spec?.breakthroughs;
  return [
    ...textFindings(setup, program, strokes, file),
    ...strokeLetteringSlop(strokes, file),
    ...popupIntentFindings(program, file),
    ...(breakthroughs === undefined
      ? []
      : breakthroughIntentFindings(program, file, breakthroughs, setup.vocabulary)),
    ...(setup.spec === undefined ? [] : traceFindings(setup.spec, program, file)),
    ...(setup.spec?.sourceChecks?.(program, file, setup.vocabulary) ?? []),
    ...uniform,
  ];
}

export interface TimedImage {
  readonly t: number;
  readonly image: RgbaImage;
}

function worst(
  measured: readonly { t: number; metrics: FrameMetrics }[],
  score: (metrics: FrameMetrics) => number,
  over: number,
): { t: number; metrics: FrameMetrics } | undefined {
  const sorted = [...measured].sort((a, b) => score(b.metrics) - score(a.metrics));
  const top = sorted[0];
  return top !== undefined && score(top.metrics) > over ? top : undefined;
}

function symmetric(metrics: FrameMetrics): boolean {
  return (
    metrics.content >= MIN_JUDGED_CONTENT &&
    metrics.mirror >= SYMMETRY_THRESHOLD &&
    metrics.centroidOffset <= CENTRED_OFFSET &&
    metrics.heroOffset <= CENTRED_OFFSET
  );
}

/** Clutter, accent share and centred symmetry over a shot's frames (one finding per guard). */
export function slopFrameFindings(
  setup: AntiSlopSetup,
  frames: readonly TimedImage[],
  shot: Pick<StoryboardShot, 'treatment'>,
): QaFinding[] {
  const measured = frames.map((frame) => ({
    t: frame.t,
    metrics: frameMetrics(frame.image, setup.accent),
  }));
  const findings: QaFinding[] = [];
  const crowded = worst(measured, (metrics) => metrics.competing, ELEMENT_BUDGET);
  if (crowded !== undefined) {
    findings.push(
      slop(
        `clutter: ${String(crowded.metrics.competing)} competing high-contrast elements (budget ${String(ELEMENT_BUDGET)}). Keep one focal point; drop the rest or make it low-contrast texture.`,
        crowded.t,
      ),
    );
  }
  const loud = worst(measured, (metrics) => metrics.accentShare, MAX_ACCENT_SHARE);
  if (loud !== undefined) {
    findings.push(
      slop(
        `accent colour on ${(loud.metrics.accentShare * 100).toFixed(0)} % of the frame (≤ ${String(MAX_ACCENT_SHARE * 100)} %). Keep the accent for the point of the sentence.`,
        loud.t,
      ),
    );
  }
  const centred = measured.find((entry) => symmetric(entry.metrics));
  if (centred !== undefined && shot.treatment !== 'title-card') {
    findings.push(
      slop(
        `centred and symmetric (mirror ${centred.metrics.mirror.toFixed(2)}, hero in the middle). Put the hero on a third and balance it with empty space.`,
        centred.t,
      ),
    );
  }
  return findings;
}

export interface KeyFrame {
  readonly shot: Pick<StoryboardShot, 'id' | 'continuity' | 'continues'>;
  /** The shot's last checked frame; undefined when it did not render. */
  readonly frame: TimedImage | undefined;
}

/**
 * Consecutive shots whose key frames have the same layout. A continuity link or a continued
 * sentence (`continuity`, `continues`) is a deliberate match: not judged.
 */
export function sameCompositionFindings(keys: readonly KeyFrame[]): Map<string, QaFinding[]> {
  const found = new Map<string, QaFinding[]>();
  const signatures = keys.map((key) =>
    key.frame === undefined ? undefined : compositionSignature(key.frame.image),
  );
  keys.forEach((key, index) => {
    const [previous, mine, theirs] = [keys[index - 1], signatures[index], signatures[index - 1]];
    if (previous === undefined || mine === undefined || theirs === undefined) return;
    if (key.shot.continuity !== undefined || key.shot.continues === true) return;
    const distance = signatureDistance(theirs, mine);
    if (distance >= SAME_COMPOSITION_DISTANCE) return;
    found.set(key.shot.id, [
      slop(
        `same composition as ${previous.shot.id} (layout distance ${distance.toFixed(2)} < ${String(SAME_COMPOSITION_DISTANCE)}). Change the framing, the focal point's place or the treatment.`,
        key.frame?.t,
      ),
    ]);
  });
  return found;
}

/** Source and frame guards of one checked shot (none when the project has them off). */
export function slopShotFindings(
  setup: AntiSlopSetup | undefined,
  input: {
    readonly source: string;
    readonly shot: Pick<StoryboardShot, 'scene' | 'treatment'>;
    readonly frames: readonly TimedImage[];
  },
): QaFinding[] {
  if (setup === undefined) return [];
  return [
    ...slopSourceFindings(setup, input.source, input.shot.scene),
    ...slopFrameFindings(setup, input.frames, input.shot),
  ];
}
