// Test fixture scene (continuity links, PLAN.md#13.2): the calendar page of s02_calendar_room.js
// filling the frame, the camera pulling back slowly; the marked day pulses.
export const meta = { id: 's03', title: 'Calendar page', treatment: 'metaphor-object' };

function box(three, size, color) {
  const geometry = new three.BoxGeometry(size[0], size[1], size[2]);
  return new three.Mesh(geometry, new three.MeshLambertMaterial({ color, flatShading: true }));
}

export function build(ctx) {
  const { three, scene, palette } = ctx;
  scene.background = new three.Color(palette.groundAlt);
  scene.add(new three.AmbientLight(palette.fillLight, 1.8));
  const light = new three.DirectionalLight(palette.keyLight, 1.6);
  light.position.set(-2, 3, 6);
  scene.add(light);
  scene.add(box(three, [9.8, 5.8, 0.1], palette.text));
  const header = box(three, [9.8, 1.1, 0.14], palette.accent2);
  header.position.y = 2.35;
  scene.add(header);
  let marked;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      const isMarked = row === 2 && column === 3;
      const cell = box(three, [1.2, 0.8, 0.14], isMarked ? palette.hero : palette.textDim);
      cell.position.set(-3.4 + column * 1.7, 1.1 - row * 1.05, 0.05);
      scene.add(cell);
      if (isMarked) marked = cell;
    }
  }
  return { marked };
}

export function update(t, state, ctx) {
  ctx.camera.set({ position: [0, 0, 5 + 0.25 * t], target: [0, 0, 0], fov: 50 });
  const pulse = 1 + 0.12 * Math.abs(Math.sin(t * 2.5));
  state.marked.scale.set(pulse, pulse, 1);
}
