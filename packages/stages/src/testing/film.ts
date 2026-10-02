/**
 * Test support: a synthetic N-shot film (2 s per shot) for the scene stage — words, storyboard,
 * placeholder scenes — plus real scene sources in variants (clean, lint error, overlapping cards,
 * blank) and fake-claude rules that "write" them per shot and turn.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FakeClaudeScript, FakeClaudeStep } from '@reelforge/fake-claude';
import type { WordsFile as PipelineWordsFile } from '@reelforge/pipeline';
import type { StoryboardFile, StoryboardShot, Treatment } from '@reelforge/shared';
import { sceneStubSource } from '../stages/scene-stub.js';
import { writes } from './fake-claude.js';

const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const TREATMENTS: readonly Treatment[] = ['metaphor-object', 'title-card', 'kinetic-text'];
export const SHOT_SECONDS = 2;

export interface FilmShot extends StoryboardShot {
  /** Spoken phrase the scene anchors (unique in the film). */
  readonly phrase: string;
  readonly index: number;
}

export function filmShots(count: number): FilmShot[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      index,
      t0: index * SHOT_SECONDS,
      t1: (index + 1) * SHOT_SECONDS,
      treatment: TREATMENTS[index % TREATMENTS.length] ?? 'metaphor-object',
      intent: `Number ${NUMBERS[index] ?? String(index)} lands on the desk.`,
      scene: `scenes/${id}.js`,
      phrase: `${NUMBERS[index] ?? String(index)} lands`,
    };
  });
}

/** A full `timing/words.json` (the pipeline's aligned format, as the Words timed stage writes). */
export function filmWords(shots: readonly FilmShot[]): PipelineWordsFile {
  const words = shots.flatMap((shot, paragraph) =>
    ['shot', ...shot.phrase.split(' '), 'here'].map((text, k) => {
      const t = Math.round((shot.t0 + 0.2 + 0.4 * k) * 1000) / 1000;
      const tEnd = Math.round((t + 0.35) * 1000) / 1000;
      return { text, paragraph, t, tEnd, confidence: 0.95, status: 'exact' as const };
    }),
  );
  const count = words.length;
  return {
    version: 1,
    lang: 'en',
    asrModel: 'small',
    words: words.map((word, i) => ({ i, ...word })),
    mismatches: [],
    stats: {
      scriptWords: count,
      asrWords: count,
      wer: 0,
      werFolded: 0,
      exact: count,
      folded: 0,
      fuzzy: 0,
      missing: 0,
      coverage: 1,
      timedShare: 1,
      insertions: 0,
      monotonic: true,
      clamped: 0,
    },
  };
}

export function filmStoryboard(shots: readonly FilmShot[]): StoryboardFile {
  return {
    version: 1,
    shots: shots.map(({ id, t0, t1, treatment, intent, scene }) => ({
      id,
      t0,
      t1,
      treatment,
      intent,
      scene,
    })),
  };
}

/** Writes storyboard.json, timing/words.json and placeholder scenes into a project. */
export function writeFilm(dir: string, shots: readonly FilmShot[]): void {
  mkdirSync(path.join(dir, 'timing'), { recursive: true });
  mkdirSync(path.join(dir, 'scenes'), { recursive: true });
  writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(filmStoryboard(shots), null, 2));
  writeFileSync(path.join(dir, 'timing', 'words.json'), JSON.stringify(filmWords(shots), null, 2));
  for (const shot of shots) {
    writeFileSync(path.join(dir, ...shot.scene.split('/')), sceneStubSource(shot));
  }
}

/**
 * `clipped`: the title runs off the right frame edge; `late-sfx`: the sfx lands 400 ms after its
 * word; `small-text`: the title at scale 1; `update-throws`: update() throws a TypeError after 1 s.
 */
export type SceneVariant =
  'ok' | 'lint' | 'overlap' | 'blank' | 'small-text' | 'clipped' | 'late-sfx' | 'update-throws';

const COLORS = ['accent1', 'accent2', 'accent3', 'accent4', 'hero'];

