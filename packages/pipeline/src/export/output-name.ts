/** Video title -> a file name that is valid on Windows (and everywhere else). */

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const MAX_NAME_LENGTH = 120;
export const FALLBACK_OUTPUT_NAME = 'video';

export function safeOutputName(title: string): string {
  const cleaned = title
    .normalize('NFC')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  const graphemes = [...new Intl.Segmenter().segment(cleaned)].map((part) => part.segment);
  const clipped = graphemes
    .slice(0, MAX_NAME_LENGTH)
    .join('')
    .trim()
    .replace(/[. ]+$/, '');
  // Windows reserves device names even with extensions ("con.mp4", "nul.part.mp4").
  const stem = clipped.split('.')[0]?.trim() ?? '';
  if (clipped === '' || WINDOWS_RESERVED.test(stem)) return FALLBACK_OUTPUT_NAME;
  return clipped;
}
