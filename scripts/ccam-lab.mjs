// Grim Ink quality lab driver (PLAN.md#14.17, docs/worlds/c-cam-lab-report.md "Recipe"): runs the
// REAL stages of a c-cam project (direction, storyboard, people and places, scenes with their QA)
// with an in-process Claude stand-in that records every prompt the pipeline sends and answers with
// files written by hand (the lab plays the model). Never calls the `claude` CLI, never spends the
// subscription. Needs the built packages (`pnpm typecheck`) and Playwright's Chromium (scene QA).
//   node scripts/ccam-lab.mjs <labDir> init                 project/ (c-cam, research off), script, words
//   node scripts/ccam-lab.mjs <labDir> storyboard           tension + direction + storyboard turns
//   node scripts/ccam-lab.mjs <labDir> modules              people and places (build + QA)
//   node scripts/ccam-lab.mjs <labDir> scenes [s01,s02]     scenes build + QA (all, or these shots)
// <labDir>/authored/: narration.txt, tension.json, direction.json, storyboard.json, people/*.js,
// places/*.js, scenes/*.js (missing answers make the stage fall back or fail, which is how the
// prompts are captured first). Every prompt lands in <labDir>/prompts/NN-<kind>.md. Frames: run
// `reelforge frames` inside <labDir>/project (see the report).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.resolve(import.meta.dirname, '..');
/** @param {string} relative */
const load = (relative) => import(pathToFileURL(path.join(REPO, relative)).href);
const { StageRunner } = await load('packages/stages/dist/runner.js');
const { DEFAULT_STAGE_SETTINGS } = await load('packages/stages/dist/settings.js');
const { PlaywrightFrameRenderer } = await load('packages/stages/dist/cli/playwright-renderer.js');
const { createProject } = await load('packages/project/dist/index.js');

const [labArg, command, shotsArg] = process.argv.slice(2);
if (labArg === undefined || command === undefined) {
  process.stderr.write(
    'usage: node scripts/ccam-lab.mjs <labDir> init|storyboard|modules|scenes [shots]\n',
  );
  process.exit(2);
}
const lab = path.resolve(labArg);
const authored = path.join(lab, 'authored');
const projectDir = path.join(lab, 'project');
const promptsDir = path.join(lab, 'prompts');
/** @param {string} line */
const say = (line) => process.stdout.write(`${line}\n`);

/**
 * Synthetic words at 150 wpm like real run 1: 0.4 s a word, +0.4 s after a sentence, lead 0.3 s.
 * @param {string} script
 */
function syntheticWords(script) {
  let t = 0.3;
  const words = script
    .split(/\s+/)
    .filter(Boolean)
    .map((/** @type {string} */ text, /** @type {number} */ i) => {
      const word = { i, text, paragraph: 0, t: Math.round(t * 1000) / 1000 };
      t += /[.!?]$/.test(text) ? 0.8 : 0.4;
      return {
        ...word,
        tEnd: Math.round((word.t + 0.36) * 1000) / 1000,
        confidence: 0.95,
        status: 'exact',
      };
    });
  const n = words.length;
  const stats = {
    scriptWords: n,
    asrWords: n,
    wer: 0,
    werFolded: 0,
    exact: n,
    folded: 0,
    fuzzy: 0,
  };
  return {
    version: 1,
    lang: 'en',
    asrModel: 'synthetic-150wpm',
    words,
    mismatches: [],
    stats: {
      ...stats,
      missing: 0,
      coverage: 1,
      timedShare: 1,
      insertions: 0,
      monotonic: true,
      clamped: 0,
    },
  };
}

/** @param {string} relative */
const readAuthored = (relative) => {
  const file = path.join(authored, relative);
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};
/**
 * @param {string} relative
 * @param {string} content
 */
