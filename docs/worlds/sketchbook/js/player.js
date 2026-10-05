/* Showcase chrome. The wall clock lives only here; the renderer only ever sees a global film time t. */
'use strict';
(function () {
  const SB = window.SB, FPS = SB.FPS, SHOTS = SB.SHOTS, DUR = SB.DURATION, W = SB.W, H = SB.H;
  const canvas = document.getElementById('frame');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  const px32 = new Uint32Array(image.data.buffer);
  const LUT = new Uint32Array(256);
  SB.PAL.forEach(([r, g, b], i) => (LUT[i] = (255 << 24) | (b << 16) | (g << 8) | r));
  const $ = (id) => document.getElementById(id);
  const els = { shots: $('shots'), play: $('play'), all: $('all'), one: $('one'), loop: $('loop'), scrub: $('scrub'), marks: $('marks'), time: $('time'), caption: $('caption'), note: $('note'), showCaption: $('showCaption') };

  const q = new URLSearchParams(location.search);
  const qShot = parseInt(q.get('shot') || '', 10);
  const state = { t: 0, mode: 'all', shot: 0, playing: q.get('paused') !== '1', last: null };
  if (qShot >= 1 && qShot <= SHOTS.length) {
    state.mode = 'shot';
    state.shot = qShot - 1;
    state.t = SHOTS[state.shot].t0 + (parseFloat(q.get('t') || '0') || 0);
  } else state.t = parseFloat(q.get('t') || '0') || 0;
  state.t = Math.max(0, Math.min(DUR - 1 / FPS, state.t));

  const quant = (t) => Math.floor(t * FPS + 1e-6) / FPS;
  function draw(t) {
    const ft = quant(t);
    const s = SB.renderFrame(ft);
    for (let i = 0; i < s.length; i++) px32[i] = LUT[s[i]];
    ctx.putImageData(image, 0, 0);
    return ft;
  }
  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1} ${s.title}`;
    b.title = `${s.role} · ${(s.t1 - s.t0).toFixed(1)} s`;
    b.addEventListener('click', () => playShot(i));
    els.shots.appendChild(b);
    const m = document.createElement('span');
    m.style.left = `${(s.t0 / DUR) * 100}%`;
    m.textContent = String(i + 1);
    els.marks.appendChild(m);
  });
  function playShot(i) {
    state.mode = 'shot';
    state.shot = i;
    state.t = SHOTS[i].t0;
    state.playing = true;
    sync();
  }
  function playAll() {
    state.mode = 'all';
    if (state.t >= DUR - 2 / FPS) state.t = 0;
    state.playing = true;
    sync();
  }
  function sync() {
    const shotNow = SB.shotAt(state.t);
    if (state.mode === 'all') state.shot = shotNow;
    const s = SHOTS[state.shot];
    [...els.shots.children].forEach((b, i) => b.classList.toggle('on', i === state.shot));
    els.all.classList.toggle('on', state.mode === 'all');
    els.one.classList.toggle('on', state.mode === 'shot');
    els.play.textContent = state.playing ? 'pause' : 'play';
    els.scrub.value = String(state.t);
    const ft = draw(state.t);
    els.time.textContent = `${ft.toFixed(2)} s · shot ${shotNow + 1} @ ${(ft - SHOTS[shotNow].t0).toFixed(2)} s`;
    els.caption.textContent = SB.captionAt(ft);
    els.caption.classList.toggle('hidden', !els.showCaption.checked);
    els.note.innerHTML = `<b>${state.shot + 1} · ${s.title} (${s.role})</b> &middot; ${s.note}`;
  }
  function fit() {
    const k = Math.max(1, Math.min(3, Math.floor(Math.min((innerWidth - 24) / W, (innerHeight - 200) / H))));
    canvas.style.width = `${W * k}px`;
    canvas.style.height = `${H * k}px`;
  }
  function tick(now) {
    if (state.playing && state.last !== null) {
      state.t += Math.min(0.1, (now - state.last) / 1000);
      if (state.mode === 'shot') {
        const s = SHOTS[state.shot];
        if (state.t >= s.t1) {
          if (els.loop.checked) state.t = s.t0 + ((state.t - s.t0) % (s.t1 - s.t0));
          else { state.t = s.t1 - 1 / FPS; state.playing = false; }
        }
      } else if (state.t >= DUR) {
        if (els.loop.checked) state.t %= DUR;
        else { state.t = DUR - 1 / FPS; state.playing = false; }
      }
      sync();
    }
    state.last = state.playing ? now : null;
    requestAnimationFrame(tick);
  }
  els.scrub.max = String(DUR - 1 / FPS);
  els.play.addEventListener('click', () => { state.playing = !state.playing; sync(); });
  els.all.addEventListener('click', playAll);
  els.one.addEventListener('click', () => playShot(state.shot));
  els.scrub.addEventListener('input', () => { state.t = parseFloat(els.scrub.value); state.playing = false; if (state.mode === 'shot') state.shot = SB.shotAt(state.t); sync(); });
  els.showCaption.addEventListener('change', sync);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); state.playing = !state.playing; }
    else if (/^Digit[1-8]$/.test(e.code)) return playShot(Number(e.code.slice(5)) - 1);
    else if (e.code === 'KeyA') return playAll();
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      state.playing = false;
      state.t = Math.max(0, Math.min(DUR - 1 / FPS, Math.round(state.t * FPS + (e.code === 'ArrowRight' ? 1 : -1)) / FPS));
      if (state.mode === 'shot') state.shot = SB.shotAt(state.t);
    } else return;
    sync();
  });
  addEventListener('resize', fit);
  fit();
  sync();
  requestAnimationFrame(tick);

  // hooks for the screenshot / determinism script
  window.__showcase = {
    duration: DUR,
    shots: SHOTS.map((s) => ({ title: s.title, t0: s.t0, t1: s.t1 })),
    frame(t) { state.playing = false; state.t = t; sync(); return canvas.toDataURL('image/png'); },
    indices(t) { return Array.from(SB.renderFrame(quant(t))); },
    hash(t) { const d = SB.renderFrame(quant(t)); let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; },
  };
})();
