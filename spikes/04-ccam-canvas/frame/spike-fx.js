// Spike 14.0 only: `kit.fx.inkStageSpike`, added to the kit's hidden app effects in the spike bundle only
// (build-harness.mjs). Modes: full = repaint + upload every frame; upload = empty paint + upload;
// static = painted once in build (render + post + readback cost only).
import { z } from 'zod';
import { asFx } from '../../../packages/kit/src/fx/shared.ts';
import { createInkStage } from '../../../packages/kit/src/fx/ink-stage.ts';
import { createKitObject } from '../../../packages/kit/src/object.ts';
import { defineFx } from '../../../packages/kit/src/registry.ts';
import { paintTestFrame } from './paint.js';

const params = z.object({
  mode: z.enum(['full', 'upload', 'static']).default('full'),
  upload: z.enum(['canvas', 'pixels']).default('canvas'),
  size: z.tuple([z.int(), z.int()]).default([1920, 1080]),
});

function build(input, tools) {
  const [width, height] = input.size;
  const stage = createInkStage(tools, {
    width,
    height,
    background: '#16120e',
    upload: input.upload,
  });
  const object = createKitObject(tools.three, {
    kitType: 'inkStageSpike',
    bounds: () => new tools.three.Box3(),
  });
  object.add(stage.mesh);
  const paint = (g, t) => paintTestFrame(g, t, width, height);
  const empty = () => undefined;
  let painted = false;
  return asFx(object, (t) => {
    if (input.mode === 'full' || !painted) stage.render(t, paint);
    else if (input.mode === 'upload') stage.render(t, empty);
    painted = true;
  });
}

export const inkStageSpike = defineFx({
  name: 'inkStageSpike',
  description: 'Spike 14.0 only.',
  params,
  build,
});