/** A real scene (desk, cubes, push-in, title on the anchor, sfx on the anchor) in a variant. */
export function sceneSource(shot: FilmShot, variant: SceneVariant = 'ok'): string {
  const color = COLORS[shot.index % COLORS.length] ?? 'accent1';
  const title = shot.phrase.toUpperCase();
  const marker =
    variant === 'blank' ? '// render:blank\n' : variant === 'overlap' ? '// render:overlap\n' : '';
  if (variant === 'blank') {
    return `${marker}export const meta = { id: '${shot.id}', title: 'Empty', treatment: '${shot.treatment}' };

export function build(ctx) {
  ctx.scene.background = new ctx.three.Color(ctx.palette.sky);
  return {};
}

export function update(t, state, ctx) {
  ctx.camera.set({ position: [0, 2, 8], target: [0, 0, 0] });
}
`;
  }
  const lint = variant === 'lint' ? '\n  const wobble = Math.random();' : '';
  const wobbleUse = variant === 'lint' ? ' + wobble' : '';
  const extraCard =
    variant === 'overlap'
      ? `\n  ctx.text.title('${title} AGAIN', { id: 'clash', at: 0, pos: [0.5, 0.3], maxWidth: 0.8 });`
      : '';
  const titleScale = variant === 'small-text' ? ', scale: 1' : '';
  const titlePlace =
    variant === 'clipped' ? "pos: [0.8, 0.3], align: 'left'" : 'pos: [0.5, 0.3], maxWidth: 0.8';
  const sfxAt = variant === 'late-sfx' ? 'hit.t + 0.4' : 'hit.t';
  const crash =
    variant === 'update-throws' ? '\n  if (t > 1) state.missing.position.set(0, 0, 0);' : '';
  return `${marker}export const meta = { id: '${shot.id}', title: '${title}', treatment: '${shot.treatment}' };

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  return new three.Mesh(geometry, new three.MeshLambertMaterial({ color, flatShading: true }));
}

export function build(ctx) {
  const { three, scene, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.2));
  const sun = new three.DirectionalLight(palette.keyLight, 2.8);
  sun.position.set(3, 6, 6);
  scene.add(sun);
  const desk = box(three, [8, 0.4, 5], palette.ground);
  desk.position.y = -0.2;
  const cube = box(three, [1.2, 1.2, 1.2], palette.${color});
  cube.position.y = 0.6;
  const side = box(three, [0.8, 2, 0.8], palette.groundAlt);
  side.position.set(-2, 1, -1);
  scene.add(desk, cube, side);${lint}
  const hit = anchor('${shot.phrase}');
  sfx.at(${sfxAt}, 'hit');
  return { cube, hit };
}

export function update(t, state, ctx) {
  ctx.camera.pushIn({ target: [0, 0.6, 0], dist: [8, 5], to: state.hit.t, direction: [0.4, 0.7, 1] })(t);
  state.cube.rotation.y = 0.4 * t${wobbleUse};${crash}
  ctx.text.title('${title}', { id: 'title', at: 0, ${titlePlace}${titleScale} });${extraCard}
}
`;
}

/** fake-claude rule: the build turn of `shot` writes `content`. */
export function buildRule(
  shot: FilmShot,
  content: string,
  reply = 'Built it. QA: lint ok.',
): FakeClaudeStep & { promptIncludes: string } {
  return { ...writes({ [shot.scene]: content }, reply), promptIncludes: `Write \`${shot.scene}\`` };
}

/** fake-claude rule: QA fix turn number `iteration` of `shot` writes `content`. */
export function fixRule(
  shot: FilmShot,
  iteration: number,
  content: string,
): FakeClaudeStep & { promptIncludes: string } {
  return {
    ...writes({ [shot.scene]: content }, 'Fixed.'),
    promptIncludes: `QA fix ${String(iteration)}/2 for shot ${shot.id} `,
  };
}

/** fake-claude rule: the critic of `shot` in QA round `label` answers `verdict`. */
export function criticRule(
  shot: FilmShot,
  label: string,
  verdict: 'ok' | 'clipped' | 'blank' | 'overlap' | 'off-intent',
  note = 'looks right',
): FakeClaudeStep & { promptIncludes: string } {
  const sheet = `.reelforge/frames/qa/${shot.id}/${label}.png`;
  return {
    scenario: 'tools-write',
    reply: JSON.stringify({ frames: [{ path: sheet, verdict, note }] }),
    promptIncludes: sheet,
  };
}

/** A generic critic answer for turns without their own rule (path mismatch is tolerated). */
export const CRITIC_OK = JSON.stringify({
  frames: [{ path: 'sheet.png', verdict: 'ok', note: 'looks right' }],
});

/**
 * The 8-shot acceptance scenario (PLAN.md#7.4): s03 has a lint error repaired by fix 1, s04
 * overlapping cards and s08 a blank frame fixed by fix 1, s05 is flagged "clipped" by the critic
 * and fixed, s07 needs a prop the kit lacks (⚠). Expected: 7 ✓, 1 ⚠, without intervention.
 */
export function eightShotScript(shots: readonly FilmShot[]): FakeClaudeScript {
  const shot = (index: number): FilmShot => {
    const found = shots[index];
    if (found === undefined) throw new Error(`no shot ${String(index)}`);
    return found;
  };
  const ok = (index: number): string => sceneSource(shot(index), 'ok');
  return {
    version: 1,
    rules: [
      buildRule(shot(0), ok(0)),
      buildRule(shot(1), ok(1)),
      buildRule(shot(2), sceneSource(shot(2), 'lint')),
      fixRule(shot(2), 1, ok(2)),
      buildRule(shot(3), sceneSource(shot(3), 'overlap')),
      fixRule(shot(3), 1, ok(3)),
      buildRule(shot(4), ok(4)),
      criticRule(shot(4), 'build-r0', 'clipped', 'title cut at the right edge'),
      fixRule(shot(4), 1, ok(4)),
      buildRule(shot(5), ok(5)),
      buildRule(shot(6), ok(6), 'Built with a glass cube instead.\nMISSING: prism'),
      buildRule(shot(7), sceneSource(shot(7), 'blank')),
      fixRule(shot(7), 1, ok(7)),
    ],
    default: { scenario: 'tools-write', reply: CRITIC_OK },
  };
}

export const EIGHT_SHOT_STATUSES = {
  s01: 'ok',
  s02: 'ok',
  s03: 'ok',
  s04: 'ok',
  s05: 'ok',
  s06: 'ok',
  s07: 'warning',
  s08: 'ok',
} as const;

export const EIGHT_SHOT_FIXES = { s03: 1, s04: 1, s05: 1, s08: 1 } as const;
