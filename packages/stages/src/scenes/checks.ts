/**
 * Programmatic scene QA (PLAN.md §4.4), no Claude involved: determinism lint, blank/uniform
 * frames, text cards outside the safe area or overlapping (engine `checkCards`), console errors.
 * Findings are written for the scene author (an LLM): what, where (local time), how to fix.
 */
import { cardProblems, type CardDiagnostic, type LintDiagnostic } from '@reelforge/engine';
import { computeFrameStats } from '@reelforge/engine/raster';
import type { QaFinding, QaFindingSource } from '@reelforge/shared';
import { contentShare } from './frame-content.js';
import type { RenderedFrame } from './tools.js';

/** A frame where one colour covers this share of the pixels counts as blank (as `reelforge frames`). */
export const BLANK_DOMINANT_SHARE = 0.97;
/** … or one with at most this many colours. */
export const BLANK_MAX_COLORS = 2;
/** … or one where less than this share stands out from the (dithered) background. */
export const BLANK_CONTENT_SHARE = 0.005;

export interface FindingExtras {
  readonly fatal?: boolean;
  readonly t?: number | undefined;
}

export function finding(
  source: QaFindingSource,
  severity: QaFinding['severity'],
  message: string,
  extras: FindingExtras = {},
): QaFinding {
  return {
    source,
    severity,
    fatal: extras.fatal ?? false,
    message,
    ...(extras.t === undefined ? {} : { t: extras.t }),
  };
}

const seconds = (value: number): string => `${value.toFixed(2)} s`;

export function lintFindings(diagnostics: readonly LintDiagnostic[], file: string): QaFinding[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) =>
      finding(
        'lint',
        'error',
        `${file}:${String(diagnostic.line)}:${String(diagnostic.column)} [${diagnostic.rule}] ${diagnostic.message} Fix: ${diagnostic.fix}`,
        { fatal: true },
      ),
    );
}

export function blankFrameFindings(frames: readonly RenderedFrame[]): QaFinding[] {
  return frames.flatMap((frame) => {
    const stats = computeFrameStats(frame.image.data);
    const uniform =
      stats.dominantColorShare >= BLANK_DOMINANT_SHARE || stats.uniqueColors <= BLANK_MAX_COLORS;
    const content = contentShare(frame.image);
    if (!uniform && content >= BLANK_CONTENT_SHARE) return [];
    const why = uniform
      ? `${String(Math.round(stats.dominantColorShare * 100))}% of the pixels are one colour (${String(stats.uniqueColors)} colours)`
      : `nothing stands out from the background (${(content * 100).toFixed(1)}% of the frame)`;
    return [
      finding(
        'blank',
        'error',
        `the frame at t=${seconds(frame.t)} looks blank: ${why}. Make the subject visible over the whole shot (lights, camera aimed at it, objects in front of the camera).`,
        { t: frame.t },
      ),
    ];
  });
}

/** Card QA problems (annotation warnings stay warnings; `info` records are not findings). */
export function cardFindings(cards: readonly CardDiagnostic[]): QaFinding[] {
  return cardProblems(cards).map((card) =>
    finding(
      'cards',
      card.severity === 'warning' ? 'warning' : 'error',
      `[${card.rule}] ${card.message}. Fix: ${card.fix}`,
      { t: card.t0 },
    ),
  );
}

export function consoleFindings(errors: readonly string[]): QaFinding[] {
  return [...new Set(errors)].map((error) =>
    finding('console', 'error', `console error while rendering: ${error}`),
  );
}

/**
 * A render that timed out twice (ShotRenderFailed.timedOut): a warning for the shot, never a fix
 * turn, so a stuck renderer cannot hang or loop the stage.
 */
export function renderTimeoutFinding(error: string): QaFinding {
  return finding(
    'runtime',
    'warning',
    `the shot was not checked: ${error}. Look at it in the preview; a scene that loops forever in build()/update() needs a fix.`,
  );
}

/** Findings that make the shot unrenderable (lint/runtime errors, no scene). */
export function fatalFindings(findings: readonly QaFinding[]): QaFinding[] {
  return findings.filter((entry) => entry.fatal);
}

/** Findings a fix turn should address. */
export function fixableFindings(findings: readonly QaFinding[]): QaFinding[] {
  return findings.filter((entry) => entry.severity === 'error');
}

export function formatFinding(entry: QaFinding): string {
  const at = entry.t === undefined ? '' : ` (t=${seconds(entry.t)})`;
  return `[${entry.source}]${at} ${entry.message}`;
}
