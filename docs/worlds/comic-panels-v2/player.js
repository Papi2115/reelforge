/* comic-panels v2 showcase - player chrome. The wall clock lives only here; it is turned into a global
 * frame number, and the frame is a pure function of that number (timeline.js).
 */
/* global window, document, location, innerWidth, innerHeight, requestAnimationFrame, addEventListener */
'use strict';
(function () {
  const CP = window.CP;
  const TL = CP.timeline;
  const { FPS, SHOTS, TOTAL_FRAMES } = TL;
  const canvas = document.getElementById('frame');
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(CP.W, CP.H);
  const $ = (id) => document.getElementById(id);
  const els = {
    shots: $('shots'), playAll: $('playAll'), playShot: $('playShot'), toggle: $('toggle'), loop: $('loop'),
    scrub: $('scrub'), markers: $('markers'), time: $('time'), caption: $('caption'), showCaption: $('showCaption'), note: $('note'),
  };

  const state = { frame: 0, playing: true, mode: 'all', shot: 0, pos: 0, last: null, drawn: -1 };

  function draw(frame) {
    const { index } = TL.renderFrame(frame);
    const data = image.data;
    const fb = CP.fb;
    for (let i = 0, j = 0; i < fb.length; i++, j += 4) {
      const rgb = CP.RGB[fb[i]];
      data[j] = rgb[0];
      data[j + 1] = rgb[1];
      data[j + 2] = rgb[2];
      data[j + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    state.drawn = frame;
    return index;
  }

  function sync() {
    const { index, local } = TL.locate(state.frame);
    if (state.drawn !== state.frame) draw(state.frame);
    const shot = SHOTS[index];
    [...els.shots.children].forEach((b, i) => {
      b.classList.toggle('on', i === index);
      b.classList.toggle('scope', state.mode === 'shot' && i === state.shot);
    });
    els.scrub.value = String(state.frame);
    els.time.textContent = `${(state.frame / FPS).toFixed(2)} / ${(TOTAL_FRAMES / FPS).toFixed(1)} s  ·  shot ${index + 1}  ${(local / FPS).toFixed(2)} s`;
    els.toggle.textContent = state.playing ? 'pause' : 'play';
    els.playAll.classList.toggle('on', state.mode === 'all' && state.playing);
    els.playShot.classList.toggle('on', state.mode === 'shot' && state.playing);
    els.caption.textContent = shot.narration;
    els.caption.classList.toggle('hidden', !els.showCaption.checked);
    els.note.innerHTML = `<b>shot ${index + 1} &middot; ${shot.title}</b> &middot; ${shot.note}`;
  }

  function setFrame(frame) {
    state.frame = Math.max(0, Math.min(TOTAL_FRAMES - 1, frame | 0));
    state.pos = state.frame / FPS;
  }
  function selectShot(i) {
    state.mode = 'shot';
    state.shot = i;
    setFrame(SHOTS[i].startFrame);
    sync();
  }
  function playAll() {
    state.mode = 'all';
    state.playing = true;
    setFrame(0);
    sync();
  }
  function playShot() {
    state.mode = 'shot';
    state.shot = TL.locate(state.frame).index;
    state.playing = true;
    setFrame(SHOTS[state.shot].startFrame);
    sync();
  }

  function tick(now) {
    if (state.playing && state.last !== null) {
      state.pos += Math.min(0.1, (now - state.last) / 1000);
      let frame = Math.floor(state.pos * FPS + 1e-6);
      if (state.mode === 'shot') {
        const s = SHOTS[state.shot];
        if (frame >= s.startFrame + s.frames) {
          if (els.loop.checked) {
            frame = s.startFrame;
            state.pos = frame / FPS;
          } else {
            frame = s.startFrame + s.frames - 1;
            state.playing = false;
          }
        }
      } else if (frame >= TOTAL_FRAMES) {
        frame = TOTAL_FRAMES - 1;
        state.playing = false;
      }
      if (frame !== state.frame || !state.playing) {
        state.frame = frame;
        sync();
      }
    }
    state.last = state.playing ? now : null;
    requestAnimationFrame(tick);
  }

  // ---------- chrome ----------
  SHOTS.forEach((shot, i) => {
    const b = document.createElement('button');
    b.textContent = `${(i + 1) % 10 === 0 ? 10 : i + 1} ${shot.title}`;
    b.title = `key ${(i + 1) % 10}`;
    b.addEventListener('click', () => selectShot(i));
    els.shots.appendChild(b);
    const m = document.createElement('span');
    m.className = 'marker';
    m.style.left = `${(shot.startFrame / (TOTAL_FRAMES - 1)) * 100}%`;
    m.textContent = String(i + 1);
    els.markers.appendChild(m);
  });
  els.scrub.max = String(TOTAL_FRAMES - 1);
  els.scrub.step = '1';
  els.playAll.addEventListener('click', playAll);
  els.playShot.addEventListener('click', playShot);
  els.toggle.addEventListener('click', () => {
    state.playing = !state.playing;
    sync();
  });
  els.scrub.addEventListener('input', () => {
    state.playing = false;
    setFrame(parseInt(els.scrub.value, 10));
    if (state.mode === 'shot') state.shot = TL.locate(state.frame).index;
    sync();
  });
  els.showCaption.addEventListener('change', sync);
  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.code !== 'Space' && !/^Arrow/.test(e.code)) return;
    if (e.code === 'Space') {
      e.preventDefault();
      state.playing = !state.playing;
    } else if (/^Digit[0-9]$/.test(e.code)) {
      const n = Number(e.code.slice(5));
      selectShot(n === 0 ? 9 : n - 1);
      return;
    } else if (e.code === 'KeyA') {
      playAll();
      return;
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault();
      state.playing = false;
      setFrame(state.frame + (e.code === 'ArrowRight' ? 1 : -1));
    } else return;
    sync();
  });
  function fit() {
    const k = Math.max(1, Math.min(3, Math.floor(Math.min((innerWidth - 24) / CP.W, (innerHeight - 230) / CP.H))));
    canvas.style.width = `${CP.W * k}px`;
    canvas.style.height = `${CP.H * k}px`;
  }
  addEventListener('resize', fit);

  // ---------- URL: ?shot=N&t=seconds-into-the-shot&paused=1 ----------
  const params = new URLSearchParams(location.search);
  if (params.has('shot')) {
    const i = Math.max(0, Math.min(SHOTS.length - 1, (parseInt(params.get('shot'), 10) || 1) - 1));
    state.mode = 'shot';
    state.shot = i;
    const t = Math.max(0, parseFloat(params.get('t') || '0') || 0);
    setFrame(SHOTS[i].startFrame + Math.min(SHOTS[i].frames - 1, Math.floor(t * FPS + 1e-6)));
  } else if (params.has('t')) setFrame(Math.floor((parseFloat(params.get('t')) || 0) * FPS + 1e-6));
  state.playing = params.get('paused') !== '1';
  fit();
  sync();
  requestAnimationFrame(tick);

  // Hook for the screenshot script: exact frames, as PNG or as a hash of the index buffer.
  function goTo(index, t) {
    state.playing = false;
    state.mode = 'shot';
    state.shot = index;
    setFrame(SHOTS[index].startFrame + Math.min(SHOTS[index].frames - 1, Math.floor(t * FPS + 1e-6)));
    state.drawn = -1;
    sync();
  }
  window.__showcase = {
    shots: SHOTS.map((s) => ({ title: s.title, start: s.start, dur: s.dur, trans: s.transIn ? s.transIn.kind : null })),
    total: TOTAL_FRAMES / FPS,
    frame(index, t) {
      goTo(index, t);
      return canvas.toDataURL('image/png');
    },
    hash(index, t) {
      goTo(index, t);
      return CP.hashString(Array.prototype.join.call(CP.fb, ''));
    },
    colours() {
      const seen = new Set(CP.fb);
      return [...seen].sort((a, b) => a - b);
    },
  };
})();
