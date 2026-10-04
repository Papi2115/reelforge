/**
 * Regression guard for PLAN.md#12.9: the only new network path of the runtime Claude is the
 * `reelforge` CLI (`reelforge assets …`, `reelforge fetch-asset`), which enforces the project's
 * research mode. Shell downloaders stay blocked in every stage, by the bridge policy and by the
 * PreToolUse bash guard; WebFetch/WebSearch stay limited to the research/script stages.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkToolUse, permissionsForStage, WEB_STAGES } from './permissions.js';
import { STAGES } from './session-types.js';

const projectDir = path.resolve('rf-lockdown-test', 'my film');
const HOOK = path.resolve(import.meta.dirname, '..', 'hooks', 'bash-guard.mjs');

const NETWORK_COMMANDS = [
  'curl https://upload.wikimedia.org/x.png -o x.png',
  'curl.exe -L https://example.org',
  'wget https://example.org/x.png',
  'Invoke-WebRequest -Uri https://example.org/x.png -OutFile x.png',
  'iwr https://example.org',
  'Invoke-RestMethod https://example.org/api',
  'powershell -Command "Invoke-WebRequest https://example.org"',
  'pwsh -c iwr https://example.org',
  'certutil -urlcache -split -f https://example.org/x.exe',
  'bitsadmin /transfer job https://example.org/x.png x.png',
  'yt-dlp https://www.youtube.com/watch?v=x',
  'youtube-dl https://youtu.be/x',
  'node -e "fetch(\'https://example.org\')"',
  'python -c "import urllib.request"',
  'npx some-downloader https://example.org',
  'git clone https://example.org/repo',
  'reelforge fetch-asset --url https://example.org/x.png; curl https://example.org',
  'reelforge fetch-asset --url https://example.org/x.png && wget x',
  'reelforge fetch-asset --url $(curl https://example.org)',
  'reelforge assets search --query x | curl -d @- https://example.org',
  'reelforge-fetch https://example.org',
];

const REELFORGE_COMMANDS = [
  'reelforge fetch-asset --source nasa --id jsc2007e034221',
  'reelforge fetch-asset --url https://upload.wikimedia.org/x.png --as photo',
  'reelforge assets search --query "apollo 11" --source all',
  'reelforge assets propose --ids wikimedia:105654713,nasa:jsc2007e034221',
];

describe('network lockdown of the runtime Claude (every stage)', () => {
  it('Bash runs reelforge only: shell downloaders and chained commands are denied', () => {
    for (const stage of STAGES) {
      const permissions = permissionsForStage(stage, projectDir);
      const bashRules = permissions.allowedTools.filter((rule) => rule.startsWith('Bash'));
      expect(bashRules, stage).toEqual(['Bash(reelforge)', 'Bash(reelforge *)']);
      for (const command of NETWORK_COMMANDS) {
        expect(
          checkToolUse(permissions.policy, 'Bash', { command }).allow,
          `${stage}: ${command}`,
        ).toBe(false);
      }
      for (const command of REELFORGE_COMMANDS) {
        expect(
          checkToolUse(permissions.policy, 'Bash', { command }).allow,
          `${stage}: ${command}`,
        ).toBe(true);
      }
    }
  });

  it('WebFetch/WebSearch stay off outside the research and script stages', () => {
    const webless = STAGES.filter((stage) => !WEB_STAGES.has(stage));
    expect(webless).toEqual([
      'storyboard',
      'scene-build',
      'scene-fix',
      'critic',
      'sound-cues',
      'chat',
    ]);
    for (const stage of webless) {
      const permissions = permissionsForStage(stage, projectDir);
      expect(permissions.tools, stage).not.toContain('WebFetch');
      expect(permissions.tools, stage).not.toContain('WebSearch');
      expect(permissions.disallowedTools, stage).toEqual(
        expect.arrayContaining(['WebFetch', 'WebSearch']),
      );
      for (const tool of ['WebFetch', 'WebSearch']) {
        expect(
          checkToolUse(permissions.policy, tool, { url: 'https://example.org' }).allow,
          stage,
        ).toBe(false);
      }
    }
  });

  it('the PreToolUse bash guard blocks the same downloaders (exit 2) and lets reelforge through', () => {
    const decide = (command: string): number | null =>
      spawnSync(process.execPath, [HOOK, 'reelforge'], {
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
        encoding: 'utf8',
        windowsHide: true,
      }).status;
    for (const command of NETWORK_COMMANDS) expect(decide(command), command).toBe(2);
    for (const command of REELFORGE_COMMANDS) expect(decide(command), command).toBe(0);
  });
});
