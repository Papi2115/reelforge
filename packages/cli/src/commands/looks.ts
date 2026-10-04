/**
 * `reelforge looks`: the available looks (ADR-009) with their rolls, treatments, one-line
 * description and sound palette, the roll legend, and the project's look mode. Read-only; works
 * outside a project too (the look mode line then says so).
 */
import { listLooks, type Look } from '@reelforge/kit';
import {
  projectFileSchema,
  projectLookMode,
  ROLLS,
  type LookMode,
  type Roll,
} from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { checkJsonFile } from '../project/files.js';
import { PROJECT_PATHS } from '../project/paths.js';

export const LOOKS_USAGE = `usage: reelforge looks [--json]
Lists the available looks (id, label, rolls, treatments, sound palette, what each is for), what the
rolls A/B/C mean, and this project's look mode. Build every shot in the look its storyboard entry
names ("look"; absent = voxel); \`reelforge kit-docs\` marks the definitions of each look.
Exit code: 0 always (2 usage error).`;

/** What each roll is for (same wording as the storyboard prompt). */
export const ROLL_MEANINGS: Readonly<Record<Roll, string>> = {
  A: 'the main visual story (voxel 3D: the character, places, reconstructions); the anchor, back at least once in every 6 shots',
  B: 'proof and illustration (retro UI, documents, maps, charts, blueprints, dioramas)',
  C: 'atmosphere and rhythm (glitch, loops, kinetic text, title cards, metaphors, transitions); opens acts',
};

export interface LookSummary {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly rolls: readonly Roll[];
  readonly treatments: readonly string[];
  readonly soundPalette: string;
}

/** The project's look mode, or undefined without a valid project.json. */
async function readLookMode(root: string): Promise<LookMode | undefined> {
  const project = await checkJsonFile(root, PROJECT_PATHS.project, projectFileSchema);
  return project.status === 'ok' ? projectLookMode(project.data) : undefined;
}

function summary(look: Look): LookSummary {
  const { id, label, description, rolls, treatments, soundPalette } = look;
  return { id, label, description, rolls, treatments, soundPalette };
}

function lookModeLine(mode: LookMode | undefined): string {
  switch (mode) {
    case 'mixed':
      return 'project look mode: mixed (build each shot in the look its storyboard entry names; absent = voxel)';
    case 'voxel-only':
      return 'project look mode: voxel-only (every shot is built in the voxel look; the other looks are not used here)';
    case undefined:
      return 'project look mode: unknown (no valid project.json in this folder)';
  }
}

export function formatLooks(looks: readonly LookSummary[], mode: LookMode | undefined): string[] {
  const width = Math.max(...looks.map((look) => look.id.length));
  const indent = ' '.repeat(width + 4);
  return [
    `looks (${String(looks.length)} available; every look shares the style: palette, pixel fonts, dithering):`,
    ...looks.flatMap((look) => [
      `  ${look.id.padEnd(width)}  ${look.label}: ${look.description}`,
      `${indent}rolls ${look.rolls.join(', ')} · sound palette ${look.soundPalette} · treatments ${look.treatments.join(', ')}`,
    ]),
    'rolls:',
    ...ROLLS.map((roll) => `  ${roll}  ${ROLL_MEANINGS[roll]}`),
    lookModeLine(mode),
    'kit definitions per look: reelforge kit-docs (entries of looks other than voxel are marked "(look <id>)")',
    'result: ok',
  ];
}

export const looksCommand: Command = {
  name: 'looks',
  summary: 'the available looks (rolls, treatments, sound palette) and the project look mode',
  usage: LOOKS_USAGE,
  async run(argv, context) {
    parseCommandArgs(argv, COMMON_OPTIONS, false);
    const looks = listLooks().map(summary);
    const mode = await readLookMode(context.root);
    return result(0, formatLooks(looks, mode), {
      ok: true,
      lookMode: mode ?? null,
      looks,
      rolls: ROLL_MEANINGS,
    });
  },
};
