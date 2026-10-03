import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuiltShot } from '../shot.js';
import { checkCards, collectCardTimeline, formatCardDiagnostics } from '../text/check-cards.js';
import { deskCamera, deskShot, SPOKEN } from './testing.js';

/** Card QA as the runtime runs it: every sample is a probe (occlusion raycasts on). */
function qa(shot: BuiltShot): ReturnType<typeof checkCards> {
  return checkCards(
    collectCardTimeline({
      info: shot.info,
      safeArea: shot.safeArea,
      cards: () => shot.cards(),
      update: (t) => {
        shot.update(t, { probe: true });
      },
    }),
  );
}

describe('annotation targets and QA', () => {
  it('follows the camera: the same target lands elsewhere when the camera moves', () => {
    const shot = deskShot((t, s, ctx) => {
      deskCamera(ctx, -1.5 + 1.5 * t);
      ctx.annotate.ring({ id: 'r', target: { object: s.calc, anchor: 'screen' }, pulse: false });
    });
    const probeAt = (t: number): { x: number; extent: unknown } => {
      shot.update(t);
      const card = shot.cards()[0];
      return { x: card?.annotation?.targets[0]?.x ?? NaN, extent: card?.annotation?.extent };
    };
    const start = probeAt(0);
    const later = probeAt(2);
    expect(Math.abs(later.x - start.x)).toBeGreaterThan(20);
    expect(later.extent).not.toEqual(start.extent);
    expect(probeAt(0)).toEqual(start);
  });

  it('hides occluded pins (occlude: true) and warns about hidden targets', () => {
    const shot = deskShot(
      (_t, s, ctx) => {
        deskCamera(ctx);
        ctx.annotate.pin({
          id: 'hidden-pin',
          target: { object: s.calc, anchor: 'screen' },
          text: 'LCD',
          occlude: true,
        });
        ctx.annotate.ring({
          id: 'hidden-ring',
          target: { object: s.calc, anchor: 'screen' },
          until: 1,
        });
      },
      {
        extra: (ctx) => {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(6, 6, 0.2),
            new THREE.MeshBasicMaterial(),
          );
          wall.position.set(0, 2, 2.6);
          ctx.scene.add(wall);
        },
      },
    );
    shot.update(0.5);
    const pin = shot.cards().find((card) => card.id === 'hidden-pin');
    expect(pin).toMatchObject({ visible: false, annotation: { targets: [{ occluded: true }] } });
    const diagnostics = qa(shot);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        rule: 'annotation-target-hidden',
        severity: 'warning',
        cards: ['hidden-ring'],
        t0: 0,
        t1: 1,
      }),
    );
    expect(diagnostics.some((entry) => entry.cards.includes('hidden-pin'))).toBe(false);
  });

  it('warns when the target leaves the frame while the annotation is shown', () => {
    const shot = deskShot((t, s, ctx) => {
      deskCamera(ctx);
      // From t = 2 the camera looks away to the right.
      if (t >= 2) ctx.camera.set({ position: [0, 3.2, 4.2], target: [20, 1, 0] });
      ctx.annotate.arrow({ id: 'lost', target: s.calc, at: 0.5, until: 3.5 });
    });
    const [warning, ...rest] = qa(shot);
    expect(rest).toEqual([]);
    expect(warning).toMatchObject({
      rule: 'annotation-target-offscreen',
      severity: 'warning',
      t0: 2,
      t1: 3.5,
    });
    expect(formatCardDiagnostics([warning ?? (undefined as never)])).toMatch(
      /annotation "lost" points \(target\) at kit\.props\.calculator\(\), which is outside the frame .* Fix: Keep the target in view/,
    );
  });

  it('checks annotation times against their anchor phrases (±150 ms)', () => {
    const shot = deskShot(
      (_t, s, ctx) => {
        deskCamera(ctx);
        ctx.annotate.ring({ id: 'on-time', target: s.calc, phrase: 'keypad' });
        ctx.annotate.badge({ id: 'late', value: 1, target: s.calc, phrase: 'Look at', at: 1.2 });
      },
      { anchors: SPOKEN },
    );
    const diagnostics = qa(shot);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        rule: 'annotation-anchor',
        severity: 'info',
        anchor: { phrase: 'keypad', at: 1, spokenT: 1 },
      }),
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        rule: 'annotation-off-anchor',
        severity: 'warning',
        cards: ['late'],
      }),
    );
    expect(formatCardDiagnostics(diagnostics)).not.toContain('on-time');
    expect(formatCardDiagnostics(diagnostics)).toContain(
      'its phrase "Look at" is spoken at 0.50 s (+700 ms',
    );
  });

  it('reports annotation labels that overlap text cards, with an annotation hint', () => {
    const shot = deskShot((_t, _s, ctx) => {
      deskCamera(ctx);
      ctx.text.title('HEADLINE', { id: 'headline', pos: [0.5, 0.5] });
      ctx.annotate.stamp({ id: 'stamp', text: 'FAKE', pos: [0.5, 0.5], rotate: 0 });
    });
    const overlap = qa(shot).find((entry) => entry.rule === 'card-overlap');
    expect(overlap).toMatchObject({ cards: ['headline', 'stamp'] });
    expect(overlap?.fix).toMatch(/annotation pos \/ side \/ nudge/);
  });

  it('keeps auto-placed labels inside the safe area near the frame edge', () => {
    const shot = deskShot((_t, _s, ctx) => {
      deskCamera(ctx);
      ctx.annotate.pin({ id: 'edge', target: { screen: [0.97, 0.04] }, text: 'Top right corner' });
      ctx.annotate.callout({
        id: 'box',
        target: { screen: [0.03, 0.95] },
        text: 'Bottom left corner',
      });
    });
    expect(qa(shot).filter((entry) => entry.rule === 'card-outside-safe-area')).toEqual([]);
  });
});
