import type { WorldAssetsReport } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { StageRunView } from '../../shared/stages-contract.js';
import type { LookAssets } from '../../shared/voiceover-contract.js';
import {
  DESIGN_LOOK_ASSETS,
  designingLookAssets,
  lookAssetsView,
  REDO_LOOK_ASSETS,
} from './look-assets-view.js';

function report(patch: Partial<WorldAssetsReport> = {}): WorldAssetsReport {
  return {
    version: 1,
    world: 'comic',
    storyboardHash: 'a'.repeat(64),
    status: 'built',
    attempts: 1,
    files: ['assets/comic/keeper.json'],
    ids: ['keeper', 'lamp'],
    findings: [],
    notes: [],
    updatedAt: '2026-10-07T10:00:00.000Z',
    ...patch,
  };
}

function look(patch: Partial<LookAssets> = {}): LookAssets {
  return {
    world: 'comic',
    report: report(),
    storyboardChanged: false,
    assets: [
      { id: 'keeper', name: 'The keeper', kind: 'character', file: 'assets/comic/keeper.json' },
      { id: 'lamp', name: 'lamp', kind: null, file: 'assets/comic/lamp.json' },
    ],
    ...patch,
  };
}

function run(patch: Partial<StageRunView>): StageRunView {
  return {
    stage: 'scenes',
    label: null,
    percent: null,
    startedAt: 0,
    steps: [],
    paused: null,
    action: null,
    targets: null,
    shots: {},
    ...patch,
  };
}

const idle = { running: null, busy: false, hasShots: true } as const;

describe('lookAssetsView', () => {
  it('says the set is not designed yet and offers to design it', () => {
    const view = lookAssetsView(look({ report: null, assets: [] }), idle);
    expect(view).toMatchObject({
      status: 'Not designed yet. Scenes built designs them before the first scene.',
      tone: 'none',
      rows: [],
      button: { label: DESIGN_LOOK_ASSETS, disabled: false },
    });
  });

  it('counts a built set and lists the assets by name', () => {
    const view = lookAssetsView(look(), idle);
    expect(view.status).toBe('2 look assets built ✓');
    expect(view.tone).toBe('ok');
    expect(view.button.label).toBe(REDO_LOOK_ASSETS);
    expect(view.rows).toEqual([
      { key: 'assets/comic/keeper.json#keeper', name: 'The keeper', detail: 'character · keeper' },
      { key: 'assets/comic/lamp.json#lamp', name: 'lamp', detail: 'assets/comic/lamp.json' },
    ]);
  });

  it('shows the findings of a kept set and a failed one', () => {
    const warned = lookAssetsView(
      look({ report: report({ status: 'warning', findings: ['lamp unreadable at thumbnail'] }) }),
      idle,
    );
    expect(warned).toMatchObject({
      status: '2 look assets built · ⚠ 1 finding',
      tone: 'warning',
      findings: ['lamp unreadable at thumbnail'],
    });
    const failed = lookAssetsView(
      look({ report: report({ status: 'failed', ids: [], findings: ['no files'] }) }),
      idle,
    );
    expect(failed).toMatchObject({ tone: 'failed', button: { label: DESIGN_LOOK_ASSETS } });
  });

  it('notes a storyboard changed since the design', () => {
    expect(lookAssetsView(look({ storyboardChanged: true }), idle).note).toBe(
      'The storyboard changed since: the next Scenes build designs them again.',
    );
    expect(lookAssetsView(look(), idle).note).toBeNull();
  });

  it('shows the design while it runs and blocks the button', () => {
    const view = lookAssetsView(look({ storyboardChanged: true }), {
      running: run({ action: 'world-assets' }),
      busy: true,
      hasShots: true,
    });
    expect(view).toMatchObject({
      status: 'Designing look assets…',
      tone: 'running',
      note: null,
      button: { disabled: true, title: 'Scenes built is running or queued.' },
    });
    expect(lookAssetsView(look(), { ...idle, hasShots: false }).button).toMatchObject({
      disabled: true,
      title: 'No shots yet: run Storyboard first.',
    });
  });
});

describe('designingLookAssets', () => {
  it('sees the action and the world-assets turn inside a build', () => {
    expect(designingLookAssets(run({ action: 'world-assets' }))).toBe(true);
    expect(designingLookAssets(run({ label: 'Claude: world assets' }))).toBe(true);
    expect(designingLookAssets(run({ label: 'Claude: scene-build s01' }))).toBe(false);
    expect(designingLookAssets(run({ stage: 'words', action: 'world-assets' }))).toBe(false);
    expect(designingLookAssets(null)).toBe(false);
  });
});