const writeProjectFile = (relative, content) => {
  const file = path.join(projectDir, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

/**
 * What a prompt asks for (the first words of each stage prompt).
 * @param {string} prompt
 */
function classify(prompt) {
  if (prompt.includes("plan the film's narrative accents")) return 'direction';
  if (prompt.startsWith("You are the film's dramaturg")) return 'tension';
  if (prompt.startsWith('You are the director/storyboard artist')) return 'storyboard';
  const module = /^Build `kit-ext\/(people|places)\/(\w+)\.js` by hand/.exec(prompt);
  if (module) return `module:${module[1]}/${module[2]}`;
  const scene = /^Build the scene module for ONE shot[\s\S]*?"scene":\s*"scenes\/(\w+)\.js"/.exec(
    prompt,
  );
  if (scene) return `scene:${scene[1]}`;
  if (prompt.startsWith('You are a strict visual QA reviewer')) return 'critic';
  return 'other';
}

/**
 * The answer of one turn: files written into the project and the reply text.
 * @param {string} kind
 */
function answer(kind) {
  if (kind === 'direction') return readAuthored('direction.json') ?? '{"version":1}';
  if (kind === 'tension' || kind === 'storyboard') {
    const text = readAuthored(`${kind}.json`);
    if (text !== undefined) writeProjectFile(`${kind}.json`, text);
    return 'Done.';
  }
  if (kind.startsWith('module:') || kind.startsWith('scene:')) {
    const relative = kind.startsWith('module:')
      ? `${kind.slice(7)}.js`
      : `scenes/${kind.slice(6)}.js`;
    const text = readAuthored(relative);
    const target = kind.startsWith('module:') ? `kit-ext/${relative}` : relative;
    if (text !== undefined) writeProjectFile(target, text);
    return text === undefined
      ? 'Could not build it.'
      : 'Built it; lint, preview and frames checked.';
  }
  if (kind === 'critic') {
    // A stub verdict in the critic's craft-note shape; the lab judges the frames by hand (rubric).
    const note =
      'lab stub, frames judged by hand. focal: per the scene comment; traces: stain, crack, jolt';
    return JSON.stringify({ frames: [{ path: 'sheet.png', verdict: 'ok', note }] });
  }
  return 'Done.';
}

let turn = existsSync(promptsDir) ? readdirSync(promptsDir).length : 0;
const labClaude = {
  /** @param {{ prompt: string, model: string }} spec */
  run(spec) {
    turn += 1;
    const kind = classify(spec.prompt);
    mkdirSync(promptsDir, { recursive: true });
    const name = `${String(turn).padStart(2, '0')}-${kind.replace(/[^\w-]+/g, '_')}.md`;
    writeFileSync(path.join(promptsDir, name), `<!-- model ${spec.model} -->\n${spec.prompt}`);
    say(`  turn ${String(turn)}: ${kind} (${spec.model})`);
    const reply = answer(kind);
    return Promise.resolve({
      status: 'completed',
      reply,
      sessionId: 'lab',
      message: '',
      usage: undefined,
      limit: undefined,
    });
  },
};

async function init() {
  const script = readAuthored('narration.txt');
  if (script === undefined) throw new Error(`${authored}/narration.txt is missing`);
  const created = await createProject({ dir: projectDir, title: 'Lab', style: 'c-cam' });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  const projectJson = path.join(projectDir, 'project.json');
  const project = JSON.parse(readFileSync(projectJson, 'utf8'));
  writeFileSync(projectJson, JSON.stringify({ ...project, researchMode: 'off' }, null, 2));
  writeProjectFile('script.txt', `${script.trim()}\n`);
  writeProjectFile('timing/words.json', JSON.stringify(syntheticWords(script.trim()), null, 2));
  say(`project: ${projectDir}`);
}

/** @param {{ stage: string, action?: string, shots?: string[] }} request */
async function run(request) {
  process.env['REELFORGE_EXPERIMENTAL_WORLDS'] = '1';
  const frames = new PlaywrightFrameRenderer();
  const runner = new StageRunner({
    projectDir,
    claude: labClaude,
    scenes: { frames },
    settings: { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true },
  });
  /**
   * @typedef {{ message: string }} Message
   * @param {{ type: string, message?: string, label?: string, error?: Message, result?: Message }} event
   */
  const report = (event) => {
    if (event.type === 'warning') say(`  warning: ${event.message ?? ''}`);
    else if (event.type === 'step') say(`  ${event.label ?? ''}`);
    else if (event.type === 'failed') say(`failed: ${event.error?.message ?? ''}`);
    else if (event.type === 'done') say(`done: ${event.result?.message ?? ''}`);
  };
  runner.on('event', report);
  await runner.run(request);
  await frames.close();
}

const shots = shotsArg?.split(',');
if (command === 'init') await init();
else if (command === 'storyboard') await run({ stage: 'storyboard' });
else if (command === 'modules') await run({ stage: 'scenes', action: 'c-cam-modules' });
else if (command === 'scenes')
  await run({ stage: 'scenes', action: 'build', ...(shots ? { shots } : {}) });
else say(`unknown command ${command}`);
