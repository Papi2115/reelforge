// Test fixture scene (continuity links, PLAN.md#13.2): an office wall with a calendar. From 1.5 s
// the camera pushes toward the calendar along the line of sight, so the calendar grows but stays
// at about x 0.644, y 0.433 of the frame (the anchor the link tests use); a desk fan turns.
export const meta = { id: 's02', title: 'Calendar room', treatment: 'metaphor-object' };

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  return new three.Mesh(geometry, new three.MeshLambertMaterial({ color, flatShading: true }));
}

function calendar(three, palette) {
  const group = new three.Group();
  group.add(box(three, [1.2, 1.4, 0.06], palette.text));
  const header = box(three, [1.2, 0.34, 0.08], palette.accent2);
  header.position.y = 0.53;
  group.add(header);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const color = row === 2 && column === 3 ? palette.hero : palette.textDim;
      const cell = box(three, [0.14, 0.14, 0.08], color);
      cell.position.set(-0.44 + column * 0.22, 0.16 - row * 0.24, 0.01);
      group.add(cell);
    }
  }
  group.position.set(1.9, 2.1, -0.95);
  return group;
}

export function build(ctx) {
  const { three, scene, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(new three.AmbientLight(palette.fillLight, 1.6));
  const light = new three.DirectionalLight(palette.keyLight, 2.2);
  light.position.set(-3, 5, 6);
  scene.add(light);
  const wall = box(three, [14, 6, 0.2], palette.groundAlt);
  wall.position.set(0, 2, -1.1);
  const floor = box(three, [14, 0.2, 8], palette.ground);
  floor.position.set(0, -0.1, 2.9);
  const desk = box(three, [2.6, 0.18, 1.2], palette.hero);
  desk.position.set(-1.6, 1.0, 0.2);
  const fan = new three.Group();
  for (let blade = 0; blade < 3; blade += 1) {
    const arm = box(three, [0.7, 0.12, 0.04], palette.accent1);
    arm.position.x = 0.35;
    const holder = new three.Group();
    holder.rotation.z = (blade * Math.PI * 2) / 3;
    holder.add(arm);
    fan.add(holder);
  }
  fan.position.set(-2.2, 1.7, 0.3);
  scene.add(wall, floor, desk, fan, calendar(three, palette));
  return { fan };
}

// Camera -> calendar, the direction of the push-in.
const TOWARD = [1.9, 0.5, -7.92];

export function update(t, state, ctx) {
  const push = t < 1.5 ? 0 : Math.min(0.55, 0.22 * (t - 1.5));
  const [dx, dy, dz] = TOWARD.map((value) => value * push);
  ctx.camera.set({
    position: [dx, 1.6 + dy, 7 + dz],
    target: [dx, 1.6 + dy, dz],
    fov: 50,
  });
  state.fan.rotation.z = -2.4 * t;
}
