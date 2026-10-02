// s03 · metaphor-object: a school calculator on an exam bench, running Doom. The camera pushes
// in from the classroom to the desk; on "61 KB" the screen glitches, the camera kicks and the
// lower third names the number.
export const meta = {
  id: 's03',
  title: 'Calculator on the exam bench',
  treatment: 'metaphor-object',
};

const GLITCH_DECAY_S = 0.9;

export function build(ctx) {
  const { kit, scene, three, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default', azimuth: 30 }));
  const room = kit.env.room({
    width: 9,
    depth: 7,
    rug: true,
    floor: 'ground',
    floorAlt: 'groundAlt',
    windowColor: 'accent3',
  });
  const bench = kit.props.bench({ chair: true, scale: 1.4 });
  bench.on(room);
  const calculator = kit.props.calculator({ screen: 'doom', seed: 2, scale: 0.8 });
  bench.mount(calculator, 'spotRight');
  calculator.rotation.y = -0.35;
  const paper = kit.props.paper({ variant: 'lines', title: 'EXAM', seed: 3, scale: 0.8 });
  bench.mount(paper, 'spotLeft');
  paper.rotation.y = 0.2;
  const clock = kit.props.clock({ style: 'wall', time: '09:58', speed: 30, scale: 1.2 });
  room.mount(clock, 'backWall', { align: 'back' });
  clock.position.x -= 2.6;
  scene.add(room);
  scene.updateMatrixWorld(true);
  const calculatorAt = calculator.localToWorld(calculator.anchor('screen')).toArray();
  const hit = anchor('61 KB');
  sfx.at(hit.t, 'glitch');
  return { calculator, clock, hit, calculatorAt };
}

function glitchAmount(t, hit) {
  if (t < hit.t) return 0;
  const k = (t - hit.t) / GLITCH_DECAY_S;
  return k >= 1 ? 0.15 : 1 - 0.85 * k;
}

export function update(t, s, ctx) {
  const target = s.calculatorAt;
  const push = ctx.camera.pushIn({
    target: [target[0] - 0.45, target[1] + 0.05, target[2] + 0.2],
    dist: [8, 2.6],
    direction: [0.55, 0.65, 1],
    to: s.hit.t,
    ease: 'easeInOutCubic',
  });
  const pose = push(t);
  ctx.camera.shake(() => pose, { amplitude: 0.06, from: s.hit.t, to: s.hit.t + 0.4 })(t);
  s.clock.update(t);
  s.calculator.screen.glitch(glitchAmount(t, s.hit));
  s.calculator.update(t);
  ctx.text.lowerThird('ONLY 61 KB', 'of memory, on a school calculator', {
    id: 'memory',
    at: s.hit.t,
    scale: 3,
  });
}
