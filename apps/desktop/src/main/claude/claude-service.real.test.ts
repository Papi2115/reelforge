/**
 * REAL Claude Code smoke test of the chat service (PLAN.md#6.6). Spends ONE tiny haiku turn on the
 * user's subscription, so it only runs with REELFORGE_REAL_CLAUDE=1 (never in CI/default runs):
 *   REELFORGE_REAL_CLAUDE=1 pnpm exec vitest run --project unit claude-service.real
 */
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkConnection, ok } from '@reelforge/claude-bridge';
import { defaultAppSettings } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { launcherOf } from './claude-runtime.js';
import { ClaudeService } from './claude-service.js';

const REAL = process.env['REELFORGE_REAL_CLAUDE'] === '1';
const project = mkdtempSync(path.join(os.tmpdir(), 'rf real chat '));
const hookScript = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'claude-bridge',
  'hooks',
  'bash-guard.mjs',
);

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

describe.skipIf(!REAL)('real claude: one chat turn', () => {
  it('answers a trivial Whole-video message on haiku without tools', async () => {
    const settings = defaultAppSettings();
    const service = new ClaudeService({
      setup: async () => {
        const launcher = launcherOf(await checkConnection({ cwd: project }));
        if (!launcher.ok) return launcher;
        return ok({
          launcher: launcher.value,
          env: process.env,
          permissions: { hookRuntime: process.execPath, hookScriptPath: hookScript },
        });
      },
      settings: () => ({ ...settings, chat: { model: 'haiku', boostModel: 'haiku' } }),
      currentProject: () => project,
      renderEnv: () => undefined,
      commit: () => Promise.resolve(ok({ status: 'nothing-to-commit' })),
      push: () => undefined,
      log: createLogger(() => undefined),
    });
    try {
      const sent = await service.send({
        text: 'This is a connection test. Do not use any tools. Reply with exactly the word PONG.',
        chip: null,
        scope: 'video',
        shotIds: [],
        selection: null,
        boost: false,
      });
      expect(sent.status).toBe('queued');
      const deadline = Date.now() + 180_000;
      while (service.state().turns[0]?.finishedAt == null) {
        if (Date.now() > deadline) throw new Error('no answer within 3 min');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const [turn] = service.state().turns;
      expect(turn?.status).toBe('done');
      expect(turn?.request.model).toBe('haiku');
      const text = turn?.steps
        .flatMap((step) => (step.type === 'text' ? [step.text] : []))
        .join('');
      expect(text).toMatch(/PONG/);
    } finally {
      await service.dispose();
    }
  }, 240_000);
});
