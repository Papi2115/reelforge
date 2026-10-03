/**
 * Fixtures of the app's pipeline smoke test (the E2E skeleton, PLAN.md#10.1 hardens it): the
 * golden `en-short-prism` eval project (script, storyboard, words, cues) replayed by fake-claude,
 * a whisper transcription recorded from its words (the REELFORGE_TEST_TRANSCRIPT hook), a
 * synthetic voice-over made by ffmpeg and real scene sources for every storyboard shot (desk,
 * cube, title, an anchor on a word spoken only once in the shot, its sfx on the anchor).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FakeClaudeScript, FakeClaudeStep } from '@reelforge/fake-claude';

export const GOLDEN = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'prompts',
  'evals',
  'cases',
  'en-short-prism',
  'project',
);

export function golden(relative: string): string {
  return readFileSync(path.join(GOLDEN, ...relative.split('/')), 'utf8');
}

interface GoldenWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
}

interface GoldenShot {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
  readonly treatment: string;
  readonly scene: string;
}

export function goldenWords(): GoldenWord[] {
  return (JSON.parse(golden('timing/words.json')) as { words: GoldenWord[] }).words;
}

export function goldenShots(): GoldenShot[] {
  return (JSON.parse(golden('storyboard.json')) as { shots: GoldenShot[] }).shots;
}

/** Length of the synthetic voice-over (the last shot ends at 37.205 s). */
export const VO_SECONDS = 38;

/** `words.raw.json` as whisper would write it for the golden narration. */
export function recordedTranscript(): string {
  const words = goldenWords();
  return JSON.stringify({
    version: 1,
    engine: 'whisper.cpp',
    model: 'large-v3-turbo-q5_0',
    lang: 'en',
    decodedLang: 'en',
    mode: 'chunk',
    backend: 'cpu',
    usedGpu: false,
    fallbacks: [],
    dtwLeadS: 0.21,
    audioS: VO_SECONDS,
    wallMs: 1,
    chunks: [{ start: 0, end: VO_SECONDS }],
    words: words.map((word) => ({
      text: word.text,
      t: word.t,
      tEnd: word.tEnd,
      p: 0.95,
      tDtw: null,
    })),
  });
}

const normalize = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** A word of the shot that is spoken only once in the whole narration (an unambiguous anchor). */
export function uniqueAnchor(shot: GoldenShot): string | null {
  const words = goldenWords();
  const counts = new Map<string, number>();
  for (const word of words)
    counts.set(normalize(word.text), (counts.get(normalize(word.text)) ?? 0) + 1);
  const candidate = words.find(
    (word) =>
      word.t >= shot.t0 + 0.2 &&
      word.t < shot.t1 - 0.3 &&
      normalize(word.text).length >= 4 &&
      counts.get(normalize(word.text)) === 1,
  );
  return candidate === undefined ? null : normalize(candidate.text);
}

const COLORS = ['accent1', 'accent2', 'accent3', 'accent4', 'hero'];

/** A clean scene (passes lint, smoke frames, card QA and the ±150 ms check). */
export function sceneSource(shot: GoldenShot, index: number): string {
  const anchor = uniqueAnchor(shot);
  const color = COLORS[index % COLORS.length] ?? 'accent1';
  const title = shot.id
    .replace(/^s\d+_/, '')
    .replace(/_/g, ' ')
    .toUpperCase();
  const hit =
    anchor === null
      ? '  const hit = { t: 0.5 };'
      : `  const hit = anchor('${anchor}');\n  sfx.at(hit.t, 'hit');`;
  return `export const meta = { id: '${shot.id}', title: '${title}', treatment: '${shot.treatment}' };

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
  scene.add(desk, cube, side);
${hit}
  return { cube, hit };
}

export function update(t, state, ctx) {
  ctx.camera.pushIn({ target: [0, 0.6, 0], dist: [8, 5], to: Math.max(0.5, state.hit.t), direction: [0.4, 0.7, 1] })(t);
  state.cube.rotation.y = 0.4 * t;
  ctx.text.title('${title}', { id: 'title', at: 0, pos: [0.5, 0.3], maxWidth: 0.8 });
}
`;
}

