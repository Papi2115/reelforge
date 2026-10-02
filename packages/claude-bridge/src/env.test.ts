/** `buildChildEnv`: the allowlisted extra-env hook (render service URL/token) on top of sanitizing. */
import { describe, expect, it } from 'vitest';
import { buildChildEnv, EXTRA_ENV_ALLOWLIST, type ExtraEnv } from './env.js';
import { spawnClaude } from './process.js';

const RENDER = {
  REELFORGE_RENDER_URL: 'http://127.0.0.1:5123',
  REELFORGE_RENDER_TOKEN: 'secret-token',
} as const;

describe('buildChildEnv', () => {
  it('adds the allowlisted vars after sanitizing the parent env', () => {
    const env = buildChildEnv({ PATH: 'C:\\bin', ANTHROPIC_API_KEY: 'k' }, RENDER);
    expect(env).toEqual({ PATH: 'C:\\bin', ...RENDER });
    expect(EXTRA_ENV_ALLOWLIST).toEqual(['REELFORGE_RENDER_URL', 'REELFORGE_RENDER_TOKEN']);
  });

  it('never lets the hook reintroduce billing vars or unknown names', () => {
    // A caller bypassing the type (e.g. from untyped data) still cannot inject these.
    const smuggled = {
      ANTHROPIC_API_KEY: 'k',
      ANTHROPIC_BASE_URL: 'http://evil',
      CLAUDE_CODE_USE_BEDROCK: '1',
      NODE_OPTIONS: '--require x',
      REELFORGE_RENDER_URL: RENDER.REELFORGE_RENDER_URL,
    } as unknown as ExtraEnv;
    expect(buildChildEnv({ PATH: 'p' }, smuggled)).toEqual({
      PATH: 'p',
      REELFORGE_RENDER_URL: RENDER.REELFORGE_RENDER_URL,
    });
  });

  it('replaces an inherited value of the same name (any case) and skips undefined', () => {
    const env = buildChildEnv(
      { reelforge_render_url: 'http://127.0.0.1:1', REELFORGE_RENDER_TOKEN: 'old' },
      { REELFORGE_RENDER_URL: RENDER.REELFORGE_RENDER_URL },
    );
    expect(env).toEqual({
      REELFORGE_RENDER_URL: RENDER.REELFORGE_RENDER_URL,
      REELFORGE_RENDER_TOKEN: 'old',
    });
    expect(buildChildEnv({ A: '1' })).toEqual({ A: '1' });
  });

  it('reaches a real child process through spawnClaude', async () => {
    const script =
      'process.stdout.write(JSON.stringify(Object.keys(process.env).filter((k) => /^(REELFORGE_|ANTHROPIC_)/i.test(k)).sort()))';
    const spawned = spawnClaude({ command: process.execPath, args: ['-e', script] }, [], {
      cwd: process.cwd(),
      env: { ...process.env, ANTHROPIC_API_KEY: 'k' },
      extraEnv: RENDER,
    });
    if (!spawned.ok) throw new Error(spawned.error);
    const child = spawned.value;
    child.stdin.end();
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    await new Promise((resolve) => child.once('close', resolve));
    expect(JSON.parse(stdout)).toEqual(['REELFORGE_RENDER_TOKEN', 'REELFORGE_RENDER_URL']);
  });
});
