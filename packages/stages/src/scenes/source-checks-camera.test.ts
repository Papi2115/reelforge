/** Static check of camera-based pattern interrupts (real run v2.3: s08 dolly zoom, s17 orbit). */
import { describe, expect, it } from 'vitest';
import {
  cameraInterruptFindings,
  MAX_DOLLY_ZOOM_RATIO,
  MAX_INTERRUPT_ORBIT_DEGREES,
} from './source-checks-camera.js';

const SCALE = { kind: 'scale-shift', note: 'dive into one core' } as const;
const PERSPECTIVE = { kind: 'perspective-shift', note: 'orbit to a top-down view' } as const;

function scene(update: string): string {
  return `export const meta = { id: 's08' };
export function build(ctx) { return { agc: ctx.kit.props.prism({}) }; }
export function update(t, s, ctx) {
  const { camera, annotate } = ctx;
  camera.orbit({ radius: 6, degrees: [-18, 12], from: 0, to: 4 })(t);
${update}
}
`;
}

describe('cameraInterruptFindings', () => {
  it('flags the s08 dolly zoom (1.6 -> 4) and the s17 orbit (72 degrees) as warnings', () => {
    const s08 = scene(`  camera.dollyZoom({ from: 1.6, to: 4, t0: 0, t1: 1.2, subject: s.agc });
  annotate.stamp({ text: 'BY HAND', phrase: 'woven' });`);
    const dolly = cameraInterruptFindings(s08, 'scenes/s08.js', SCALE);
    expect(dolly).toHaveLength(1);
    expect(dolly[0]?.severity).toBe('warning');
    expect(dolly[0]?.message).toContain('scenes/s08.js:6 ctx.camera.dollyZoom');
    expect(dolly[0]?.message).toContain('2.5x');
    const s17 = scene(`  camera.orbit({ degrees: 72, t0: 0.15, t1: 1.5, axis: 'x' });
  camera.rackFocus({ from: s.agc, to: s.agc, t0: 0.15, t1: 1.4 });
  annotate.badge({ value: 1, target: { object: s.agc, anchor: 'top' } });`);
    const orbit = cameraInterruptFindings(s17, 'scenes/s17.js', PERSPECTIVE);
    expect(orbit.map((item) => item.message)).toEqual([
      expect.stringContaining('an orbit of 72 degrees'),
      expect.stringContaining('ctx.camera.orbit, ctx.camera.rackFocus'),
    ]);
    expect(orbit[1]?.message).toContain('nothing on screen says what the viewer looks at');
  });

  it('accepts moves within the limits around a labelled subject', () => {
    expect(MAX_DOLLY_ZOOM_RATIO).toBe(2);
    const source = scene(`  camera.dollyZoom({ from: 6, to: 3, t0: 0, t1: 1 });
  camera.orbit({ degrees: -${String(MAX_INTERRUPT_ORBIT_DEGREES)}, t0: 0, t1: 1.4 });
  annotate.callout({ title: 'CORE', text: 'ONE BIT', target: { object: s.agc } });`);
    expect(cameraInterruptFindings(source, 'scenes/s.js', SCALE)).toEqual([]);
    const titled = scene(`  camera.rackFocus({ from: 2, to: 6, t0: 0, t1: 1 });
  ctx.text.title('PRIORITY');`);
    expect(cameraInterruptFindings(titled, 'scenes/s.js', PERSPECTIVE)).toEqual([]);
  });

  it('ignores shots without an interrupt, rig-only cameras and unparsable sources', () => {
    const wild = scene(`  camera.dollyZoom({ from: 1, to: 9, t0: 0, t1: 1 });`);
    expect(cameraInterruptFindings(wild, 'scenes/s.js', undefined)).toEqual([]);
    expect(cameraInterruptFindings(scene(''), 'scenes/s.js', SCALE)).toEqual([]);
    expect(cameraInterruptFindings('export function (', 'scenes/s.js', SCALE)).toEqual([]);
  });

  it('does not judge computed values; an empty label does not count', () => {
    const source = scene(`  const far = 2 + t;
  camera.dollyZoom({ from: far, to: 1, t0: 0, t1: 1 });
  annotate.callout({ text: '', target: { object: s.agc } });`);
    const findings = cameraInterruptFindings(source, 'scenes/s.js', SCALE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('nothing on screen');
  });
});
