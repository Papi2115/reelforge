/* B1 v2 player chrome (10 shots). The wall clock lives ONLY here; the renderer sees a frame number.
   Play all = one continuous global timeline (transitions included). Play shot = one shot, optional loop. */
'use strict';
(function () {
  const K = B1.core;
  const film = B1.film;
  const FPS = K.FPS;
  const TOTAL_F = Math.round(film.total * FPS);
  const canvas = document.getElementById('frame');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(K.W, K.H);
  const el = (id) => document.getElementById(id);

  function drawShot(i, lt, buf) {
    const keep = K.fb;
    K.target(buf || K.main);
    K.setClip();
    K.fill(K.C.VOID);
    const out = film.draw[i](lt) || {};
    K.setClip();
    if (!buf && !out.noHud) B1.hud.drawHUD(i, lt, out);
    K.target(buf ? keep : K.main);
  }
  // Pure: global frame -> pixels in K.main.
  function renderFrame(f) {
    f = Math.max(0, Math.min(TOTAL_F - 1, f));
    const gt = f / FPS;
    const i = film.shotAt(gt + 1e-6);
    const lt = (f - Math.round(film.shots[i].start * FPS)) / FPS;
    drawShot(i, lt);
    return { i, lt };
  }
  B1.renderShotInto = function (buf, i, lt) { drawShot(i, lt, buf); };

  const params = new URLSearchParams(location.search);
  const state = { f: 0, playing: true, mode: 'all', loop: false, shot: 0, last: null, acc: 0 };
  if (params.has('shot')) {
    state.shot = Math.max(0, Math.min(film.shots.length - 1, (parseInt(params.get('shot'), 10) || 1) - 1));
    state.mode = 'shot';
    state.f = Math.round((film.shots[state.shot].start + (parseFloat(params.get('t')) || 0)) * FPS);
  } else if (params.has('t')) state.f = Math.round((parseFloat(params.get('t')) || 0) * FPS);
  if (params.get('paused') === '1') state.playing = false;

  function shotRange(i) {
    const s = film.shots[i];
    return [Math.round(s.start * FPS), Math.round((s.start + s.dur) * FPS)];
  }
  // shot buttons + scrubber markers
  film.shots.forEach((s, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<b>${i + 1}</b> ${s.title}`;
    b.addEventListener('click', () => playShot(i));
    el('shots').appendChild(b);
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = `${(s.start / film.total) * 100}%`;
    m.textContent = String(i + 1);
    el('markers').appendChild(m);
  });
  el('scrub').max = String(TOTAL_F - 1);

  function playShot(i) {
    state.mode = 'shot'; state.shot = i; state.f = shotRange(i)[0]; state.playing = true; sync();
  }
  function playAll() { state.mode = 'all'; state.f = 0; state.playing = true; sync(); }

  let lastCaptionKey = '';
  function sync() {
    const { i, lt } = renderFrame(state.f);
    K.present(ctx, image);
    if (state.mode === 'all') state.shot = i;
    [...el('shots').children].forEach((b, k) => b.classList.toggle('on', k === i));
    el('scrub').value = String(state.f);
    el('time').textContent = `shot ${i + 1} · ${lt.toFixed(2)} s   |   film ${(state.f / FPS).toFixed(2)} / ${film.total.toFixed(1)} s   |   frame ${state.f}`;
    el('playpause').textContent = state.playing ? 'pause (space)' : 'play (space)';
    el('mode').textContent = state.mode === 'all' ? 'PLAY ALL' : `SHOT ${state.shot + 1}${state.loop ? ' · loop' : ''}`;
    const lines = film.shots[i].lines.filter((l) => lt >= l[0]);
    const line = lines.length ? lines[lines.length - 1][1] : '';
    const key = `${i}|${line}`;
    if (key !== lastCaptionKey) { el('caption').textContent = line || ' '; lastCaptionKey = key; }
  }
  function tick(now) {
    if (state.playing) {
      if (state.last !== null) {
        state.acc += Math.min(0.1, (now - state.last) / 1000);
        let steps = Math.floor(state.acc * FPS);
        if (steps > 0) {
          state.acc -= steps / FPS;
          while (steps-- > 0) advance();
          sync();
        }
      }
      state.last = now;
    } else { state.last = null; state.acc = 0; }
    requestAnimationFrame(tick);
  }
  function advance() {
    if (state.mode === 'all') {
      if (state.f < TOTAL_F - 1) state.f++; else state.playing = false;
      return;
    }
    const [a, b] = shotRange(state.shot);
    if (state.f < b - 1) state.f++;
    else if (state.loop) state.f = a;
    else state.playing = false;
  }
  function step(d) {
    state.playing = false;
    state.f = Math.max(0, Math.min(TOTAL_F - 1, state.f + d));
    if (state.mode === 'shot') {
      const [a, b] = shotRange(state.shot);
      state.f = Math.max(a, Math.min(b - 1, state.f));
    }
    sync();
  }
  el('playall').addEventListener('click', playAll);
  el('playshot').addEventListener('click', () => playShot(state.shot));
  el('playpause').addEventListener('click', () => { state.playing = !state.playing; sync(); });
  el('loop').addEventListener('change', () => { state.loop = el('loop').checked; sync(); });
  el('scrub').addEventListener('input', () => {
    state.f = parseInt(el('scrub').value, 10); state.playing = false; state.mode = 'all'; sync();
  });
  addEventListener('keydown', (e) => {
    const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code);
    if (digit) playShot(digit[2] === '0' ? 9 : Number(digit[2]) - 1);
    else if (e.code === 'Space') { e.preventDefault(); state.playing = !state.playing; sync(); }
    else if (e.code === 'ArrowRight') step(1);
    else if (e.code === 'ArrowLeft') step(-1);
    else if (e.code === 'KeyA') playAll();
    else if (e.code === 'KeyL') { el('loop').checked = !el('loop').checked; state.loop = el('loop').checked; sync(); }
  });
  function fit() {
    const forced = parseInt(params.get('scale'), 10);
    const k = forced || Math.max(1, Math.min(4, Math.floor(Math.min((innerWidth - 32) / K.W, (innerHeight - 210) / K.H))));
    canvas.style.width = `${K.W * k}px`;
    canvas.style.height = `${K.H * k}px`;
    el('wrap').style.width = `${K.W * k}px`;
  }
  addEventListener('resize', fit);
  fit();
  sync();
  requestAnimationFrame(tick);

  // Hooks for the review script (headless): exact frames, frame hashes, colour census.
  window.__b1 = {
    total: TOTAL_F,
    shots: film.shots.map((s) => ({ title: s.title, start: s.start, dur: s.dur })),
    png(f) { state.playing = false; state.f = f; sync(); return canvas.toDataURL('image/png'); },
    hashRange(a, b) {
      const list = [];
      for (let f = a; f < b; f++) list.push(f);
      return this.hashFrames(list);
    },
    // frames in any order (the determinism check renders them twice, the second pass reversed)
    hashFrames(list) {
      return list.map((f) => {
        renderFrame(f);
        let h = 2166136261;
        const fb = K.main;
        for (let i = 0; i < fb.length; i++) h = Math.imul(h ^ fb[i], 16777619);
        return h >>> 0;
      });
    },
    census(a, b, stride) {
      const used = new Set();
      let worst = 0;
      for (let f = a; f < b; f += stride || 1) {
        const t0 = performance.now();
        renderFrame(f);
        worst = Math.max(worst, performance.now() - t0);
        const fb = K.main;
        for (let i = 0; i < fb.length; i++) used.add(fb[i]);
      }
      return { used: [...used].sort((x, y) => x - y).map((i) => K.PAL[i][0]), worstMs: worst };
    },
  };
})();
