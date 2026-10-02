/**
 * IPC handlers of the Sound panel (PLAN.md#8.2), merged into `registerIpc` by main.ts, and the
 * options of its native multi-file picker (Electron's OpenDialogOptions shape).
 */
import { SOUND_FILE_EXTENSIONS, type SoundKind } from '../../shared/sound-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { MixPreviewService } from './mix-preview-service.js';
import type { SoundService } from './sound-service.js';

export type SoundHandlers = Pick<
  InvokeHandlers,
  'soundState' | 'soundImport' | 'soundPreview' | 'soundSetMix' | 'soundRun' | 'mixPreview'
>;

const KIND_TITLES: Readonly<Record<SoundKind, string>> = {
  sfx: 'Import sound effects',
  ambience: 'Import ambience loops',
  music: 'Import music',
};

export function soundPickerOptions(kind: SoundKind): {
  title: string;
  buttonLabel: string;
  filters: { name: string; extensions: string[] }[];
  properties: ['openFile', 'multiSelections'];
} {
  return {
    title: KIND_TITLES[kind],
    buttonLabel: 'Import',
    filters: [{ name: 'Audio', extensions: [...SOUND_FILE_EXTENSIONS] }],
    properties: ['openFile', 'multiSelections'],
  };
}

export function soundHandlers(sound: SoundService, preview: MixPreviewService): SoundHandlers {
  return {
    soundState: () => sound.state(),
    soundImport: (request) => sound.importFiles(request.kind),
    soundPreview: (request) => sound.preview(request.sound),
    soundSetMix: (request) => sound.setMix(request),
    soundRun: (request) => sound.run(request.action),
    mixPreview: (request) => preview.render(request.t),
  };
}
