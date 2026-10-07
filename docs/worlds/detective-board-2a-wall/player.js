/* detective-board 2a - page chrome. The wall clock lives ONLY here and only picks a frame index;
 * every frame is render(frameIndex / 30) on the one global timeline, so scrubbing is exact. */
(function () {
  'use strict';
  const D2 = window.D2;
  const FPS = 30;
  const SHOTS = D2.world.SHOTS;
  const TOTAL = Math.round(D2.world.DURATION * FPS);
  const $ = (id) => document.getElementById(id);
  const canvas = $('view');
  const ctx = canvas.getContext('2d');
  const scrub = $('scrub');
  const state = { frame: 0, playing: false, mode: 'all', shot: 0, last: null, acc: 0 };

  const shotAt = (frame) => {
    const t = frame / FPS;
    let k = 0;
    SHOTS.forEach((s, i) => {
      if (t >= s.t0 - 1e-6) k = i;
    });
    return k;
  };
  function show() {
    const t = state.frame / FPS;
    D2.present(ctx, D2.render(t));
    const k = shotAt(state.frame);
    const s = SHOTS[k];
    scrub.value = String(state.frame);
    $('time').textContent = t.toFixed(2) + ' s  |  shot ' + s.id + ' +' + (t - s.t0).toFixed(2);
    $('caption').textContent = '"' + s.cap + '"';
    $('note').innerHTML = '<b>' + s.id + ' ' + s.name + '</b> - ' + s.note;
    [...$('shots').children].forEach((b, i) => b.setAttribute('aria-current', String(i === k)));
    $('playAll').setAttribute('aria-pressed', String(state.playing && state.mode === 'all'));
    $('playShot').setAttribute('aria-pressed', String(state.playing && state.mode === 'shot'));
    $('pause').textContent = state.playing ? 'Pause' : 'Resume';
  }
  function shotRange(i) {
    return [Math.round(SHOTS[i].t0 * FPS), Math.round(SHOTS[i].t1 * FPS)];
  }
  /** The whole film from frame 0 as one continuous timeline (transitions included, no resets). */
  function playAll() {
    state.mode = 'all';
    state.frame = 0;
    state.playing = true;
    state.acc = 0;
    show();
  }
  function playShot(i) {
    state.shot = i === undefined ? shotAt(state.frame) : i;
    state.mode = 'shot';
    state.frame = shotRange(state.shot)[0];
    state.playing = true;
    state.acc = 0;
    show();
  }
  function step(n) {
    state.playing = false;
    state.frame = Math.min(TOTAL - 1, Math.max(0, state.frame + n));
    show();
  }
  function advance() {
    state.frame += 1;
    if (state.mode === 'shot') {
      const [a, b] = shotRange(state.shot);
      if (state.frame >= b) {
        if ($('loop').checked) state.frame = a;
        else {
          state.frame = b - 1;
          state.playing = false;
        }
      }
    } else if (state.frame >= TOTAL) {
      state.frame = TOTAL - 1;
      state.playing = false;
    }
  }
  function tick(now) {
    if (state.playing && state.last !== null) {
      state.acc += Math.min(0.25, (now - state.last) / 1000);
      let moved = false;
      while (state.acc >= 1 / FPS && state.playing) {
        state.acc -= 1 / FPS;
        advance();
        moved = true;
      }
      if (moved) show();
    }
    state.last = now;
    requestAnimationFrame(tick);
  }
  function fit() {
    const k = Math.max(1, Math.floor(Math.min((window.innerWidth - 24) / 640, (window.innerHeight - 210) / 360)));
    canvas.style.width = 640 * k + 'px';
    canvas.style.height = 360 * k + 'px';
  }

  // shot buttons and scrubber markers
  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = s.id + ' ' + s.name;
    b.title = 'Key ' + s.id;
    b.addEventListener('click', () => playShot(i));
    $('shots').appendChild(b);
    const m = document.createElement('span');
    m.className = 'mark';
    m.style.left = (s.t0 / D2.world.DURATION) * 100 + '%';
    m.textContent = String(s.id);
    $('marks').appendChild(m);
  });
  scrub.max = String(TOTAL - 1);
  scrub.addEventListener('input', () => {
    state.playing = false;
    state.frame = Number(scrub.value);
    show();
  });
  $('playAll').addEventListener('click', playAll);
  $('playShot').addEventListener('click', () => playShot());
  $('pause').addEventListener('click', () => {
    state.playing = !state.playing;
    state.acc = 0;
    show();
  });
  $('cap').addEventListener('change', () => {
    $('caption').hidden = !$('cap').checked;
  });
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) e.preventDefault();
    if (e.code === 'Space') {
      e.preventDefault();
      state.playing = !state.playing;
      state.acc = 0;
      show();
    } else if (/^Digit[1-8]$/.test(e.code)) playShot(Number(e.code.slice(5)) - 1);
    else if (e.code === 'ArrowRight') step(1);
    else if (e.code === 'ArrowLeft') step(-1);
    else if (e.code === 'KeyA') playAll();
  });
  window.addEventListener('resize', fit);

  /** Screenshot hook: draw one exact frame at global time t and stop. */
  D2.seek = (t) => {
    state.playing = false;
    state.frame = Math.max(0, Math.min(TOTAL - 1, Math.round(t * FPS)));
    show();
  };

  // URL: ?shot=N&t=seconds-into-shot&paused=1  (or ?t=global seconds without shot)
  const q = new URLSearchParams(window.location.search);
  const shotParam = Number(q.get('shot'));
  const tParam = Number(q.get('t')) || 0;
  const startT = shotParam >= 1 && shotParam <= SHOTS.length ? SHOTS[shotParam - 1].t0 + tParam : tParam;
  state.frame = Math.max(0, Math.min(TOTAL - 1, Math.round(startT * FPS)));
  if (shotParam >= 1 && shotParam <= SHOTS.length) {
    state.mode = 'shot';
    state.shot = shotParam - 1;
  }
  state.playing = q.get('paused') !== '1';
  fit();
  show();
  D2.ready = true;
  requestAnimationFrame(tick);
})();
