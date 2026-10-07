import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_STAGE_MODELS,
  permissionsForStage,
  resolveModel,
  type ClaudeLauncher,
} from '@reelforge/claude-bridge';
import { MUSIC_MOODS, SFX_RECIPES } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import {
  isPromptId,
  loadPrompt,
  PROMPT_IDS,
  PROMPT_VERSIONS,
  promptVariables,
  renderOutputPaths,
  renderPrompt,
} from './catalog.js';
import { parseFrontMatter } from './front-matter.js';
import { PROMPT_SOURCES } from './generated/prompt-sources.js';
import { permissionStageFor, promptModel, promptToolNames } from './stages.js';

const PROMPTS_DIR = path.join(import.meta.dirname, '..', 'prompts');
/** Prompts that run on Sonnet under the critic's read-only permissions. */
const SONNET_ON_CRITIC: readonly string[] = ['brief', 'claims', 'hooks'];

describe('bundled prompts', () => {
  it('match prompts/*.md (run `pnpm --filter @reelforge/prompts generate` after editing)', () => {
    const files = readdirSync(PROMPTS_DIR).filter((name) => name.endsWith('.md'));
    expect(files.map((name) => name.slice(0, -3)).sort()).toEqual([...PROMPT_IDS]);
    for (const id of PROMPT_IDS) {
      const source = readFileSync(path.join(PROMPTS_DIR, `${id}.md`), 'utf8').replaceAll(
        '\r\n',
        '\n',
      );
      expect(PROMPT_SOURCES[id].source, id).toBe(source);
      expect(PROMPT_SOURCES[id].sha256, id).toBe(createHash('sha256').update(source).digest('hex'));
    }
  });

  it('cover every stage of PLAN.md#5.8, the whole-video review (#7.6) and the YouTube text (#9.2)', () => {
    expect([...PROMPT_IDS].sort()).toEqual(
      [
        'assets',
        'brief',
        'claims',
        'critic',
        'hooks',
        'prop-build',
        'research',
        'review-plan',
        'review-triage',
        'roles',
        'scene-build',
        'scene-fix',
        'script',
        'sound-cues',
        'storyboard',
        'tension',
        'world-assets',
        'world-asset-critic',
        'youtube-meta',
      ].sort(),
    );
  });
});

describe('loadPrompt', () => {
  it('returns front matter fields and the template body', () => {
    const storyboard = loadPrompt('storyboard');
    expect(storyboard).toMatchObject({ id: 'storyboard', version: 19, model: 'sonnet' });
    expect(storyboard.output).toEqual({ kind: 'files', paths: ['storyboard.json'] });
    expect(storyboard.template.startsWith('You are the director')).toBe(true);
    expect(storyboard.template).not.toContain('---\nid:');
    expect(loadPrompt('critic').output).toEqual({ kind: 'json-reply' });
    expect(loadPrompt('scene-fix').output).toEqual({ kind: 'reply' });
    expect(loadPrompt('script').output).toEqual({
      kind: 'files',
      paths: ['beats.md', 'script.txt'],
    });
  });

  it('exposes versions and content hashes for cache keys', () => {
    for (const id of PROMPT_IDS) {
      expect(PROMPT_VERSIONS[id]).toEqual({
        version: loadPrompt(id).version,
        sha256: PROMPT_SOURCES[id].sha256,
      });
    }
  });

  it('narrows unknown ids', () => {
    expect(isPromptId('storyboard')).toBe(true);
    expect(isPromptId('chat')).toBe(false);
  });
});

