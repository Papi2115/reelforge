import { describe, expect, it } from 'vitest';
import { createVoxelScene, type VoxelScene } from './voxel-scene.ts';

function snapshot(voxelScene: VoxelScene): number[] {
  voxelScene.scene.updateMatrixWorld(true);
  const values: number[] = [...voxelScene.camera.matrixWorld.elements];
  voxelScene.scene.traverse((object) => {
    values.push(...object.matrixWorld.elements);
  });
  return values;
}

describe('createVoxelScene', () => {
  it('is a pure function of t: state does not depend on seek history', () => {
    const fresh = createVoxelScene(1337, 16 / 9);
    fresh.update(3.3);
    const expected = snapshot(fresh);

    const scrubbed = createVoxelScene(1337, 16 / 9);
    for (const t of [9.5, 0, 7.25, 1.1]) scrubbed.update(t);
    scrubbed.update(3.3);
    expect(snapshot(scrubbed)).toEqual(expected);
  });

  it('builds identical scenes for the same seed and different ones for another seed', () => {
    const a = createVoxelScene(1, 16 / 9);
    const b = createVoxelScene(1, 16 / 9);
    const c = createVoxelScene(2, 16 / 9);
    for (const scene of [a, b, c]) scene.update(2);
    expect(snapshot(a)).toEqual(snapshot(b));
    expect(snapshot(a)).not.toEqual(snapshot(c));
  });

  it('moves the camera over time', () => {
    const voxelScene = createVoxelScene(1, 16 / 9);
    voxelScene.update(0);
    const start = voxelScene.camera.position.clone();
    voxelScene.update(5);
    expect(voxelScene.camera.position.distanceTo(start)).toBeGreaterThan(1);
  });
});
