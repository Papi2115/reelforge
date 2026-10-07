/* eslint-disable @typescript-eslint/no-unused-vars -- verbatim scene of real film 2 (docs/real-run-sketchbook-2.md) */
// focal: the last strip panel "SEPTEMBER" with its red "ENDED" and a red "?" beside it (right third) | traces: a coffee ring under the strip, a pencil "sources differ?" margin doubt, angled tape on the page corner
export const meta = {
  id: 's10_september',
  title: 'By September, it ended',
  treatment: 'node-graph/timeline',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const september = anchor('By September');
  const ended = anchor('ended');
  const why = anchor('So why', 2);

  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'graph',
    page: 10,
    pageTool: 'bic',
    boilFps: 8,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  // already on the page: a coffee ring the strip lies over, tape, a pencil doubt about the end date
  page.coffeeRing(820, 410, 54, { at: -9 });
  page.tape(96, 70, 70, 20, -14, { at: -8 });
  page.write('SOURCES DIFFER?', {
    x: 560,
    y: 462,
    size: 16,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -3,
    at: -6,
  });

  // the strip: July (first dance, already being dragged in at the cut) through to September, red note on "ended"
  const strip = page.strip({
    y: 156,
    events: [
      { label: '14 JULY', note: 'first dance', doodle: 'figure' },
      { label: 'SEPTEMBER', note: 'ENDED' },
    ],
    highlight: 1,
    at: -1.6,
    until: ended.tEnd,
    pen: 'bic',
    end: 'now',
  });

  // "So why?": one red question mark beside the red result
  const hook = page.stroke([686, 262, 694, 246, 712, 242, 724, 254, 716, 272, 704, 282, 703, 300], {
    tool: 'red',
    at: why.t,
    dur: 0.18,
  });
  const q = page.stroke([703, 314, 705, 319], { tool: 'red', at: hook.end + 0.04, dur: 0.04 });

  sfx.at(september.t, 'paper-slide');
  sfx.at(strip.events[1].at, 'scribble');
  sfx.at(hook.at, 'scribble');
  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
