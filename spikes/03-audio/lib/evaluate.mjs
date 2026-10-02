// Timing-accuracy metrics of aligned words vs. SAPI ground truth.

/**
 * Re-times ASR words with DTW token times shifted earlier by leadS:
 * t = t_dtw - leadS, tEnd = next word's t (last word: t + its segment length, max 1 s).
 */
export function dtwWords(words, leadS = 0) {
  const starts = words.map((w) => (w.tDtw === null ? null : Math.max(0, w.tDtw - leadS)));
  return words.map((word, k) => {
    const t = starts[k] ?? word.t;
    const next = starts.slice(k + 1).find((s) => s !== null);
    const tEnd = Math.max(t + 0.05, next ?? t + Math.min(1, word.tEnd - word.t));
    return { ...word, t, tEnd };
  });
}

function summarize(errors) {
  if (errors.length === 0) return null;
  const abs = errors.map(Math.abs).sort((a, b) => a - b);
  const pick = (q) => abs[Math.min(abs.length - 1, Math.floor(q * abs.length))];
  const ms = (seconds) => Math.round(seconds * 1000);
  return {
    n: errors.length,
    maeMs: ms(abs.reduce((s, e) => s + e, 0) / abs.length),
    medianMs: ms(pick(0.5)),
    p95Ms: ms(pick(0.95)),
    biasMs: ms(errors.reduce((s, e) => s + e, 0) / errors.length),
    within100: Math.round((abs.filter((e) => e <= 0.1).length / abs.length) * 1000) / 1000,
    within150: Math.round((abs.filter((e) => e <= 0.15).length / abs.length) * 1000) / 1000,
  };
}

/** Start/end errors (seconds -> ms stats) over script words that have a ground-truth time. */
export function timingErrors(aligned, truth) {
  const starts = [];
  const ends = [];
  aligned.forEach((word, k) => {
    const gt = truth[k];
    if (gt.t !== null) starts.push(word.t - gt.t);
    if (gt.tEnd !== null) ends.push(word.tEnd - gt.tEnd);
  });
  return { start: summarize(starts), end: summarize(ends) };
}
