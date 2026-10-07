// focal: the pop-up STAGES card standing left of centre, a cheering paper dancer springing up on it | traces: angled tape on the card corner, the red pull-tab loop + arrow on "danced", a pencil source note in the margin
export const meta = {
  id: 's07_popup_stage',
  title: 'Stages and musicians: more people danced',
  treatment: 'montage/transition',
};

export function build(ctx) {
  const { kit, scene, anchor, sfx, shot } = ctx;
  const stages = anchor('stages');
  const musicians = anchor('musicians');
  const more = anchor('More people danced');

  const page = kit.fx.sketchPage({
    size: [shot.width, shot.height],
    duration: shot.duration,
    stock: 'lined',
    page: 7,
    anchor,
    rest: 'off',
  });
  scene.add(page);

  const card = page.popup({
    x: 380,
    y: 272,
    w: 412,
    depth: 196,
    at: 0,
    elements: [
      { kind: 'block', u: 118, w: 190, h: 80, depth: 30, band: 'BUILT', text: 'STAGES' },
      { kind: 'cutout', u: 16, draw: 'figure', pose: 'cheer', text: 'MUSICIANS' },
      { kind: 'cutout', u: 322, draw: 'figure', pose: 'cheer', text: 'DANCED' },
      { kind: 'arm', u: 212, length: 130, piece: 'disc', angle: 20, swing: -28 },
      { kind: 'tag', lines: ['more', 'people'] },
      { kind: 'note', text: 'publicdomainreview.org' },
    ],
    pull: { at: more.t },
  });

  sfx.at(card.at, 'paper');
  sfx.at(stages.t, 'hit-soft');
  sfx.at(musicians.t, 'pop');
  sfx.at(more.t, 'hit');
  return { page, card };
}

export function update(t, s) {
  s.page.update(t);
}
