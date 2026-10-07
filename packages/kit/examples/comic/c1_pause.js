// Comic look C (comic-loud), template 1: "the pause" (showcase comic-panels-v2 shot 8).
// Before the twist the page holds its breath: everything is cut away for one almost empty panel
// of flat grey ground. The only detail is Eagle's own shadow, small, creeping left in held steps,
// and the first dust its engine lifts. No lettering: the silence is the beat.
// Focal: the shadow (the only dark shape in a field of pale grey).
// Traces: the shadow moves in held 0.45 s steps (never smoothly), the dust re-scatters each step,
// plates off register on the shallow craters, the panel's pencils past its corners, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cc1',
  title: 'Comic loud: the pause',
  treatment: 'montage/transition',
};

const PAUSE = [70, 64, 604, 66, 602, 300, 72, 297];
const STEP = 0.45;

/** A shallow crater seen obliquely, sun from the left: shadowed wall, lit floor. */
function crater(g, x, y, r) {
  const F = g.plate;
  const ry = r * 0.4;
  const lx = F.x(x + r * 0.36);
  const ly = F.y(y - ry * 0.1);
  const lr = r * F.s * 0.86;
  const lry = ry * F.s * 0.86;
  const floor = g.layer(g.tone('greyMid', 0.3), 'greyLight');
  const wall = g.color('greyMid');
  F.ellipse(x, y, r, ry, (sx, sy) => {
    const dx = (sx + 0.5 - lx) / lr;
    const dy = (sy + 0.5 - ly) / lry;
    return dx * dx + dy * dy < 1 ? floor(sx, sy) : wall;
  });
}

/** Eagle's shadow under a low sun: the silhouette laid flat, stretched away from the light. */
function lmShadow(g, paint, stretch, squash) {
  const flat = (pts) => {
    const out = [];
    for (let i = 0; i < pts.length; i += 2) out.push(-pts[i + 1] * stretch + 70, pts[i] * squash);
    return out;
  };
  g.poly(flat([-33, 3, 33, 3, 33, 22, -33, 22]), paint);
  g.poly(flat([-27, -9, -22, -26, -11, -33, 11, -33, 22, -26, 27, -9, 25, 3, -25, 3]), paint);
  g.poly(flat([-5, -37, 5, -37, 5, -33, -5, -33]), paint);
  g.poly(flat([12, -38, 20, -38, 20, -44, 12, -44]), paint);
  for (const side of [-1, 1]) {
    const a = flat([side * 28, 6, side * 49, 37]);
    g.line(a[0], a[1], a[2], a[3], paint, g.w(2.4));
  }
  const f = flat([0, 22, 0, 38]);
  g.line(f[0], f[1], f[2], f[3], paint, g.w(2.4));
  for (const [px, py] of [
    [-50, 39],
    [50, 39],
    [0, 40],
  ]) {
    const q = flat([px, py]);
    g.ellipse(q[0], q[1], 3, 5 * squash + 1, paint);
  }
}

function field(g, t) {
  g.plate.rect(
    0,
    0,
    640,
    360,
    g.layer(g.tone('greyMid', 0.07, { cell: 4, angle: 0.78 }), 'greyLight'),
  );
  for (let i = 0; i < 6; i++) {
    crater(g, 110 + g.rnd('pc', i) * 460, 90 + g.rnd('pcy', i) * 190, 3 + g.rnd('pcr', i) * 5);
  }
  // The only detail: the shadow, creeping left in held steps, and the first dust fanning out.
  const step = Math.floor(t / STEP);
  lmShadow(g.at(388 - step, 224, 0.9), 'greyDark', 1.0, 0.62);
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25 + g.range('pd', i + step * 7, -0.06, 0.06);
    const r0 = 14 + g.rnd('pd', i) * 6;
    const x = 386 - step;
    g.line(
      x - Math.cos(a) * r0,
      224 + Math.sin(a) * r0 * 0.4,
      x - Math.cos(a) * (r0 + 10 + i * 2),
      224 + Math.sin(a) * (r0 + 10) * 0.4,
      'paper',
      1,
    );
  }
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 108, anchor: ctx.anchor });
  ctx.scene.add(page);
  page.panel(PAUSE, { boil: 0.3 }).draw(field);
  page.thumbprint(618, 330);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
