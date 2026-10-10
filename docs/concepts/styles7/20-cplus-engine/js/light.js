/* c-plus lighting (unchanged look, one API): ONE hard key light per shot, a thin rim on the lit edge, hard flat shadow
   shapes (never gradients), stepped vignettes, flat ground shadows, light beams, gloom, foreground silhouettes and the
   offscreen whole-figure key/rim pass (ST.litFigure, film 16). Shots call ST.setLight first. */
'use strict';
(function () {
  const ST = window.ST;
  const TAU = Math.PI * 2;
  const DEF = { x: -1, y: -0.4, rim: 'rgba(255,214,150,0.55)', shadow: 'rgba(20,10,8,0.42)', deep: 0 };
  ST.LIGHT = Object.assign({}, DEF);
  // ST.setLight(side, rim, shadow)  (side -1 = key from screen-left, +1 = from screen-right)
  // ST.setLight({ x, y, rim, shadow, deep })  (x, y = screen direction toward the key; deep = extra shadow pass)
  ST.setLight = (a, rim, shadow) => {
    ST.LIGHT = typeof a === 'object' && a ? Object.assign({}, DEF, a) : Object.assign({}, DEF, { x: a || -1, rim: rim || DEF.rim, shadow: shadow || DEF.shadow });
  };
  const det = (ctx) => { const m = ctx.getTransform(); return m.a * m.d - m.b * m.c < 0 ? -1 : 1; };
  // the key's side in the current (possibly mirrored) local space: +1 = toward local +x
  ST.lightX = (ctx) => Math.sign(ST.LIGHT.x || -1) * det(ctx);
  // unit vector toward the key in the current local space (mirrors included)
  ST.lightDir = (ctx) => {
    const L = ST.LIGHT, n = Math.hypot(L.x, L.y) || 1;
    return [(L.x / n) * det(ctx), L.y / n];
  };
  // the key side inside a head drawn in view V, possibly flipped (+1 = the light is on the head's +x side)
  ST.keySide = (V, headFlip) => (ST.LIGHT.x >= 0 ? 1 : -1) * (V.mir ? -1 : 1) * (headFlip ? -1 : 1);

  // a hard shadow shape on a face or body: pts drawn for a key on local -x, mirrored about cx when the key is on +x
  ST.hardShadow = (ctx, pts, cx, alpha) => {
    if (ST.SIL) return;
    const q = ST.lightX(ctx) < 0 ? pts : pts.map((v, i) => (i % 2 ? v : 2 * cx - v));
    ST.path(ctx, ST.curve(q, true, 4), true);
    ctx.fillStyle = alpha === undefined ? ST.LIGHT.shadow : `rgba(20,10,8,${alpha})`;
    ctx.fill();
  };
  // a flat cast shadow polygon exactly where the caller puts it (the caller picked the side with ST.lightDir)
  ST.castShade = (ctx, pts) => {
    if (ST.SIL) return;
    ST.path(ctx, ST.curve(pts, true, 4), true);
    ctx.fillStyle = ST.LIGHT.shadow;
    ctx.fill();
  };
  // over one eye: a hard crescent thrown by the brow onto the lid; and a nose's own shadow away from the key
  ST.browShadow = (ctx, x, y, rx, ry, depth, k) => {
    const L = ST.lightX(ctx), d = depth || ry * 0.9, far = -L * rx * 0.35;
    ST.blob(ctx, [x - rx * 1.3, y - ry * 1.5, x + rx * 1.3, y - ry * 1.5, x + rx * 1.2 + far, y - ry * 0.95 + d * (L < 0 ? 0.9 : 0.4), x + far, y - ry * 0.75 + d * 0.6, x - rx * 1.2 + far, y - ry * 0.95 + d * (L > 0 ? 0.9 : 0.4)], 'rgba(20,10,8,' + (k || 0.38) + ')', { lw: 0, seed: 7, deco: true });
  };
  ST.noseShadow = (ctx, pts, len, k) => {
    const L = ST.lightX(ctx), q = pts.map((v, i) => (i % 2 ? v + len * 0.55 : v - L * len));
    ST.blob(ctx, q, 'rgba(20,10,8,' + (k || 0.38) + ')', { lw: 0, seed: 8, deco: true });
  };

  // flat ground shadow: a skewed ellipse thrown away from the key (world space, under the feet)
  ST.groundShadow = (ctx, x, y, w, k) => {
    const dx = -Math.sign(ST.LIGHT.x || -1) * w * (k || 0.6);
    ctx.fillStyle = 'rgba(10,6,4,0.38)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.quadraticCurveTo(x + dx * 0.5, y - w * 0.08, x + dx + w * 0.55, y - w * 0.02);
    ctx.quadraticCurveTo(x + dx * 0.6, y + w * 0.16, x - w * 0.5, y + w * 0.04);
    ctx.fill();
  };
  ST.footShadow = (ctx, p, w) => ST.groundShadow(ctx, p.x, p.y, w * p.s);
  // a hard beam of light (window, hatch, lantern cone): one flat translucent polygon + a brighter inner step
  ST.beamLight = (ctx, pts, col, alpha) => {
    ctx.fillStyle = col;
    ctx.globalAlpha = alpha;
    ST.path(ctx, pts, true);
    ctx.fill();
    const b = ST.bbox(pts), inner = pts.map((v, i) => (i % 2 ? b.cy + (v - b.cy) * 0.6 : b.cx + (v - b.cx) * 0.6));
    ST.path(ctx, inner, true);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  // whole-frame darkening with a stepped hole round the key source (night, below decks, candle-lit rooms)
  ST.keyGloom = (ctx, x0, y0, w, h, cx, cy, r, col, alpha) => {
    ctx.fillStyle = col;
    [1, 0.7, 0.45].forEach((k, i) => {
      ctx.globalAlpha = alpha * (i === 0 ? 1 : 0.6);
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.ellipse(cx, cy, r / k, (r * 0.85) / k, 0, 0, TAU, true);
      ctx.fill('evenodd');
    });
    ctx.globalAlpha = 1;
  };
  // stepped vignette in screen space. shape 'frame' (default): three hard rounded frames (film 15);
  // 'oval': three flat elliptical frames (films 13 / 16). k scales the darkness.
  ST.vignette = (ctx, k, shape) => {
    const a = k === undefined ? 1 : k;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shape === 'oval') {
      ctx.fillStyle = '#0c0a0e';
      [[0.94, 0.42], [0.84, 0.3], [0.72, 0.2]].forEach(([r, al]) => {
        ctx.globalAlpha = a * al;
        ctx.beginPath();
        ctx.rect(0, 0, ST.W, ST.H);
        ctx.ellipse(ST.W / 2, ST.H / 2, ST.W * r * 0.62, ST.H * (r + 0.04) * 0.62, 0, 0, TAU, true);
        ctx.fill();
      });
    } else {
      ctx.fillStyle = '#07060a';
      [[18, 0.55, 260], [70, 0.3, 320], [150, 0.16, 380]].forEach(([m, al, r]) => {
        ctx.globalAlpha = al * a;
        ctx.beginPath();
        ctx.rect(0, 0, ST.W, ST.H);
        ctx.roundRect(m * 1.4, m, ST.W - m * 2.8, ST.H - m * 2, r);
        ctx.fill('evenodd');
      });
    }
    ctx.restore();
  };
  // foreground silhouette (over-the-shoulder / framing): a flat near-black shape with a thin rim on the key side.
  // ST.fg takes frame pixels (screen space); ST.fgSilhouette draws in the current space.
  ST.fgSilhouette = (ctx, pts, seed) => {
    ST.blob(ctx, pts, '#0f0c0a', { lw: 0, seed, light: [ST.LIGHT.rim, Math.sign(ST.LIGHT.x || -1) * 6, -2] });
  };
  ST.fg = (ctx, pts, seed) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const keep = ST.LW;
    ST.LW = 1.4;
    ST.fgSilhouette(ctx, pts, seed);
    ST.LW = keep;
    ctx.restore();
  };

  // ---- whole-figure key + rim pass (film 16's ST.lit): draw(c) renders the figure into a buffer; a hard shadow
  // crescent (silhouette minus itself shifted toward the key) and a rim band just inside the ink are laid over it.
  const bufs = [];
  function buf(i, w, h) {
    if (!bufs[i]) bufs[i] = document.createElement('canvas');
    const b = bufs[i];
    if (b.width !== w || b.height !== h) { b.width = w; b.height = h; }
    const c = b.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    return [b, c];
  }
  function cut(A, w, h, dx, dy, col, slot) {
    const [B, b] = buf(slot, w, h);
    b.drawImage(A, 0, 0);
    b.globalCompositeOperation = 'destination-out';
    b.drawImage(A, dx, dy);
    b.globalCompositeOperation = 'source-in';
    b.fillStyle = col;
    b.fillRect(0, 0, w, h);
    return B;
  }
  // L: { d: shadow depth px, rim: rim width px, ink: contour width px, shade, rimCol }
  ST.litFigure = (ctx, L, draw) => {
    const w = ctx.canvas.width, h = ctx.canvas.height, [A, a] = buf(0, w, h);
    a.setTransform(ctx.getTransform());
    draw(a);
    const kx = ST.LIGHT.x, ky = ST.LIGHT.y, n = Math.hypot(kx, ky) || 1, d = L.d || 16, r = L.rim || 5, ink = L.ink || 10;
    const S = cut(A, w, h, (kx / n) * d, (ky / n) * d, L.shade || 'rgba(24,16,30,0.42)', 1);
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.drawImage(S, 0, 0);
    if (r > 0) {
      const outer = cut(A, w, h, (-kx / n) * (ink + r), (-ky / n) * (ink + r), 'rgba(0,0,0,1)', 2);
      const inner = cut(A, w, h, (-kx / n) * ink, (-ky / n) * ink, 'rgba(0,0,0,1)', 3);
      const [B, b] = buf(4, w, h);
      b.drawImage(outer, 0, 0);
      b.globalCompositeOperation = 'destination-out';
      b.drawImage(inner, 0, 0);
      b.globalCompositeOperation = 'source-in';
      b.fillStyle = L.rimCol || 'rgba(255,214,140,0.55)';
      b.fillRect(0, 0, w, h);
      a.drawImage(B, 0, 0);
    }
    const keep = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(A, 0, 0);
    ctx.setTransform(keep);
  };
  // darkness: one flat translucent shape over the frame except a stepped hole around the warm source (style C)
  ST.gloom = (ctx, x0, y0, w, h, cx, cy, r, col, alpha) => {
    ctx.fillStyle = col;
    [1, 0.72, 0.5].forEach((k, i) => {
      ctx.globalAlpha = alpha * (i === 0 ? 1 : 0.55);
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.ellipse(cx, cy, r / k, (r * 0.8) / k, 0, 0, TAU, true);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };
})();
