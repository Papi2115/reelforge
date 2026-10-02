// Test fixture scene: rising teal/green columns on a pink-magenta backdrop. Deliberately unlike
// examples/s00_hello.js so transition frames clearly mix two different images.
export const meta = { id: 's01', title: 'Stripes', treatment: 'montage/transition' };

const COLUMNS = 9;

export function build(ctx) {
  const { three, scene, palette, rng } = ctx;
  scene.background = new three.Color(palette.magenta);
  scene.add(new three.AmbientLight(palette.cream, 1.8));
  const light = new three.DirectionalLight(palette.cream, 2.4);
  light.position.set(-3, 5, 6);
  scene.add(light);
  const columns = [];
  for (let index = 0; index < COLUMNS; index += 1) {
    const color = index % 2 === 0 ? palette.brightTeal : palette.green;
    const geometry = new three.BoxGeometry(0.8, 1, 0.8);
    const column = new three.Mesh(geometry, new three.MeshLambertMaterial({ color }));
    column.position.x = (index - (COLUMNS - 1) / 2) * 1.1;
    columns.push({ column, speed: rng.range(0.6, 1.6) });
    scene.add(column);
  }
  return { columns };
}

export function update(t, state, ctx) {
  ctx.camera.set({ position: [0, 1.5, 9 - 0.3 * t], target: [0, 1, 0] });
  for (const { column, speed } of state.columns) {
    const height = 1 + 2.5 * Math.abs(Math.sin(t * speed));
    column.scale.y = height;
    column.position.y = height / 2;
  }
}
