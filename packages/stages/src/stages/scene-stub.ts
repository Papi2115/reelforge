/**
 * Placeholder scene modules for new storyboard shots, so the preview plays the whole timeline
 * before "Scenes built" runs. A stub follows the scene contract (PLAN.md §3.2): pure function of
 * t, palette colours only, no imports. Existing scene files are never touched.
 */
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { StoryboardShot } from '@reelforge/shared';
import { writeProjectText } from '../files.js';
import { inProject } from '../paths.js';
import type { StageError } from '../types.js';

/** First line of every stub; the scene builder may check it to know a scene is not built. */
export const SCENE_STUB_MARKER = '// reelforge:stub';

export function sceneStubSource(shot: StoryboardShot): string {
  const meta = { id: shot.id, title: `${shot.id} (not built yet)`, treatment: shot.treatment };
  return `${SCENE_STUB_MARKER} - placeholder written by the Storyboard stage; "Scenes built" replaces it.
// Intent: ${shot.intent.replace(/\s+/g, ' ')}
export const meta = ${JSON.stringify(meta)};

export function build(ctx) {
  const { three, scene, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2));
  return {};
}

export function update(t, state, ctx) {
  ctx.text.title(${JSON.stringify(shot.id)}, { id: 'stub-title', at: 0 });
}
`;
}

const exists = (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

/** Writes stubs for shots whose scene file does not exist yet; returns the created paths. */
export async function writeSceneStubs(
  projectDir: string,
  shots: readonly StoryboardShot[],
): Promise<Result<string[], StageError>> {
  const created: string[] = [];
  for (const shot of shots) {
    const file = inProject(projectDir, shot.scene);
    if (await exists(file)) continue;
    await mkdir(path.dirname(file), { recursive: true });
    const written = await writeProjectText(projectDir, shot.scene, sceneStubSource(shot));
    if (!written.ok) return err(written.error);
    created.push(shot.scene);
  }
  return ok(created);
}
