/**
 * Real run Sketchbook 3 #3/#4: `ctx.camera` moves on a page do nothing (use `page.push`), and a
 * pop-up whose cover lifts while the shot's page transition still covers the frame.
 */
import { describe, expect, it } from 'vitest';
import { parseScene } from '../slop/source-text.js';
import { pageCameraFindings, popupEntryFindings, sketchbookShotChecks } from './index.js';

function program(body: string) {
  const parsed = parseScene(`export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [960, 540], duration: ctx.shot.duration });
  ctx.scene.add(page);
${body}
  return { page };
}
export function update(t, ctx, state) {
  state.page.update(t);
}`);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const FLIP = { type: 'wipe', duration: 0.95, style: 'sketchbook-page-flip' } as const;
const popup = (at: string) =>
  `  page.popup({ intent: 'the level rises', x: 330, y: 260, w: 420${at}, elements: [{ kind: 'gauge', id: 'g', u: 110, v: 20 }] });`;

describe('camera moves on a page', () => {
  it('flags ctx.camera and points to page.push', () => {
    const findings = pageCameraFindings(
      program('  ctx.camera.pushIn({ from: 0, to: 3, dist: [6, 4] });'),
      'scenes/s08.js',
    );
    expect(findings.map((entry) => entry.message)).toEqual([
      'ctx.camera on a Sketchbook page (scenes/s08.js:4): the page is full frame, a camera move does nothing. Push toward the focal drawing with page.push({ focus: [x, y], at, until, scale }), or hold the frame.',
    ]);
    expect(findings[0]?.severity).toBe('warning');
  });

  it('accepts the page push', () => {
    const source = program('  page.push({ focus: [640, 300], at: 1.5, until: 4 });');
    expect(pageCameraFindings(source, 'scenes/s08.js')).toEqual([]);
  });
});

describe('a pop-up under the page transition', () => {
  it('flags an opening hidden under the transition (default and early at)', () => {
    for (const at of ['', ', at: 0.2', ', at: -0.5']) {
      const [message, ...rest] = popupEntryFindings(program(popup(at)), 'scenes/s05.js', FLIP).map(
        (entry) => entry.message,
      );
      expect(rest).toEqual([]);
      expect(message).toMatch(
        /^pop-up opens under the page transition \(scenes\/s05\.js:4\): .* sketchbook-page-flip covers the frame until 0\.95 s\. Set the pop-up's at >= 0\.95/,
      );
    }
  });

  it('accepts an opening after the transition, a cut, and a spoken-phrase time', () => {
    const late = program(popup(', at: 1'));
    expect(popupEntryFindings(late, 's.js', FLIP)).toEqual([]);
    expect(popupEntryFindings(program(popup('')), 's.js', { type: 'cut' })).toEqual([]);
    expect(popupEntryFindings(program(popup('')), 's.js', undefined)).toEqual([]);
    expect(popupEntryFindings(program(popup(", at: 'the level'")), 's.js', FLIP)).toEqual([]);
    expect(sketchbookShotChecks(late, 's.js', { transitionIn: FLIP })).toEqual([]);
    expect(sketchbookShotChecks(program(popup('')), 's.js', { transitionIn: FLIP })).toHaveLength(
      1,
    );
  });
});
