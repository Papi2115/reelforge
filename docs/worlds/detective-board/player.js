/* detective-board showcase - page chrome. The wall clock lives ONLY here: it picks which frame
 * index to show; every frame itself is render(frameIndex / 30), so scrubbing is exact. */
(function () {
  'use strict';
  const DB = window.DB;
  const FPS = 30;
  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d');
  const scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time');
  const playBtn = document.getElementById('play');
  const capBox = document.getElementById('cap');
  const capEl = document.getElementById('caption');
  const noteEl = document.getElementById('note');
  const shotBar = document.getElementById('shots');
  const state = { shot: 0, frame: 0, playing: true, last: null, acc: 0 };

  function renderAt(shotIndex, t) {
    const shot = DB.shots[shotIndex];
    const frame = shot.render(Math.min(t, shot.dur - 1e-6));
    DB.present(ctx, frame);
  }
  function show() {
    const shot = DB.shots[state.shot];
    const t = state.frame / FPS;
    renderAt(state.shot, t);
    scrub.max = String(shot.dur - 1 / FPS);
    scrub.value = String(t);
    timeEl.textContent = t.toFixed(2) + ' / ' + shot.dur.toFixed(1) + ' s';
  }
  function select(i) {
    state.shot = i;
    state.frame = 0;
    const shot = DB.shots[i];
    capEl.textContent = '"' + shot.caption + '"';
    noteEl.innerHTML = '<b>' + shot.id + ' ' + shot.name + '</b> - ' + shot.note;
    [...shotBar.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    show();
  }
  function fit() {
    const k = Math.max(1, Math.floor(Math.min((window.innerWidth - 24) / 640, (window.innerHeight - 190) / 360)));
    canvas.style.width = 640 * k + 'px';
    canvas.style.height = 360 * k + 'px';
  }
  function tick(now) {
    if (state.playing) {
      if (state.last !== null) state.acc += (now - state.last) / 1000;
      const shot = DB.shots[state.shot];
      const total = Math.round(shot.dur * FPS);
      let moved = false;
      while (state.acc >= 1 / FPS) {
        state.acc -= 1 / FPS;
        state.frame = (state.frame + 1) % total;
        moved = true;
      }
      if (moved) show();
    }
    state.last = now;
    requestAnimationFrame(tick);
  }
  function togglePlay() {
    state.playing = !state.playing;
    state.acc = 0;
    playBtn.textContent = state.playing ? 'Pause' : 'Play';
  }

  DB.shots.forEach((shot, i) => {
    const b = document.createElement('button');
    b.textContent = shot.id + ' ' + shot.name;
    b.addEventListener('click', () => select(i));
    shotBar.appendChild(b);
  });
  playBtn.addEventListener('click', togglePlay);
  scrub.addEventListener('input', () => {
    state.frame = Math.round(Number(scrub.value) * FPS);
    if (state.playing) togglePlay();
    show();
  });
  capBox.addEventListener('change', () => {
    capEl.hidden = !capBox.checked;
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (/^Digit[1-5]$/.test(e.code)) select(Number(e.code.slice(5)) - 1);
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const total = Math.round(DB.shots[state.shot].dur * FPS);
      state.frame = (state.frame + (e.code === 'ArrowRight' ? 1 : total - 1)) % total;
      show();
    }
  });
  window.addEventListener('resize', fit);
  // Hook for the screenshot script: draw one exact frame and stop the clock.
  DB.seek = (shotIndex, t) => {
    if (state.playing) togglePlay();
    if (state.shot !== shotIndex) select(shotIndex);
    state.frame = Math.round(t * FPS);
    show();
  };
  fit();
  select(0);
  requestAnimationFrame(tick);
})();
