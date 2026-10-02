// Fixture scene for the reelforge CLI tests: a voxel calculator whose screen lights up when
// "61 KB" is spoken (sfx "hit" on the anchor), a camera push-in and a lower third.
export const meta = { id: 's02', title: 'Calculator with 61 KB', treatment: 'metaphor-object' };

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  const material = new three.MeshLambertMaterial({ color, flatShading: true });
  return new three.Mesh(geometry, material);
}

export function build(ctx) {
  const { three, scene, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.HemisphereLight(palette.fillLight, palette.shadow, 2.2));
  const sun = new three.DirectionalLight(palette.keyLight, 2.8);
  sun.position.set(3, 6, 6);
  scene.add(sun);
  const desk = box(three, [8, 0.4, 5], palette.ground);
  desk.position.y = -0.2;
  const body = box(three, [2, 0.4, 3.2], palette.groundAlt);
  body.position.y = 0.2;
  const screenOff = box(three, [1.6, 0.05, 1], palette.shadow);
  screenOff.position.set(0, 0.43, -0.9);
  const screenOn = box(three, [1.6, 0.05, 1], palette.accent2);
  screenOn.position.set(0, 0.43, -0.9);
  const keys = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const key = box(
        three,
        [0.3, 0.12, 0.3],
        (row + column) % 3 === 0 ? palette.hero : palette.heroTrim,
      );
      key.position.set(-0.6 + column * 0.4, 0.46, 0.1 + row * 0.4);
      keys.push(key);
    }
  }
  scene.add(desk, body, screenOff, screenOn, ...keys);
  const hit = anchor('61 KB');
  sfx.at(hit.t, 'hit');
  return { screenOn, hit };
}

export function update(t, state, ctx) {
  ctx.camera.pushIn({
    target: [0, 0.3, 0],
    dist: [7, 4.5],
    to: state.hit.t,
    direction: [0.3, 0.8, 1],
  })(t);
  state.screenOn.visible = t >= state.hit.t;
  ctx.text.lowerThird('61 KB', 'of memory', { id: 'memory', at: state.hit.t });
}
