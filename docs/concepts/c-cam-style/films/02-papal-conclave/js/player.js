/* Showcase chrome. The wall clock lives only here (requestAnimationFrame drives playback); the renderer only ever
   sees a film time t. Hooks: window.__duration, window.__seek(s), window.__showcase.frame(t). */
'use strict';
(function () {
  const ST = window.ST, FPS = ST.FPS, SHOTS = ST.SHOTS, DUR = ST.DURATION;
  const canvas = document.getElementById('frame');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const els = { shots: $('shots'), play: $('play'), scrub: $('scrub'), time: $('time'), note: $('note'), captions: $('captions'), loop: $('loop') };

  const q = new URLSearchParams(location.search);
  const state = { t: Math.max(0, Math.min(DUR - 1 / FPS, parseFloat(q.get('t') || '0') || 0)), playing: q.get('paused') !== '1', last: null };
  if (q.get('captions') === '0') els.captions.checked = false;

  const quant = (t) => Math.floor(t * FPS + 1e-6) / FPS;
  function draw() {
    ST.showCaptions = els.captions.checked;
    const ft = quant(state.t);
    ST.renderFrame(ctx, ft);
    const i = ST.shotAt(ft), s = SHOTS[i];
    els.scrub.value = String(state.t);
    els.time.textContent = `${ft.toFixed(2)} s / ${DUR.toFixed(1)} s · shot ${i + 1} @ ${(ft - s.t0).toFixed(2)} s`;
    els.note.innerHTML = `<b>${i + 1} · ${s.title}</b> (${s.role}) &middot; ${s.note}`;
    els.play.textContent = state.playing ? 'pause' : 'play';
    [...els.shots.children].forEach((b, k) => b.classList.toggle('on', k === i));
  }
  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1} ${s.title}`;
    b.addEventListener('click', () => { state.t = s.t0; state.playing = true; draw(); });
    els.shots.appendChild(b);
  });
  function fit() {
    const k = Math.min((innerWidth - 32) / ST.W, (innerHeight - 190) / ST.H);
    canvas.style.width = `${Math.max(320, ST.W * k)}px`;
    canvas.style.height = `${Math.max(180, ST.H * k)}px`;
  }
  function tick(now) {
    if (state.playing && state.last !== null) {
      state.t += Math.min(0.1, (now - state.last) / 1000);
      if (state.t >= DUR) {
        if (els.loop.checked) state.t %= DUR;
        else { state.t = DUR - 1 / FPS; state.playing = false; }
      }
      draw();
    }
    state.last = state.playing ? now : null;
    requestAnimationFrame(tick);
  }
  els.scrub.max = String(DUR - 1 / FPS);
  els.play.addEventListener('click', () => {
    if (!state.playing && state.t >= DUR - 2 / FPS) state.t = 0;
    state.playing = !state.playing;
    draw();
  });
  els.scrub.addEventListener('input', () => { state.t = parseFloat(els.scrub.value); state.playing = false; draw(); });
  els.captions.addEventListener('change', draw);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); state.playing = !state.playing; }
    else if (/^Digit[1-9]$/.test(e.code)) { const n = Number(e.code.slice(5)); if (n <= SHOTS.length) { state.t = SHOTS[n - 1].t0; state.playing = true; } }
    else if (['KeyN', 'KeyP', 'ArrowDown', 'ArrowUp'].includes(e.code)) {
      e.preventDefault();
      const i = Math.max(0, Math.min(SHOTS.length - 1, ST.shotAt(state.t) + (e.code === 'KeyN' || e.code === 'ArrowDown' ? 1 : -1)));
      state.t = SHOTS[i].t0;
    }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      state.playing = false;
      state.t = Math.max(0, Math.min(DUR - 1 / FPS, Math.round(state.t * FPS + (e.code === 'ArrowRight' ? 1 : -1)) / FPS));
    } else if (e.code === 'KeyC') els.captions.checked = !els.captions.checked;
    else return;
    draw();
  });
  addEventListener('resize', fit);
  fit();
  draw();
  requestAnimationFrame(tick);

  window.__duration = DUR;
  window.__seek = (s) => { state.playing = false; state.t = Math.max(0, Math.min(DUR - 1e-6, s)); draw(); };
  window.__showcase = {
    duration: DUR,
    shots: SHOTS.map((s) => ({ id: s.id, title: s.title, t0: s.t0, t1: s.t1 })),
    frame(t) { window.__seek(t); return canvas.toDataURL('image/png'); },
  };
})();
