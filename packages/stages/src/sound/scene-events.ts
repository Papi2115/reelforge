/**
 * What the built scenes declared, for the sound director: their `ctx.sfx.at` sounds and resolved
 * anchors. The runner's `sceneSfx` provider wins for sounds when it is configured; otherwise both
 * come from the sync report the scene stage writes (`.reelforge/sync-report.json`, a build-only
 * dry run of every scene). No scenes built yet = no events (the director then works from the
 * storyboard and the words alone).
 */
import { syncReportSchema } from '@reelforge/shared';
import { FILES, inProject } from '../paths.js';
import { loadJson } from '../snapshot.js';
import type { SceneSfxEvent, SceneSfxProvider } from '../types.js';
import type { SceneAnchorEvent } from './cue-events.js';

export interface SceneEvents {
  readonly sfx: readonly SceneSfxEvent[];
  readonly anchors: readonly SceneAnchorEvent[];
}

export async function loadSceneEvents(
  projectDir: string,
  provider: SceneSfxProvider | undefined,
  signal: AbortSignal,
): Promise<SceneEvents> {
  const report = await loadJson(inProject(projectDir, FILES.syncReport), syncReportSchema);
  const shots = report.status === 'ok' ? report.value.shots : [];
  const fromReport = (kind: 'sfx' | 'anchor') =>
    shots.flatMap((shot) =>
      shot.events
        .filter((event) => event.kind === kind)
        .map((event) => ({ t: event.t, label: event.label, shotId: shot.shotId })),
    );
  const anchors = fromReport('anchor').map(({ t, label, shotId }) => ({
    t,
    phrase: label,
    shotId,
  }));
  const sfx =
    provider === undefined
      ? fromReport('sfx').map(({ t, label, shotId }) => ({ t, name: label, shotId }))
      : await provider(projectDir, signal);
  return { sfx, anchors };
}
