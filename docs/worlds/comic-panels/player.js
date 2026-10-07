/* comic-panels showcase - page chrome. The clock lives here; shots only ever see a frame time t. */
'use strict';
(function () {
  const CP = window.CP;
  const SHOTS = CP.SHOTS;
  const FPS = 30;
  const canvas = document.getElementById('frame');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(CP.W, CP.H);
  const els = {
    shots: document.getElementById('shots'),
    play: document.getElementById('play'),
    scrub: document.getElementById('scrub'),
    time: document.getElementById('time'),
    caption: document.getElementById('caption'),
    showCaption: document.getElementById('showCaption'),
    note: document.getElementById('note'),
  };

  /** Pure: (shot, t) -> pixels. Same inputs, same frame. */
  function renderAt(index, t) {
    const shot = SHOTS[index];
    const ft = Math.floor(Math.max(0, Math.min(shot.dur - 1e-6, t)) * FPS) / FPS;
    CP.setClip(null);
    CP.setBoilFrame(ft);
    const out = shot.render(ft) || {};
    const remap = out.remap;
    const data = image.data;
    const fb = CP.fb;
    for (let i = 0, j = 0; i < fb.length; i++, j += 4) {
      const rgb = CP.RGB[remap ? remap[fb[i]] : fb[i]];
      data[j] = rgb[0];
      data[j + 1] = rgb[1];
      data[j + 2] = rgb[2];
      data[j + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  const params = new URLSearchParams(location.search);
  const state = {
    shot: Math.max(0, Math.min(SHOTS.length - 1, (parseInt(params.get('shot') || '1', 10) || 1) - 1)),
    t: parseFloat(params.get('t') || '0') || 0,
    playing: params.get('paused') !== '1',
    last: null,
  };

  SHOTS.forEach((shot, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1} ${shot.title}`;
    b.addEventListener('click', () => select(i));
    els.shots.appendChild(b);
  });
  function select(i) {
    state.shot = i;
    state.t = 0;
    sync();
  }
  function sync() {
    const shot = SHOTS[state.shot];
    [...els.shots.children].forEach((b, i) => b.classList.toggle('on', i === state.shot));
    els.scrub.max = String(shot.dur);
    els.scrub.value = String(state.t);
    els.time.textContent = `${state.t.toFixed(2)} / ${shot.dur.toFixed(1)} s`;
    els.play.textContent = state.playing ? 'pause' : 'play';
    els.caption.textContent = shot.narration;
    els.caption.classList.toggle('hidden', !els.showCaption.checked);
    els.note.innerHTML = `<b>art note</b> &middot; ${shot.note}`;
    renderAt(state.shot, state.t);
  }
  function fit() {
    const k = Math.max(1, Math.min(3, Math.floor(Math.min((innerWidth - 24) / CP.W, (innerHeight - 190) / CP.H))));
    canvas.style.width = `${CP.W * k}px`;
    canvas.style.height = `${CP.H * k}px`;
  }
  function tick(now) {
    if (state.playing) {
      if (state.last !== null) {
        const dur = SHOTS[state.shot].dur;
        state.t = (state.t + Math.min(0.1, (now - state.last) / 1000)) % dur;
        sync();
      }
      state.last = now;
    } else state.last = null;
    requestAnimationFrame(tick);
  }
  els.play.addEventListener('click', () => {
    state.playing = !state.playing;
    sync();
  });
  els.scrub.addEventListener('input', () => {
    state.t = parseFloat(els.scrub.value);
    state.playing = false;
    sync();
  });
  els.showCaption.addEventListener('change', sync);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      state.playing = !state.playing;
    } else if (/^Digit[1-5]$/.test(e.code)) select(Number(e.code.slice(5)) - 1);
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      state.playing = false;
      const d = (e.code === 'ArrowRight' ? 1 : -1) / FPS;
      state.t = Math.max(0, Math.min(SHOTS[state.shot].dur - 1 / FPS, state.t + d));
    } else return;
    sync();
  });
  addEventListener('resize', fit);
  fit();
  sync();
  requestAnimationFrame(tick);

  // Hook for the screenshot script: render an exact frame and hand back the 640x360 PNG.
  window.__showcase = {
    shots: SHOTS.map((s) => ({ title: s.title, dur: s.dur })),
    frame(index, t) {
      state.playing = false;
      state.shot = index;
      state.t = t;
      sync();
      return canvas.toDataURL('image/png');
    },
  };
})();
