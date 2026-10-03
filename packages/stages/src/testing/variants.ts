/**
 * Test support for shot variants (PLAN.md#11.3): a 3-shot film with real scenes committed, a
 * StageRunner on fake-claude (concurrency 3) and the scripted frame renderer, and fake-claude
 * rules that "write" variant work files (`.variants/<shot>/v<n>.js`) per build or fix turn.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { LimitGuard, type Clock } from '@reelforge/claude-bridge';
import type { FakeClaudeScript, FakeClaudeStep } from '@reelforge/fake-claude';
import { autocommit } from '@reelforge/project';
import { shotVariantSetSchema, type ShotVariantSet } from '@reelforge/shared';
import { StageRunner } from '../runner.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from '../settings.js';
import type { StageEvent, StageRequest } from '../types.js';
import { FakeClaudeHarness, writes } from './fake-claude.js';
import { CRITIC_OK, filmShots, sceneSource, writeFilm, type FilmShot } from './film.js';
import { readProject, type TestProjects } from './project.js';
import { ScriptedFrameRenderer } from './scripted-renderer.js';

export type Rules = NonNullable<FakeClaudeScript['rules']>;
type Rule = FakeClaudeStep & { promptIncludes: string };

export const work = (shot: FilmShot, index: number): string =>
  `.variants/${shot.id}/v${String(index)}.js`;

export const variantSource = (shot: FilmShot, index: number): string =>
  `${sceneSource(shot)}// variant ${String(index)}\n`;

/** The build turn of variant `index` writes `content`. */
export function variantRule(
  shot: FilmShot,
  index: number,
  content: string,
  extra: Partial<FakeClaudeStep> = {},
): Rule {
  return {
    ...writes({ [work(shot, index)]: content }, 'Built the variant.'),
    ...extra,
    promptIncludes: `Write \`${work(shot, index)}\``,
  };
}

/** The QA fix turn of variant `index` writes `content`. */
export function variantFixRule(shot: FilmShot, index: number, content: string): Rule {
  return {
    ...writes({ [work(shot, index)]: content }),
    promptIncludes: `(\`${work(shot, index)}\`)`,
  };
}

export function variantScript(rules: Rules): FakeClaudeScript {
  return { version: 1, rules, default: { scenario: 'tools-write', reply: CRITIC_OK } };
}

/** v1 + v2 clean, v3 keeps a lint error through its fix (dropped). */
export function twoGoodOneBad(shot: FilmShot): Rules {
  const lint = sceneSource(shot, 'lint');
  return [
    variantRule(shot, 1, variantSource(shot, 1), { delayMs: 300 }),
    variantRule(shot, 2, variantSource(shot, 2), { delayMs: 300 }),
    variantRule(shot, 3, lint, { delayMs: 300 }),
    variantFixRule(shot, 3, lint),
  ];
}

export function generateRequest(shotId: string, count = 3, note?: string): StageRequest {
  return {
    stage: 'scenes',
    action: 'variants',
    shots: [shotId],
    variants: { kind: 'generate', count, ...(note === undefined ? {} : { note }) },
  };
}

export function readVariantSetFile(dir: string, shotId: string): ShotVariantSet {
  return shotVariantSetSchema.parse(
    JSON.parse(readProject(dir, `.reelforge/variants/${shotId}/variants.json`)),
  );
}

export interface VariantSetup {
  readonly dir: string;
  /** The shot the variants are about (s02 of 3). */
  readonly shot: FilmShot;
  readonly harness: FakeClaudeHarness;
  readonly runner: StageRunner;
  readonly events: StageEvent[];
}

/** A committed 3-shot film with real scenes and a runner whose turns follow `rules(shot)`. */
export async function setupVariants(
  projects: TestProjects,
  harnesses: FakeClaudeHarness[],
  name: string,
  rules: (shot: FilmShot) => Rules,
  clock?: Clock,
): Promise<VariantSetup> {
  const shots = filmShots(3);
  const shot = shots[1] as FilmShot;
  const dir = await projects.create(name);
  writeFilm(dir, shots);
  for (const entry of shots) {
    writeFileSync(path.join(dir, ...entry.scene.split('/')), sceneSource(entry));
  }
  const committed = await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git });
  if (!committed.ok) throw new Error(committed.error.message);
  const guard = new LimitGuard({
    maxConcurrency: 3,
    recoverAfter: 100,
    ...(clock === undefined ? {} : { clock }),
  });
  const harness = new FakeClaudeHarness(variantScript(rules(shot)), { concurrency: 3, guard });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: { ...DEFAULT_STAGE_SETTINGS, scenes: { ...DEFAULT_SCENE_SETTINGS, concurrency: 3 } },
  });
  const events: StageEvent[] = [];
  runner.on('event', (event) => events.push(event));
  return { dir, shot, harness, runner, events };
}