function writes(files: Readonly<Record<string, string>>, reply: string): FakeClaudeStep {
  return {
    scenario: 'tools-write',
    reply,
    writes: Object.entries(files).map(([file, content]) => ({ path: file, content })),
  };
}

const CRITIC_OK = JSON.stringify({
  frames: [{ path: 'sheet.png', verdict: 'ok', note: 'looks right' }],
});

/** fake-claude rule: the final review's critic finds nothing (PLAN.md#11.5). */
export const FINAL_REVIEW_CLEAN = {
  scenario: 'tools-write',
  reply: '{"suspects":[]}',
  promptIncludes: '.reelforge/frames/qa/final/sheet-1.png',
} as const satisfies FakeClaudeStep & { promptIncludes: string };

/** fake-claude rules for every Claude turn of the pipeline (never a model call). */
export function pipelineScript(): FakeClaudeScript {
  const shots = goldenShots();
  return {
    version: 1,
    rules: [
      {
        ...writes({ 'research.md': golden('research.md') }, 'Saved research.md with 8 sources.'),
        promptIncludes: 'You are the researcher',
        delayMs: 200,
      },
      {
        ...writes(
          { 'beats.md': golden('beats.md'), 'script.txt': golden('script.txt') },
          'Word count: 84.',
        ),
        promptIncludes: 'about 75 words',
      },
      {
        ...writes(
          { 'storyboard.json': golden('storyboard.json') },
          '7 shots. Missing props: none.',
        ),
        promptIncludes: 'You are the director/storyboard artist',
      },
      ...shots.map((shot, index) => ({
        ...writes({ [shot.scene]: sceneSource(shot, index) }, 'Built it. QA: lint ok.'),
        promptIncludes: `Write \`${shot.scene}\``,
      })),
      {
        ...writes({ 'cues.json': golden('cues.json') }, 'sfx 4, ambience 1, music 0.'),
        promptIncludes: 'You are the sound designer',
      },
      // The final review's batched critic after Scenes built (PLAN.md#11.5): nothing suspicious.
      { ...FINAL_REVIEW_CLEAN },
    ],
    default: { scenario: 'tools-write', reply: CRITIC_OK },
  };
}

/**
 * Runs ffmpeg / ffprobe from PATH and returns stdout. A binary that cannot start (not installed)
 * says so: spawnSync then has `error` set, no exit status and no stderr.
 */
export function runMediaTool(tool: string, args: readonly string[]): string {
  const run = spawnSync(tool, args, { encoding: 'utf8' });
  if (run.error !== undefined) {
    throw new Error(
      `${tool} could not start (${run.error.message}): the app tests need ffmpeg and ffprobe on PATH`,
    );
  }
  if (run.status !== 0) {
    throw new Error(`${tool} exited with ${String(run.status)}: ${run.stderr.trim()}`);
  }
  return run.stdout;
}

/** A 48 kHz mono "voice" (a tone with a tremolo) made by ffmpeg. */
export function synthesizeVoiceover(file: string, seconds = VO_SECONDS): void {
  runMediaTool('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=220:sample_rate=48000:duration=${String(seconds)}`,
    '-af',
    'tremolo=f=3:d=0.7,volume=0.5',
    '-ac',
    '1',
    file,
  ]);
}

export interface MediaInfo {
  readonly durationS: number;
  readonly streams: readonly { codec_type: string; width?: number; height?: number }[];
}

export function ffprobe(file: string): MediaInfo {
  const stdout = runMediaTool('ffprobe', [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    file,
  ]);
  const parsed = JSON.parse(stdout) as {
    format: { duration: string };
    streams: MediaInfo['streams'];
  };
  return { durationS: Number(parsed.format.duration), streams: parsed.streams };
}
