// focal: the blue bar towering to 50 ft over a tiny stick person, its "50" looped in red | traces: a baseline that overshoots the axis, a pencil "maybe" in the margin, a coffee ring
export const meta = {
  id: 's04_wave_ruler',
  title: 'Wave height ruler: 15 to 50 feet',
  treatment: 'data-chart-3d',
};

const FT0 = 440; // y of 0 ft
const PX_PER_FT = 6.6; // 50 ft -> y 110
const ftY = (ft) => FT0 - ft * PX_PER_FT;

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'graph',
    page: 4,
    pageTool: 'bic',
    boilFps: 8,
    anchor,
  });
  scene.add(page);

  const fifteen = anchor('fifteen');
  const fifty = anchor('fifty feet high');
  const maybe = anchor('maybe');
  const speed = anchor('thirty-five miles an hour');

  // hand-ruled axes, already on the page; the baseline overshoots the axis
  page.ruler(140, FT0 + 12, { at: -0.6, until: 0.3 });
  page.ruled(120, FT0, 780, FT0 + 3, { tool: 'bic', at: -2.2 });
  page.ruled(200, FT0 + 8, 202, 96, { tool: 'bic', at: -1.8 });
  for (const ft of [0, 15, 50]) {
    page.stroke(
      [
        [192, ftY(ft)],
        [210, ftY(ft) + 1],
      ],
      { tool: 'bic', at: -1.5 + ft * 0.004, dur: 0.08 },
    );
    page.write(String(ft), {
      x: 140,
      y: ftY(ft) + 8,
      size: 22,
      hand: 'print',
      tool: 'bic',
      appear: 'pop',
      at: -1.4,
    });
  }
  page.write('FT', {
    x: 214,
    y: 92,
    size: 20,
    hand: 'print',
    tool: 'bic',
    appear: 'pop',
    at: -1.2,
  });
  page.coffeeRing(820, 120, 58, { at: -1 });

  // a person to scale at the foot of the bar
  page.figure({
    x: 370,
    y: FT0,
    h: 44,
    at: -0.8,
    expression: [
      { at: 0, mouth: 'flat' },
      { at: fifty.tEnd, mouth: 'o' },
    ],
  });

  // the bar grows: 15 ft, then up to 50 ft
  const low = page.fill([240, ftY(15), 320, ftY(15), 320, FT0, 240, FT0], {
    color: 'bicLight',
    dir: -1,
    at: fifteen.t,
    dur: 0.35,
  });
  sfx.at(low.at, 'whoosh');
  const high = page.fill([240, ftY(50), 320, ftY(50), 320, ftY(15), 240, ftY(15)], {
    color: 'bicLight',
    dir: -1,
    at: fifty.t,
    dur: 0.7,
    hero: true,
  });
  sfx.at(high.at, 'whoosh');
  page.write('15-50 FT', {
    x: 430,
    y: 170,
    size: 58,
    hand: 'print',
    tool: 'bic',
    appear: 'bloom',
    at: fifty.t,
  });
  page.keepClear(236, 100, 90, 345);

  // red result on the 50, after a still beat
  const red = page.loop(152, ftY(50) + 1, 36, 24, { tool: 'red', at: high.end + 0.45 });
  sfx.at(red.at, 'pop');

  // speed tick
  page.write('maybe', {
    x: 560,
    y: 270,
    size: 20,
    hand: 'scrawl',
    tool: 'pencil',
    appear: 'bloom',
    at: maybe.t,
  });
  const arrow = page.arrow(
    [
      [330, ftY(20)],
      [430, ftY(21)],
      [530, ftY(20)],
    ],
    { tool: 'bic', appear: 'bloom', at: speed.t },
  );
  sfx.at(arrow.at, 'tick');
  page.write('35 MPH', {
    x: 550,
    y: ftY(20) + 14,
    size: 40,
    hand: 'print',
    tool: 'bic',
    appear: 'bloom',
    at: speed.t + 0.1,
  });

  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
