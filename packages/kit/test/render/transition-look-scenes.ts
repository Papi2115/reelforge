/** One scene per look for the transition tests between looks (voxel, retro-ui, diorama, blueprint). */
import { DEMO_FILE, sceneSource } from '../support/scenes.js';
import { blueprintSource } from './look-blueprint-scenes.js';

export type LookId = 'voxel' | 'retro-ui' | 'diorama' | 'blueprint';

const DIORAMA_SCENE = `
export const meta = { id: 'dio', title: 'Diorama office', treatment: '3d-reconstruction' };

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  const diorama = kit.env.dioramaOffice({ seed: 3 });
  scene.add(diorama);
  return { diorama };
}

export function update(t, state, ctx) {
  state.diorama.update(t);
  ctx.camera.set(state.diorama.camera({ t, screen: [ctx.shot.width, ctx.shot.height] }));
}
`;

export const LOOK_SCENES: Readonly<
  Record<LookId, { readonly file: string; readonly source: string }>
> = {
  voxel: { file: DEMO_FILE, source: sceneSource(DEMO_FILE) },
  'retro-ui': {
    file: 'examples/look_retro_ui.js',
    source: sceneSource('examples/look_retro_ui.js'),
  },
  diorama: { file: 'look-diorama-office.js', source: DIORAMA_SCENE },
  blueprint: { file: 'look-blueprint.js', source: blueprintSource('graph') },
};
