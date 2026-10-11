/**
 * Preview pictures of the styles for the wizard's Style step (PLAN.md#13.16): one frame of each
 * style, copied from the kit's own golden renders (packages/kit/test/goldens/swiftshader, our own
 * work, docs/licenses.md). A style without a picture shows its colours instead.
 */
import cCam from './thumbs/c-cam.png';
import comic from './thumbs/comic.png';
import gameB1 from './thumbs/game-b1.png';
import gameB2 from './thumbs/game-b2.png';
import noirVoxel from './thumbs/noir-voxel.png';
import sketchbook from './thumbs/sketchbook.png';
import soft480 from './thumbs/soft-480.png';
import voxelCrisp from './thumbs/voxel-pixel-crisp640.png';

const STYLE_THUMBS: Readonly<Record<string, string>> = {
  'voxel-pixel-crisp640': voxelCrisp,
  'noir-voxel': noirVoxel,
  'soft-480': soft480,
  sketchbook,
  comic,
  'game-b2': gameB2,
  'game-b1': gameB1,
  'c-cam': cCam,
};

export function styleThumb(styleId: string): string | undefined {
  return STYLE_THUMBS[styleId];
}
