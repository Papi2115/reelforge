/**
 * `kit.props.redactedBlock` (look retro-ui, PLAN.md#12.26 open loops): a classified slip — paper
 * or a screen — whose answer sits under a black redaction bar with hatched stripes until the
 * closing phrase, then the bar is wiped off left to right in an ordered dither (reveal.ts). The
 * painter is a pure function of t.
 */
import { z } from 'zod';
import { defineProp } from '../../registry.js';
import { revealProgress, wipeCovered } from '../../reveal.js';
import {
  drawTextCentered,
  fillRect,
  fitHeading,
  rect,
  setPixel,
  strokeRect,
  textHeight,
  textWidth,
  type PixelCanvas,
} from './canvas.js';
import { dropShadow } from './chrome.js';
import { C } from './colors.js';
import { pixelParam, sizeParam } from './marks.js';
import { createSurface, type AnchorMap, type RetroPainter } from './surface.js';

export const redactedBlockParams = z.object({
  text: z
    .string()
    .min(1)
    .max(28)
    .describe('The answer under the bar (revealed on the closing phrase)'),
  label: z.string().max(24).default('CLASSIFIED').describe('Heading above the answer'),
  caption: z.string().max(36).default('').describe('Small line under the answer'),
  surface: z
    .enum(['paper', 'screen'])
    .default('paper')
    .describe('paper (cream slip, dark ink) or screen (dark panel, light text)'),
  revealAt: z
    .number()
    .default(1)
    .describe(
      "Local time the bar starts to lift: the closing phrase, e.g. ctx.anchor('the answer').t",
    ),
  duration: z.number().min(0).max(3).default(0.5).describe('Seconds the wipe takes'),
  size: sizeParam(200, 90, [320, 180]),
  pixel: pixelParam,
});

export type RedactedBlockParams = z.output<typeof redactedBlockParams>;

const SHADOW = 4;
const PAD = 5;
const ANSWER = { scale: 2, bold: true } as const;

interface Scheme {
  readonly back: number;
  readonly border: number;
  readonly ink: number;
  readonly dim: number;
}

const SCHEMES: Readonly<Record<RedactedBlockParams['surface'], Scheme>> = {
  paper: { back: C.cream, border: C.tan, ink: C.black, dim: C.rust },
  screen: { back: C.navy, border: C.teal, ink: C.cream, dim: C.cyan },
};

/** Bar ink: black with hatch stripes, so it reads as "redacted" even on a dark screen. */
function barColor(x: number, y: number, surface: RedactedBlockParams['surface']): number {
  if ((x + y) % 6 === 0) return surface === 'screen' ? C.darkGrey : C.indigo;
  return C.black;
}

function paintBar(
  canvas: PixelCanvas,
  bar: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  progress: number,
  surface: RedactedBlockParams['surface'],
): void {
  for (let y = bar.y; y < bar.y + bar.h; y += 1) {
    for (let x = bar.x; x < bar.x + bar.w; x += 1) {
      const u = (x - bar.x + 0.5) / bar.w;
      if (wipeCovered(x, y, u, progress)) setPixel(canvas, x, y, barColor(x, y, surface));
    }
  }
}

export function redactedPainter(params: RedactedBlockParams): RetroPainter {
  const [width, height] = params.size;
  const scheme = SCHEMES[params.surface];
  return {
    width: width + SHADOW,
    height: height + SHADOW,
    paint(canvas, t): AnchorMap {
      const frame = rect(0, 0, canvas.width - SHADOW, canvas.height - SHADOW);
      dropShadow(canvas, frame, SHADOW);
      fillRect(canvas, frame, scheme.back);
      strokeRect(canvas, frame, scheme.border);
      const cx = frame.x + frame.w / 2;
      const labelY = frame.y + PAD + 1;
      if (params.label.length > 0) {
        drawTextCentered(canvas, params.label, cx, labelY, scheme.dim, { font: 'small' });
        fillRect(canvas, rect(frame.x + PAD, labelY + 8, frame.w - 2 * PAD, 1), scheme.border);
      }
      const answer = fitHeading(params.text, frame.w - 2 * PAD, ANSWER);
      const answerH = textHeight(answer.style);
      const answerY = Math.round(frame.y + (frame.h - answerH) / 2);
      drawTextCentered(canvas, answer.text, cx, answerY, scheme.ink, answer.style);
      if (params.caption.length > 0) {
        drawTextCentered(canvas, params.caption, cx, frame.y + frame.h - PAD - 5, scheme.dim, {
          font: 'small',
        });
      }
      const answerW = Math.min(frame.w - 2 * PAD, textWidth(answer.text, answer.style) + 8);
      const bar = {
        x: Math.round(cx - answerW / 2),
        y: answerY - 4,
        w: Math.round(answerW),
        h: answerH + 8,
      };
      paintBar(canvas, bar, revealProgress(t, params.revealAt, params.duration), params.surface);
      const center: [number, number] = [bar.x + bar.w / 2, bar.y + bar.h / 2];
      return {
        block: center,
        answer: center,
        label: [cx, labelY + 3],
        caption: [cx, frame.y + frame.h - PAD - 3],
      };
    },
  };
}

export const redactedBlock = defineProp({
  name: 'redactedBlock',
  description:
    'Open-loop veil (look retro-ui): a CLASSIFIED slip on paper or a screen whose answer hides under a hatched black bar until the closing phrase, then the bar wipes off in a pixel dither. update(t) every frame; revealAt on the closing phrase.',
  params: redactedBlockParams,
  anchors: {
    block: 'the redaction bar (and the answer under it)',
    answer: 'the answer text',
    label: 'the heading',
    caption: 'the small line under the answer',
  },
  methods: {
    'update(t)': 'repaints for local time t (the bar lifts from revealAt); call every frame',
    'fitDistance(px = 2, fov = 50)': 'camera distance for one UI pixel = px frame pixels',
  },
  build(params, tools) {
    return createSurface(tools, {
      kitType: 'redactedBlock',
      painter: redactedPainter(params),
      pixel: params.pixel,
    });
  },
});
