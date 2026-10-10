/** Grim Ink's text fonts in an export: key, report line and the probe (PLAN.md#14.18). */
import { ok } from '@reelforge/claude-bridge';
import type { InkFonts, LoadInfo } from '@reelforge/engine';
import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { inkFontsKey, inkFontsWarning, probeInkFonts } from './ink-fonts.js';
import type { PooledTarget } from './render-pool.js';
import type { RenderTarget } from './render-target.js';

const INFO: LoadInfo & { fonts: InkFonts } = {
  duration: 2,
  style: 'c-cam',
  width: 1920,
  height: 1080,
  fps: 24,
  cues: [],
  anchors: [],
  gpu: { vendor: 'v', renderer: 'r', version: '1' },
  fonts: { fallback: true, missing: ['Impact', 'Arial Black'] },
};

function manifest(style: string): RenderManifest {
  return {
    version: 1,
    style,
    fps: 24,
    seed: 1,
    shots: [{ id: 'a', t0: 0, t1: 2, scene: { file: 'a.js', source: 'x' } }],
  };
}

function fakePool(): {
  pool: Parameters<typeof probeInkFonts>[0];
  loads: number;
  released: number;
} {
  const state = { loads: 0, released: 0 };
  const target = {
    load: () => {
      state.loads += 1;
      return Promise.resolve(ok(INFO));
    },
  } as unknown as RenderTarget;
  const entry: PooledTarget = { target, loaded: null };
  return {
    pool: {
      acquire: () => Promise.resolve(ok(entry)),
      release: () => {
        state.released += 1;
        return Promise.resolve();
      },
    },
    get loads() {
      return state.loads;
    },
    get released() {
      return state.released;
    },
  };
}

describe('Grim Ink fonts in an export', () => {
  it('keys and reports a fallback, says nothing when every font is there', () => {
    expect(inkFontsKey({ fallback: false, missing: [] })).toBe('system');
    expect(inkFontsKey({ fallback: true, missing: ['Impact', 'Arial Black'] })).toBe(
      'fallback:Arial Black,Impact',
    );
    expect(inkFontsWarning({ fallback: false, missing: [] })).toBeUndefined();
    expect(inkFontsWarning({ fallback: true, missing: ['Impact'] })).toMatch(
      /^font fallback used: Impact not installed/,
    );
  });

  it('probes a Grim Ink video in one pooled window and skips every other style', async () => {
    const probe = fakePool();
    expect(await probeInkFonts(probe.pool, manifest('c-cam'))).toEqual(INFO.fonts);
    expect([probe.loads, probe.released]).toEqual([1, 1]);
    const other = fakePool();
    expect(await probeInkFonts(other.pool, manifest('voxel-pixel-crisp640'))).toBeUndefined();
    expect(other.loads).toBe(0);
  });
});
