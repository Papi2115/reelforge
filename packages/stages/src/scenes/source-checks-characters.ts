/**
 * Static checks of a scene's people and mascot against the project (PLAN.md#12.20, ADR-025):
 * - a shot the storyboard planned with the mascot (`shot.mascot`) must call
 *   `kit.cast.mascot('<the project's id>')` (error: a fix turn adds it); any shot calling another
 *   mascot than the project's is an error too (the channel has one mascot);
 * - a shot without `shot.mascot` that calls the mascot, or a mascot in a pack project without
 *   one: warning (screen time is planned);
 * - a pack project calling `kit.props.character` (the classic hero): warning;
 * - a classic project calling `kit.cast.*`: warning.
 * Literal ids only (a computed `mascot(id)` is not judged). The classic hero without a mascot
 * and without cast calls (every scene made before 2.3.5) gets nothing.
 */
import type { CharacterSettings } from '@reelforge/prompts';
import { shotMascot, type QaFinding, type StoryboardShot } from '@reelforge/shared';
import { finding } from './checks.js';

const MASCOT_CALL = /\bcast\s*\.\s*mascot\s*\(\s*(?:(['"`])([^'"`]*)\1)?/g;
const CAST_CALL = /\bcast\s*\.\s*(?:mascot|person|mannequin|role|spec)\s*\(/;
const CLASSIC_HERO_CALL = /\bprops\s*\.\s*character\s*\(/;

interface MascotCalls {
  /** Any `cast.mascot(` call, literal or not. */
  readonly any: boolean;
  /** Literal ids, in order of first use. */
  readonly ids: readonly string[];
}

function mascotCalls(source: string): MascotCalls {
  const ids = new Set<string>();
  let any = false;
  for (const match of source.matchAll(MASCOT_CALL)) {
    any = true;
    const id = match[2];
    if (id !== undefined) ids.add(id);
  }
  return { any, ids: [...ids] };
}

function mascotFindings(
  source: string,
  file: string,
  shot: StoryboardShot,
  settings: CharacterSettings,
): QaFinding[] {
  const calls = mascotCalls(source);
  if (settings.mascot === 'none') {
    // A classic project's cast calls get the kit.cast warning below.
    if (settings.characters !== 'pack' || !calls.any) return [];
    return [
      finding(
        'scene',
        'warning',
        `${file}: shows a mascot but this project has none (Project settings → Mascot); remove it.`,
      ),
    ];
  }
  const chosen = settings.mascot;
  const findings: QaFinding[] = [];
  const others = calls.ids.filter((id) => id !== chosen);
  if (others.length > 0) {
    findings.push(
      finding(
        'scene',
        'error',
        `${file}: calls kit.cast.mascot('${others.join("'), kit.cast.mascot('")}') but the channel's mascot is '${chosen}': use kit.cast.mascot('${chosen}') only.`,
      ),
    );
  }
  const planned = shotMascot(shot, chosen);
  if (planned !== undefined && !calls.ids.includes(chosen) && others.length === 0) {
    findings.push(
      finding(
        'scene',
        'error',
        `${file}: the storyboard plans the mascot here (the ${planned.role}: ${planned.action}) but the scene never calls kit.cast.mascot('${chosen}'); add it beside the content, readable at 640x360.`,
      ),
    );
  }
  if (planned === undefined && calls.any) {
    findings.push(
      finding(
        'scene',
        'warning',
        `${file}: shows the mascot although the storyboard did not plan it in this shot (its screen time is planned sparsely); remove it or plan it in the storyboard.`,
      ),
    );
  }
  return findings;
}

/** Warnings and errors of the shot's people and mascot (see the file comment). */
export function characterSourceFindings(
  source: string,
  file: string,
  shot: StoryboardShot,
  settings: CharacterSettings,
): QaFinding[] {
  const findings = mascotFindings(source, file, shot, settings);
  if (settings.characters === 'pack' && CLASSIC_HERO_CALL.test(source)) {
    findings.push(
      finding(
        'scene',
        'warning',
        `${file}: uses kit.props.character (the classic hoodie hero) in a project with the character pack; use kit.cast.person('<id>') or kit.cast.mannequin().`,
      ),
    );
  }
  if (settings.characters === 'classic' && CAST_CALL.test(source)) {
    findings.push(
      finding(
        'scene',
        'warning',
        `${file}: uses kit.cast (the character pack) in a project with the classic hero; use kit.props.character or switch the project to the pack (Project settings → Characters).`,
      ),
    );
  }
  return findings;
}
