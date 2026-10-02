import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { launchHarnessBrowser, type HarnessBrowser } from '../../src/cli/harness-session.js';
import { manifest, STRIPES_SCENE } from '../support/manifests.js';

/** A kit calculator centred on the origin, a plain named box to its right and a lower third. */
const PICK_SCENE = {
  file: 'scenes/pick.js',
  source: `export const meta = { id: 'pick' };
export function build(ctx) {
  const { three, scene, kit, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.5));
  const calculator = kit.props.calculator({ scale: 2 });
  const centre = new three.Box3().setFromObject(calculator).getCenter(new three.Vector3());
  calculator.position.sub(centre);
  scene.add(calculator);
  const marker = new three.Mesh(
    new three.BoxGeometry(0.6, 0.6, 0.6),
    new three.MeshLambertMaterial({ color: palette.accent1 }),
  );
  marker.name = 'marker';
  marker.position.set(${String(2.6)}, 0, 0);
  scene.add(marker);
  return {};
}
export function update(t, state, ctx) {
  ctx.camera.set({ position: [0, 4, 4], target: [0, 0, 0], fov: 50 });
  ctx.text.lowerThird('Memory', '61 KB', { id: 'mem' });
}
`,
};

/** Normalized frame position of a world point, seen by the scene's camera. */
function project(point: readonly [number, number, number]): { x: number; y: number } {
  const camera = new THREE.PerspectiveCamera(50, 640 / 360, 0.1, 1000);
  camera.position.set(0, 4, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const ndc = new THREE.Vector3(...point).project(camera);
  return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2 };
}

let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
});

describe('pick (object under a point of the preview)', () => {
  it('names kit objects, plain objects and text cards; background is null', async () => {
    const page = await browser.open({ lint: true });
    try {
      await page.load(
        manifest([
          { id: 'a', t0: 0, t1: 3, scene: STRIPES_SCENE },
          { id: 'b', t0: 3, t1: 6, scene: PICK_SCENE },
        ]),
      );
      const before = await page.hashAt(4);

      const calculator = await page.pick(0.5, 0.5, 4);
      expect(calculator).toMatchObject({
        kind: 'kit',
        shotId: 'b',
        localTime: 1,
        name: 'calculator',
        id: 'props.calculator#0',
        kitKind: 'prop',
        call: 'kit.props.calculator()',
        occurrence: 0,
      });
      expect(calculator?.description).toMatch(/^calculator \(kit\.props\.calculator\(\) #1\) at /);
      expect(calculator?.size?.[0]).toBeGreaterThan(1);

      const markerPoint = project([2.6, 0, 0]);
      const marker = await page.pick(markerPoint.x, markerPoint.y, 4);
      expect(marker).toMatchObject({ kind: 'object', name: 'marker', id: 'object:marker#0' });
      expect(marker?.position).toEqual([2.6, 0, 0]);

      expect(await page.pick(0.02, 0.02, 4)).toBeNull();
      expect(await page.pick(1.5, 0.5, 4)).toBeNull();

      const texts = [];
      for (let y = 0.6; y < 1; y += 0.04) {
        for (let x = 0.05; x < 1; x += 0.05) {
          const hit = await page.pick(x, y, 4);
          if (hit?.kind === 'text') texts.push(hit);
        }
      }
      expect(texts.length).toBeGreaterThan(0);
      expect(texts[0]).toMatchObject({ shotId: 'b', id: 'text:mem' });
      expect(texts[0]?.name).toMatch(/memory/i);

      expect((await page.pick(0.5, 0.5, 1))?.shotId).toBe('a');
      // Picking renders nothing and leaves the video as it was.
      expect(await page.hashAt(4)).toBe(before);
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('rejects before a video is loaded', async () => {
    const page = await browser.open();
    try {
      await expect(page.pick(0.5, 0.5, 0)).rejects.toThrow(/pick\(\) before a successful load/);
    } finally {
      await page.close();
    }
  });
});
