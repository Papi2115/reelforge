/**
 * "Look assets" of a world film in Scenes built (PLAN.md#13.15), pure: the world-assets step's
 * status (not designed / designing / built ✓ / with findings ⚠ / not built ✗), its findings, the
 * designed things by name and the "Design look assets" / "Redo look assets" button. Only world
 * styles have look assets (`StageReports.lookAssets` is null for voxel projects).
 */
import { plural } from '../../shared/plural.js';
import type { StageRunView } from '../../shared/stages-contract.js';
import type { LookAssets } from '../../shared/voiceover-contract.js';

export type LookAssetsTone = 'none' | 'running' | 'ok' | 'warning' | 'failed';

export interface LookAssetRow {
  readonly key: string;
  /** What it is in the narration's words ("The lighthouse keeper"). */
  readonly name: string;
  /** "character · keeper", or the file when the cast does not list it. */
  readonly detail: string;
}

export interface LookAssetsView {
  readonly status: string;
  readonly tone: LookAssetsTone;
  readonly findings: readonly string[];
  /** The storyboard changed since the set was designed; null otherwise. */
  readonly note: string | null;
  readonly rows: readonly LookAssetRow[];
  readonly button: { readonly label: string; readonly title: string; readonly disabled: boolean };
}

export const DESIGN_LOOK_ASSETS = 'Design look assets';
export const REDO_LOOK_ASSETS = 'Redo look assets';

/** The world-assets step runs now: the action itself, or its turn inside a Scenes build. */
export function designingLookAssets(running: StageRunView | null): boolean {
  if (running?.stage !== 'scenes') return false;
  return running.action === 'world-assets' || /world assets/i.test(running.label ?? '');
}

function statusOf(look: LookAssets, designing: boolean): { status: string; tone: LookAssetsTone } {
  const report = look.report;
  if (designing) return { status: 'Designing look assets…', tone: 'running' };
  if (report === null) {
    return {
      status: 'Not designed yet. Scenes built designs them before the first scene.',
      tone: 'none',
    };
  }
  const count = plural(report.ids.length, 'look asset');
  if (report.status === 'built') return { status: `${count} built ✓`, tone: 'ok' };
  if (report.status === 'warning') {
    return {
      status: `${count} built · ⚠ ${plural(report.findings.length, 'finding')}`,
      tone: 'warning',
    };
  }
  return { status: 'Not built ✗: Claude designed no usable look asset.', tone: 'failed' };
}

function buttonOf(
  look: LookAssets,
  options: { readonly busy: boolean; readonly hasShots: boolean },
): LookAssetsView['button'] {
  const redo = look.report !== null && look.report.status !== 'failed';
  const label = redo ? REDO_LOOK_ASSETS : DESIGN_LOOK_ASSETS;
  if (!options.hasShots) {
    return { label, title: 'No shots yet: run Storyboard first.', disabled: true };
  }
  if (options.busy) return { label, title: 'Scenes built is running or queued.', disabled: true };
  return {
    label,
    title: redo
      ? 'Design the look assets again from the narration (built scenes keep their status; rebuild a shot to use the new ones)'
      : "Claude designs the film's own characters, props and places from the narration and checks them on a contact sheet",
    disabled: false,
  };
}

export function lookAssetsView(
  look: LookAssets,
  options: {
    readonly running: StageRunView | null;
    readonly busy: boolean;
    readonly hasShots: boolean;
  },
): LookAssetsView {
  const designing = designingLookAssets(options.running);
  const { status, tone } = statusOf(look, designing);
  return {
    status,
    tone,
    findings: designing ? [] : (look.report?.findings ?? []),
    note:
      look.storyboardChanged && !designing
        ? 'The storyboard changed since: the next Scenes build designs them again.'
        : null,
    rows: look.assets.map((asset) => ({
      key: `${asset.file}#${asset.id}`,
      name: asset.name,
      detail: asset.kind === null ? asset.file : `${asset.kind} · ${asset.id}`,
    })),
    button: buttonOf(look, options),
  };
}
