import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../kit.js';
import { CRISP_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { voxelLook } from '../voxel/index.js';
import { lookDefinitions } from '../types.js';
import { createCanvas } from './canvas.js';
import { ROLE_NAMES } from './colors.js';
import { crtPainter, retroCrtParams } from './crt.js';
import { resolveRoles } from './colors.js';
import { retroUiLook } from './index.js';
import { retroDocumentParams, documentPainter } from './document.js';
import { retroBrowserParams, browserPainter } from './browser.js';
import { retroTerminalParams, terminalPainter } from './terminal.js';
import { retroWindowParams, windowPainter } from './window.js';
import { desktopPainter, retroDesktopParams } from './desktop.js';
import type { RetroPainter } from './surface.js';

type Factory = (params?: unknown) => THREE.Object3D & {
  update(t: number): void;
  anchor(name?: string): THREE.Vector3;
  anchorNames(): string[];
  fitDistance(px?: number, fov?: number): number;
  show?: (child: unknown) => unknown;
};

function kit() {
  const { api } = createKit({
    three: THREE,
    palette: CRISP_PALETTE,
    rng: testRng(5),
    looks: [voxelLook, retroUiLook],
  });
  const props = api.props as unknown as Readonly<Record<string, Factory>>;
  const env = api.env as unknown as Readonly<Record<string, Factory>>;
  const get = (registry: Readonly<Record<string, Factory>>, name: string): Factory => {
    const factory = registry[name];
    if (!factory) throw new Error(`missing ${name}`);
    return factory;
  };
  return { prop: (name: string) => get(props, name), env: (name: string) => get(env, name) };
}

const PAINTERS: readonly (readonly [string, RetroPainter])[] = [
  ['window', windowPainter(retroWindowParams.parse({ content: 'dialog', stack: 2, click: 1 }))],
  ['progress', windowPainter(retroWindowParams.parse({ content: 'progress' }))],
  ['icons', windowPainter(retroWindowParams.parse({ content: 'icons', menu: ['FILE'] }))],
  ['image', windowPainter(retroWindowParams.parse({ content: 'image' }))],
  ['terminal', terminalPainter(retroTerminalParams.parse({}))],
  ['browser', browserPainter(retroBrowserParams.parse({ loadAt: 0.5, visitors: 3 }))],
  ['newspaper', documentPainter(retroDocumentParams.parse({ stamp: { at: 1 } }))],
  ['dossier', documentPainter(retroDocumentParams.parse({ variant: 'dossier' }))],
  ['memo', documentPainter(retroDocumentParams.parse({ variant: 'memo' }))],
  ['crt', crtPainter(retroCrtParams.parse({ powerOn: 0.2 }), resolveRoles(CRISP_PALETTE))],
  ['desktop', desktopPainter(retroDesktopParams.parse({}))],
];

describe('look retro-ui', () => {
  it('is available with six templates (redactedBlock: PLAN.md#12.26), one environment and docs', () => {
    expect(retroUiLook.available).toBe(true);
    expect(retroUiLook.rolls).toEqual(['B', 'C']);
    expect(lookDefinitions(retroUiLook).map((definition) => definition.name)).toEqual([
      'retroDesktop',
      'retroWindow',
      'retroTerminal',
      'retroBrowser',
      'retroDocument',
      'retroCrt',
      'redactedBlock',
    ]);
    for (const name of ['retroWindow', 'retroCrt', 'fitDistance', 'show(child)', 'mark:<text>']) {
      expect(retroUiLook.docs).toContain(name);
    }
  });

  it.each(PAINTERS)('%s paints only role indices, purely in t', (_name, painter) => {
    for (const t of [0, 0.6, 1.1, 3]) {
      const canvas = createCanvas(painter.width, painter.height);
      const anchors = painter.paint(canvas, t);
      const again = createCanvas(painter.width, painter.height);
      expect(painter.paint(again, t)).toEqual(anchors);
      expect(again.data).toEqual(canvas.data);
      expect(Math.max(...canvas.data)).toBeLessThanOrEqual(ROLE_NAMES.length);
      for (const [x, y] of Object.values(anchors)) {
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      }
    }
  });

  it('builds every template through ctx.kit with stable anchors', () => {
    const { prop, env } = kit();
    const window = prop('retroWindow')({ content: 'dialog', open: 1, click: 2 });
    expect(window.anchorNames()).toEqual(expect.arrayContaining(['title', 'close', 'button']));
    const before = window.anchor('button');
    window.update(3);
    expect(window.anchor('button')).toEqual(before);
    const terminal = prop('retroTerminal')({ lines: [{ text: 'RUN', input: true, at: 2 }] });
    expect(terminal.anchorNames()).toEqual(expect.arrayContaining(['line:0', 'cursor']));
    const document = prop('retroDocument')({ variant: 'dossier', stamp: { text: 'SECRET' } });
    expect(document.anchorNames()).toEqual(expect.arrayContaining(['stamp', 'field:0', 'photo']));
    const desk = env('retroDesktop')({ variant: 'desk' });
    expect(desk.anchorNames()).toContain('desk');
    const browser = prop('retroBrowser')({ marks: [{ text: 'DOOM' }] });
    expect(browser.anchorNames()).toEqual(expect.arrayContaining(['url', 'headline', 'mark:DOOM']));
  });

  it("shows a child through the CRT and passes the child's anchors through", () => {
    const { prop } = kit();
    const terminal = prop('retroTerminal')({ frame: 'none', size: [120, 90] });
    const crt = prop('retroCrt')({ size: [120, 90] });
    crt.show?.(terminal);
    expect(terminal.visible).toBe(false);
    expect(crt.anchorNames()).toEqual(
      expect.arrayContaining(['screen', 'led', 'cursor', 'line:0']),
    );
    const cursor = crt.anchor('cursor');
    expect(Math.abs(cursor.x)).toBeLessThan(1.2);
    expect(() => crt.show?.({})).toThrow(/retro-UI template/);
  });

  it('fits the camera: one UI pixel = px frame pixels at fov 50', () => {
    const { prop } = kit();
    const window = prop('retroWindow')({ pixel: 0.02 });
    const d = window.fitDistance(2);
    expect(2 * d * Math.tan((25 * Math.PI) / 180)).toBeCloseTo(3.6);
    expect(window.fitDistance(3)).toBeCloseTo((d * 2) / 3);
  });

  it('rejects bad params with the kit error', () => {
    const { prop } = kit();
    expect(() => prop('retroWindow')({ content: 'video' })).toThrow(/retroWindow\(\): invalid/);
    expect(() => prop('retroCrt')({ tint: 'blue' })).toThrow(/tint/);
  });
});
