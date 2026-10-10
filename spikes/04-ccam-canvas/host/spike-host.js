// Spike 14.0 only: helpers injected into the harness host page (not the sandboxed frame) as
// `window.__spike`. They drive `window.__reelforge`, hash frames in the page (no 8 MB round trips to
// Node) and paint the same test frame on a host-page CPU canvas as the reference for "pixels arrive
// unchanged".
/* global window, document */
import { paintTestFrame } from '../frame/paint.js';

const W = 1920;
const H = 1080;
const harness = () => window.__reelforge;

async function digest(bytes) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

let reference;
function referenceContext() {
  if (reference === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    reference = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  }
  return reference;
}

// Mirrors createInkStage().render (packages/kit/src/fx/ink-stage.ts).
function paintReference(t) {
  const g = referenceContext();
  g.reset();
  g.fillStyle = '#16120e';
  g.fillRect(0, 0, W, H);
  g.save();
  paintTestFrame(g, t, W, H);
  g.restore();
}

window.__spike = {
  async load(manifest) {
    const info = await harness().load(manifest);
    return { renderer: info.gpu.renderer, width: info.width, height: info.height };
  },
  async hashes(times) {
    const out = [];
    for (const t of times) {
      await harness().seek(t);
      out.push(await digest(harness().frame()));
    }
    return out;
  },
  /** Seeks t and compares the engine frame with the host-page reference paint. */
  async compare(t) {
    await harness().seek(t);
    const frame = harness().frame();
    paintReference(t);
    const ref = referenceContext().getImageData(0, 0, W, H).data;
    let channels = 0;
    let max = 0;
    for (let i = 0; i < frame.length; i++) {
      const d = Math.abs(frame[i] - ref[i]);
      if (d > 0) channels++;
      if (d > max) max = d;
    }
    return {
      t,
      bytes: frame.length,
      channels,
      max,
      frame: await digest(frame),
      reference: await digest(ref),
    };
  },
  /** Per-seek wall time (seek + frame transfer) in ms, after two warm-up seeks. */
  async seekTimes(times) {
    await harness().seek(times[0]);
    await harness().seek(times[times.length - 1]);
    const out = [];
    for (const t of times) {
      const start = performance.now();
      await harness().seek(t);
      harness().frame();
      out.push(performance.now() - start);
    }
    return out;
  },
  /** Paint alone and paint + getImageData on the host-page CPU canvas, ms per frame. */
  paintTimes(times) {
    paintReference(times[0]);
    const paint = [];
    const read = [];
    for (const t of times) {
      const start = performance.now();
      paintReference(t);
      const painted = performance.now();
      referenceContext().getImageData(0, 0, W, H);
      paint.push(painted - start);
      read.push(performance.now() - painted);
    }
    return { paint, read };
  },
  /** Seeks every time without measuring (memory soak). */
  async soak(times) {
    for (const t of times) await harness().seek(t);
  },
  /** The frame at t as base64 RGBA (PNG checks). */
  async frameBase64(t) {
    await harness().seek(t);
    const bytes = harness().frame();
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return window.btoa(binary);
  },
};
