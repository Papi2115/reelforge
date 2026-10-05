/* detective-board 2c "felt" - page chrome. The wall clock lives only here; the film sees a frame time T. */
(function () {
  'use strict';
  const F = window.FELT;
  const FPS = F.FPS;
  const SHOTS = F.SHOTS;
  const canvas = document.getElementById('frame');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(F.W, F.H);
  const $ = (id) => document.getElementById(id);
  const els = {
    shots: $('shots'), playAll: $('playAll'), playShot: $('playShot'), pause: $('pause'), loop: $('loop'),
    scrub: $('scrub'), marks: $('marks'), time: $('time'), caption: $('caption'), note: $('note'),
    showCaption: $('showCaption'), perf: $('perf'),
  };

  const quant = (t) => Math.round(t * FPS) / FPS;
  const params = new URLSearchParams(location.search);
  const shot0 = Math.max(0, Math.min(SHOTS.length - 1, (parseInt(params.get('shot') || '1', 10) || 1) - 1));
  const state = {
    T: quant(SHOTS[shot0].start + Math.max(0, parseFloat(params.get('t') || '0') || 0)),
    mode: params.has('shot') ? 'shot' : 'all', // what "playing" plays: the whole film or one shot
    shot: shot0,
    playing: params.get('paused') !== '1',
    last: null,
    renderMs: 0,
  };

  function draw() {
    const t0 = performance.now();
    F.render(quant(state.T));
    F.toImage(image);
    ctx.putImageData(image, 0, 0);
    state.renderMs = performance.now() - t0;
  }
  function sync() {
    const i = F.shotAt(state.T);
    const s = SHOTS[i];
    [...els.shots.children].forEach((b, k) => b.classList.toggle('on', k === i));
    els.scrub.value = String(state.T);
    els.time.textContent = `${state.T.toFixed(2)} s  ·  shot ${i + 1} +${(state.T - s.start).toFixed(2)}`;
    els.playAll.classList.toggle('on', state.playing && state.mode === 'all');
    els.playShot.classList.toggle('on', state.playing && state.mode === 'shot');
    els.pause.textContent = state.playing ? 'pause' : 'play';
    els.caption.textContent = s.narration;
    els.caption.classList.toggle('hidden', !els.showCaption.checked);
    els.note.innerHTML = `<b>shot ${i + 1} · ${s.title}</b> &middot; ${s.note}`;
    draw();
    els.perf.textContent = `${state.renderMs.toFixed(1)} ms/frame`;
  }
  function selectShot(i, play) {
    state.shot = i;
    state.mode = 'shot';
    state.T = SHOTS[i].start;
    state.playing = play;
    sync();
  }
  function playAll() {
    state.mode = 'all';
    if (state.T >= F.TOTAL - 1 / FPS) state.T = 0;
    state.playing = true;
    sync();
  }
  function playShot() {
    state.mode = 'shot';
    state.shot = F.shotAt(state.T);
    const s = SHOTS[state.shot];
    if (state.T >= s.start + s.dur - 1 / FPS) state.T = s.start;
    state.playing = true;
    sync();
  }
  function step(dt) {
    let T = state.T + dt;
    if (state.mode === 'all') {
      if (T >= F.TOTAL) {
        T = F.TOTAL - 1 / FPS;
        state.playing = false;
      }
    } else {
      const s = SHOTS[state.shot];
      if (T >= s.start + s.dur) {
        if (els.loop.checked) T = s.start + ((T - s.start) % s.dur);
        else {
          T = s.start + s.dur - 1 / FPS;
          state.playing = false;
        }
      }
    }
    state.T = T;
  }
  function tick(now) {
    if (state.playing) {
      if (state.last !== null) {
        step(Math.min(0.1, (now - state.last) / 1000));
        sync();
      }
      state.last = now;
    } else state.last = null;
    requestAnimationFrame(tick);
  }

  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1} ${s.title}`;
    b.addEventListener('click', () => selectShot(i, true));
    els.shots.appendChild(b);
    const m = document.createElement('span');
    m.className = 'mark';
    m.style.left = `${(s.start / F.TOTAL) * 100}%`;
    m.textContent = String(i + 1);
    els.marks.appendChild(m);
  });
  els.scrub.max = String(F.TOTAL - 1 / FPS);
  els.scrub.step = String(1 / FPS);
  els.playAll.addEventListener('click', playAll);
  els.playShot.addEventListener('click', playShot);
  els.pause.addEventListener('click', () => {
    state.playing = !state.playing;
    sync();
  });
  els.scrub.addEventListener('input', () => {
    state.T = quant(parseFloat(els.scrub.value));
    state.playing = false;
    state.shot = F.shotAt(state.T);
    sync();
  });
  els.showCaption.addEventListener('change', sync);
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    if (e.code === 'Space') {
      e.preventDefault();
      state.playing = !state.playing;
    } else if (/^Digit[1-8]$/.test(e.code)) {
      selectShot(Number(e.code.slice(5)) - 1, true);
      return;
    } else if (e.code === 'KeyA') {
      playAll();
      return;
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      state.playing = false;
      state.T = quant(Math.max(0, Math.min(F.TOTAL - 1 / FPS, state.T + (e.code === 'ArrowRight' ? 1 : -1) / FPS)));
      state.shot = F.shotAt(state.T);
    } else return;
    sync();
  });
  function fit() {
    const k = Math.max(1, Math.floor(Math.min((innerWidth - 24) / F.W, (innerHeight - 210) / F.H)));
    canvas.style.width = `${F.W * k}px`;
    canvas.style.height = `${F.H * k}px`;
  }
  addEventListener('resize', fit);
  fit();
  sync();
  requestAnimationFrame(tick);

  // Hook for the screenshot script: render an exact global time and return the 960x540 PNG.
  window.__showcase = {
    shots: SHOTS.map((s) => ({ title: s.title, start: s.start, dur: s.dur })),
    total: F.TOTAL,
    frame(T) {
      state.playing = false;
      state.T = quant(T);
      sync();
      return canvas.toDataURL('image/png');
    },
    raw(T) {
      F.render(quant(T));
      return F.fb;
    },
    lastMs: () => state.renderMs,
  };
})();