describe('renderPrompt', () => {
  it('lists the variables of each prompt', () => {
    expect(promptVariables('scene-fix')).toEqual({
      required: ['scope', 'shotIds', 'request'],
      optional: [
        'selection',
        'critic',
        'research',
        'craftBrief',
        'world',
        'lookId',
        'worldMomentDirective',
        'worldMoment',
        'continuityDirective',
        'noQuestions',
      ],
    });
    expect(promptVariables('sound-cues')).toEqual({
      required: ['styleId'],
      optional: ['acts', 'world', 'worldMoods', 'genreMoods', 'genreName'],
    });
  });

  it('names every built-in SFX recipe and music mood in the sound-cues prompt', () => {
    const rendered = renderPrompt('sound-cues', { styleId: 'voxel-pixel-crisp640' });
    expect(rendered.ok).toBe(true);
    const text = rendered.ok ? rendered.value : '';
    for (const name of [...SFX_RECIPES, ...MUSIC_MOODS]) {
      expect(text).toMatch(new RegExp(String.raw`(?:^|[\s,;(])${name}(?:[\s,;.)]|$)`));
    }
    expect(loadPrompt('sound-cues').version).toBe(6);
    expect(text).toContain("each shot's sound palette follows its `look`");
  });

  it('fills a prompt and leaves no template tags behind', () => {
    const rendered = renderPrompt('critic', {
      imagePaths: 'out/a.png, out/b.png',
      intent: 'Counter lands on "4 MB"',
      styleId: 'voxel-pixel-crisp640',
    });
    expect(rendered.ok).toBe(true);
    if (rendered.ok) {
      expect(rendered.value).toContain('Look at the image(s) at: out/a.png, out/b.png');
      expect(rendered.value).not.toMatch(/\{\{[#/]?\w+\}\}/);
    }
  });

  it('drops optional scene-fix lines when not given', () => {
    const rendered = renderPrompt('scene-fix', {
      scope: 'Shot',
      shotIds: 's01',
      request: 'Fix it',
    });
    expect(rendered.ok && rendered.value).not.toContain('Selected object');
    expect(rendered.ok && rendered.value).not.toContain('Critic findings');
  });

  it('names the prompt and the missing variables', () => {
    expect(renderPrompt('script', { brief: 'x' })).toEqual({
      ok: false,
      error: {
        kind: 'missing-vars',
        promptId: 'script',
        names: ['language', 'targetMinutes', 'targetWords', 'tone', 'audience'],
      },
    });
  });

  it('renders templated output paths', () => {
    expect(renderOutputPaths('scene-build', { shotScene: 'scenes/s03_desk.js' })).toEqual({
      ok: true,
      value: ['scenes/s03_desk.js'],
    });
    expect(renderOutputPaths('scene-build', {})).toMatchObject({ ok: false });
  });
});

describe('front matter', () => {
  it('parses lists with parentheses and rejects unknown keys or models', () => {
    const parsed = parseFrontMatter(
      '---\nid: x\nversion: 2\nmodel: opus\ntools: [Read, Bash(a, b)]\n---\nbody',
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: { frontMatter: { tools: ['Read', 'Bash(a, b)'], version: 2 }, template: 'body' },
    });
    expect(parseFrontMatter('---\nid: x\nversion: 1\nmodel: gpt\ntools: [Read]\n---\n').ok).toBe(
      false,
    );
    expect(
      parseFrontMatter('---\nid: x\nversion: 1\nmodel: opus\ntools: [Read]\nfoo: 1\n---\n').ok,
    ).toBe(false);
    expect(parseFrontMatter('id: x').ok).toBe(false);
  });
});

describe('stages and models', () => {
  const launcher: ClaudeLauncher = { command: 'claude', args: [] };

  it('declared tools ⊆ granted tools of the mapped stage (rules verbatim in --allowedTools)', () => {
    for (const id of PROMPT_IDS) {
      const granted = permissionsForStage(permissionStageFor(id), 'C:/project');
      for (const tool of loadPrompt(id).tools) {
        // Bare names must be available (`--tools`); rules like `Bash(reelforge *)` allowlisted as-is.
        const pool = tool.includes('(') ? granted.allowedTools : granted.tools;
        expect(pool, `${id}: ${tool}`).toContain(tool);
      }
      for (const tool of promptToolNames(id)) {
        expect(granted.tools, `${id}: ${tool}`).toContain(tool);
      }
    }
  });

  it('maps pipeline prompts 1:1 to the bridge stage of the same name (web tools for research)', () => {
    const reuse: Partial<Record<string, string>> = {
      'review-triage': 'critic',
      'review-plan': 'storyboard',
      'youtube-meta': 'storyboard',
      assets: 'storyboard',
      'prop-build': 'scene-build',
      roles: 'storyboard',
      tension: 'storyboard',
      claims: 'critic',
      hooks: 'critic',
      brief: 'critic',
      'world-assets': 'scene-build',
      'world-asset-critic': 'critic',
    };
    for (const id of PROMPT_IDS) expect(permissionStageFor(id), id).toBe(reuse[id] ?? id);
    expect(permissionsForStage('critic', 'C:/project').policy.writable).toBe(false);
    expect(permissionsForStage('research', 'C:/project').allowedTools).toEqual(
      expect.arrayContaining(['WebSearch', 'WebFetch']),
    );
  });

  it('declared models equal the bridge defaults of the mapped stage', () => {
    // claims (PLAN.md#12.18) and hooks (#12.16): Sonnet under the critic's read-only permissions;
    // the app passes the declared model explicitly, so the stage default (Haiku) never applies.
    expect(loadPrompt('claims').model).toBe('sonnet');
    expect(loadPrompt('hooks').model).toBe('sonnet');
    expect(loadPrompt('brief').model).toBe('sonnet');
    for (const id of PROMPT_IDS.filter((candidate) => !SONNET_ON_CRITIC.includes(candidate))) {
      expect(loadPrompt(id).model, id).toBe(DEFAULT_STAGE_MODELS[permissionStageFor(id)]);
    }
  });

  it('promptModel follows the bridge priority: override > Economy > declared', () => {
    for (const id of PROMPT_IDS.filter((candidate) => !SONNET_ON_CRITIC.includes(candidate))) {
      const stage = permissionStageFor(id);
      const request = { projectDir: 'C:/project', stage, prompt: 'x' };
      expect(promptModel(id)).toBe(resolveModel(request, { launcher }));
      expect(promptModel(id, { economy: true })).toBe(
        resolveModel(request, { launcher, economy: true }),
      );
      expect(promptModel(id, { economy: true, override: 'haiku' })).toBe(
        resolveModel({ ...request, model: 'haiku' }, { launcher, economy: true }),
      );
      const models = { [stage]: 'haiku' } as const;
      expect(promptModel(id, { models })).toBe('haiku');
      expect(promptModel(id, { models })).toBe(resolveModel(request, { launcher, models }));
      expect(promptModel(id, { models, economy: true })).toBe(
        resolveModel(request, { launcher, models, economy: true }),
      );
    }
  });

  it('strips rule content from declared tools', () => {
    expect(promptToolNames('scene-build')).toEqual([
      'Read',
      'Edit',
      'Write',
      'Glob',
      'Grep',
      'Bash',
    ]);
  });
});
