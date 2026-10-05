/* Page chrome. The wall clock lives ONLY here: it decides which frame index to show; every frame is
 * NB.render(frameIndex / 30) on the single global timeline, so "Play all", "Play shot" and scrubbing agree. */
'use strict';
(function () {
  const NB = window.NB;
  const SHOTS = NB.camera.SHOTS;
  const DUR = NB.camera.DUR;
  const FPS = NB.FPS;
  const LAST = Math.round(DUR * FPS) - 1;
  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(NB.W, NB.H);
  const $ = (id) => document.getElementById(id);
  const els = { shots: $('shots'), all: $('playAll'), shot: $('playShot'), loop: $('loop'), pause: $('pause'), scrub: $('scrub'), time: $('time'), marks: $('marks'), cap: $('caption'), capOn: $('capOn'), note: $('note') };

  const params = new URLSearchParams(location.search);
  const startShot = NB.clamp((parseInt(params.get('shot') || '0', 10) || 0) - 1, -1, SHOTS.length - 1);
  const tParam = parseFloat(params.get('t') || '0') || 0;
  const state = {
    frame: Math.round(((startShot >= 0 ? SHOTS[startShot].t0 : 0) + tParam) * FPS),
    playing: params.get('paused') !== '1',
    mode: startShot >= 0 ? 'shot' : 'all',
    shot: Math.max(0, startShot),
    loop: true,
    last: null,
    acc: 0,
  };
  state.frame = NB.clamp(state.frame, 0, LAST);

  function present(frame) {
    NB.render(frame / FPS);
    const fb = NB.fb;
    const d = image.data;
    const rgb = NB.RGB;
    for (let i = 0, j = 0; i < fb.length; i++, j += 4) {
      const c = rgb[fb[i]];
      d[j] = c[0];
      d[j + 1] = c[1];
      d[j + 2] = c[2];
      d[j + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
  const shotAt = (t) => {
    for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0 - 1e-6) return i;
    return 0;
  };
  function show() {
    const t = state.frame / FPS;
    present(state.frame);
    const si = shotAt(t);
    const sh = SHOTS[si];
    els.scrub.value = String(state.frame);
    els.time.textContent = `${t.toFixed(2)} s  |  shot ${si + 1}  ${(t - sh.t0).toFixed(2)} / ${(sh.t1 - sh.t0).toFixed(1)} s`;
    els.cap.textContent = sh.narration;
    els.cap.classList.toggle('hidden', !els.capOn.checked);
    els.note.innerHTML = `<b>shot ${sh.id} &middot; ${sh.title}</b> &middot; focal: ${sh.focal}`;
    [...els.shots.children].forEach((b, i) => b.classList.toggle('on', i === si));
    els.all.classList.toggle('on', state.playing && state.mode === 'all');
    els.shot.classList.toggle('on', state.playing && state.mode === 'shot');
    els.pause.textContent = state.playing ? 'pause' : 'play';
    els.loop.classList.toggle('on', state.loop);
  }
  function range() {
    if (state.mode === 'all') return [0, LAST];
    const s = SHOTS[state.shot];
    return [Math.round(s.t0 * FPS), Math.round(s.t1 * FPS) - 1];
  }
  function tick(now) {
    if (state.playing) {
      if (state.last !== null) state.acc += Math.min(0.25, (now - state.last) / 1000);
      let moved = false;
      while (state.acc >= 1 / FPS) {
        state.acc -= 1 / FPS;
        const [a, b] = range();
        if (state.frame >= b) {
          if (state.mode === 'shot' && state.loop) state.frame = a;
          else {
            state.playing = false;
            break;
          }
        } else state.frame++;
        moved = true;
      }
      if (moved || !state.playing) show();
    }
    state.last = state.playing ? now : null;
    requestAnimationFrame(tick);
  }
  function selectShot(i, play) {
    state.shot = i;
    state.mode = 'shot';
    state.frame = Math.round(SHOTS[i].t0 * FPS);
    state.playing = play;
    state.acc = 0;
    show();
  }
  function playAll() {
    state.mode = 'all';
    state.frame = 0;
    state.playing = true;
    state.acc = 0;
    show();
  }
  function step(d) {
    state.playing = false;
    state.frame = NB.clamp(state.frame + d, 0, LAST);
    state.shot = shotAt(state.frame / FPS);
    show();
  }

  SHOTS.forEach((s, i) => {
    const b = document.createElement('button');
    b.textContent = `${s.id} ${s.title}`;
    b.title = `${s.t0}-${s.t1} s`;
    b.addEventListener('click', () => selectShot(i, true));
    els.shots.appendChild(b);
    const m = document.createElement('span');
    m.style.left = `${(s.t0 / DUR) * 100}%`;
    m.textContent = String(s.id);
    els.marks.appendChild(m);
  });
  els.scrub.max = String(LAST);
  els.all.addEventListener('click', playAll);
  els.shot.addEventListener('click', () => selectShot(shotAt(state.frame / FPS), true));
  els.loop.addEventListener('click', () => {
    state.loop = !state.loop;
    show();
  });
  els.pause.addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing && state.mode === 'all' && state.frame >= LAST) state.frame = 0;
    show();
  });
  els.scrub.addEventListener('input', () => {
    state.playing = false;
    state.frame = parseInt(els.scrub.value, 10);
    state.shot = shotAt(state.frame / FPS);
    show();
  });
  els.capOn.addEventListener('change', show);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      state.playing = !state.playing;
      show();
    } else if (/^Digit[1-8]$/.test(e.code)) selectShot(Number(e.code.slice(5)) - 1, true);
    else if (e.code === 'KeyA') playAll();
    else if (e.code === 'ArrowRight') step(1);
    else if (e.code === 'ArrowLeft') step(-1);
  });
  function fit() {
    const k = Math.max(1, Math.floor(Math.min((innerWidth - 24) / NB.W, (innerHeight - 200) / NB.H)));
    canvas.style.width = `${NB.W * k}px`;
    canvas.style.height = `${NB.H * k}px`;
    $('wrap').style.width = `${NB.W * k}px`;
  }
  addEventListener('resize', fit);
  fit();
  show();
  requestAnimationFrame(tick);

  // Hooks for the screenshot / determinism / palette scripts (never used by the film itself).
  window.__showcase = {
    shots: SHOTS.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, title: s.title })),
    dur: DUR,
    frame(t) {
      state.playing = false;
      state.frame = NB.clamp(Math.round(t * FPS), 0, LAST);
      show();
      return canvas.toDataURL('image/png');
    },
    hashAt(t) {
      NB.render(t);
      let h = 2166136261;
      for (let i = 0; i < NB.fb.length; i++) h = Math.imul(h ^ NB.fb[i], 16777619) >>> 0;
      return h;
    },
    usedColours(t) {
      NB.render(t);
      const seen = new Set(NB.fb);
      return [...seen].sort((a, b) => a - b);
    },
    paletteSize: NB.PAL.length,
    bench(t, n) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) NB.render(t + i / FPS);
      return (performance.now() - t0) / n;
    },
  };
})();
