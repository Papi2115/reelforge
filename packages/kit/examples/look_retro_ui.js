// Look retro-ui (PLAN.md#12.2): one setup per template, picked by SETUP; the render tests swap
// the SETUP line. Templates are pixel-art panels in front of kit.env.retroDesktop; the camera
// sits at fitDistance(2) (one UI pixel = two frame pixels). Follows the scene contract: no
// imports, update() poses everything absolutely from t.
export const meta = { id: 'lru', title: 'Look retro-ui', treatment: 'ui-mockup' };

// Setup under test; the render tests swap this line.
const SETUP = 'window';

/** Frontal camera at one UI pixel = `px` frame pixels from `hero`, looking at (x, y). */
function frontal(ctx, hero, x, y, px = 2) {
  const d = hero.fitDistance(px) + hero.position.z;
  return { position: [x, y, d], target: [x, y, 0], fov: 50 };
}

const SETUPS = {
  window: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ icons: ['MY PC', 'DOOM.EXE', 'MAIL', 'TRASH'] });
      const dialog = kit.props.retroWindow({
        title: 'CALC.EXE',
        content: 'dialog',
        icon: 'error',
        lines: ['CALC.EXE HAS PERFORMED AN ILLEGAL OPERATION AND WILL BE SHUT DOWN.'],
        buttons: ['OK', 'DETAILS'],
        size: [212, 92],
        stack: 1,
        accent: 'pink',
        open: 0.3,
        click: 2.4,
        close: 3.2,
        marks: [{ text: 'ILLEGAL', at: 1.2 }],
      });
      dialog.position.set(0.3, -0.1, 0.02);
      return { objects: [desktop, dialog], hero: dialog, look: [0.2, 0] };
    },
  },
  progress: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ wallpaper: 'checker', accent: 'teal' });
      const copy = kit.props.retroWindow({
        title: 'COPYING...',
        content: 'progress',
        lines: ['COPYING 1,024 FILES', 'FROM A:\\ TO C:\\GAMES\\DOOM'],
        size: [200, 84],
        accent: 'teal',
        fillStart: 0.4,
        fillEnd: 3.6,
      });
      copy.position.set(0, 0, 0.02);
      const files = kit.props.retroWindow({
        title: 'C:\\GAMES',
        content: 'icons',
        items: ['DOOM.EXE', 'DOOM.WAD', 'SETUP', 'README.TXT', 'DISK 1'],
        size: [150, 100],
        menu: ['FILE', 'VIEW'],
        accent: 'teal',
      });
      files.position.set(-1.9, 0.7, 0.01);
      return { objects: [desktop, files, copy], hero: copy, look: [-0.75, 0.25] };
    },
  },
  terminal: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ wallpaper: 'checker', accent: 'green' });
      const terminal = kit.props.retroTerminal({
        title: 'MS-DOS PROMPT',
        header: ['REELFORGE DOS V2.0', '(C) 1998 BYTE WORKS'],
        lines: [
          { text: 'CD GAMES', input: true },
          { text: 'DOOM -CALC', input: true },
          'LOADING DOOM.WAD... OK',
          { text: 'CALC.SYS NOT FOUND', tone: 'alert' },
          { text: 'PATCHING TI-83 ROM', tone: 'dim' },
          { text: 'READY.', tone: 'ok' },
          { text: 'RUN', input: true },
        ],
        size: [260, 150],
        accent: 'green',
        marks: [{ text: 'NOT FOUND', at: 3.4 }],
      });
      terminal.position.set(0, -0.1, 0.02);
      return { objects: [desktop, terminal], hero: terminal, look: [0, -0.1] };
    },
  },
  browser: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ accent: 'orange' });
      const browser = kit.props.retroBrowser({
        url: 'WWW.BYTE-TIMES.COM/DOOM',
        headline: 'TEEN PORTS DOOM TO A CALCULATOR',
        byline: 'BY K. RAMIREZ - MAY 4, 1998',
        caption: 'THE TI-83 RUNNING E1M1',
        visitors: 451,
        size: [300, 168],
        accent: 'orange',
        typeAt: 0.2,
        loadAt: 1.9,
        marks: [{ text: 'CALCULATOR', at: 3.3 }],
      });
      browser.position.set(0, -0.12, 0.02);
      return { objects: [desktop, browser], hero: browser, look: [0, -0.12] };
    },
  },
  newspaper: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ wallpaper: 'plain', icons: [], size: [400, 360] });
      const paper = kit.props.retroDocument({
        variant: 'newspaper',
        title: 'THE DAILY BYTE',
        headline: 'CALCULATOR RUNS DOOM',
        caption: 'CROWDS QUEUE AT THE MALL',
        stamp: { text: 'EXCLUSIVE', at: 1.6 },
        marks: [{ text: 'DOOM', at: 0.8 }],
      });
      paper.position.set(0, -0.6, 0.02);
      return { objects: [desktop, paper], hero: paper, look: [0, 0.6], pan: [0.6, -0.4] };
    },
  },
  dossier: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ wallpaper: 'checker', icons: [], accent: 'orange' });
      const file = kit.props.retroDocument({
        variant: 'dossier',
        title: 'CASE FILE 0451',
        fields: [
          { label: 'NAME', value: 'J. DOE' },
          { label: 'ALIAS', value: 'THE CALCULATOR' },
          { label: 'LAST SEEN', value: 'MALL, OHIO', redactAt: 2.2 },
          { label: 'STATUS', value: 'AT LARGE' },
        ],
        stamp: { text: 'TOP SECRET', at: 1.2 },
      });
      file.position.set(0, -0.04, 0.02);
      return { objects: [desktop, file], hero: file, look: [0, -0.04] };
    },
  },
  crt: {
    build(kit) {
      const room = kit.env.retroDesktop({ variant: 'desk' });
      const terminal = kit.props.retroTerminal({
        frame: 'none',
        prompt: '',
        header: ['**** COMMODORE 64 ****', 'READY.'],
        lines: [
          { text: 'LOAD "DOOM",8,1', input: true, at: 1 },
          'SEARCHING FOR DOOM',
          'LOADING',
          { text: 'RUN', input: true },
        ],
        size: [140, 105],
      });
      const crt = kit.props.retroCrt({ tint: 'green', powerOn: 0.2, size: [140, 105] });
      crt.show(terminal);
      crt.on(room, { at: 'desk' });
      return { objects: [room, terminal, crt], hero: crt, crane: true };
    },
  },
  composite: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ accent: 'violet' });
      const browser = kit.props.retroBrowser({
        url: 'WWW.BYTE-TIMES.COM',
        headline: 'CALCULATOR RUNS DOOM',
        size: [210, 150],
        photo: 'crowd',
        marks: [{ text: 'DOOM', at: 1.2 }],
      });
      browser.position.set(-0.95, 0.05, 0.02);
      const dialog = kit.props.retroWindow({
        title: 'NETSURF',
        content: 'dialog',
        icon: 'question',
        lines: ['DOWNLOAD DOOM.ZIP?', '1.4 MB - 9 MIN'],
        buttons: ['YES', 'NO'],
        size: [150, 76],
        open: 0.6,
        click: 2.6,
      });
      dialog.position.set(1.6, -0.7, 0.04);
      return {
        objects: [desktop, browser, dialog],
        hero: browser,
        look: [0, -0.1],
        notes: { browser, dialog },
      };
    },
  },
  // Inverse-video marks through a green tube: the marked glyphs stay dark (no glow halo).
  crtMark: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ wallpaper: 'plain', icons: [] });
      const terminal = kit.props.retroTerminal({
        frame: 'none',
        prompt: '>',
        header: ['AGC  PROG 00'],
        lines: [
          { text: 'VERB 16', input: true, at: 0.3 },
          ' WHAT TO DO',
          { text: 'NOUN 68', input: true },
        ],
        size: [120, 68],
        marks: [
          { text: 'VERB', at: 1.4 },
          { text: 'NOUN', at: 2.6 },
        ],
      });
      const crt = kit.props.retroCrt({
        size: [120, 68],
        casing: 'none',
        tint: 'green',
        flicker: 0,
      });
      crt.show(terminal);
      crt.position.set(0, 0, 0.02);
      return { objects: [desktop, terminal, crt], hero: crt, look: [0, 0], px: 2.6 };
    },
  },
  // A memo heading longer than the page: it drops to scale 1 and is cut, never off the paper.
  memo: {
    build(kit) {
      const desktop = kit.env.retroDesktop({ wallpaper: 'checker', icons: [], accent: 'green' });
      const memo = kit.props.retroDocument({
        variant: 'memo',
        title: 'MISSION RULES AND ALARM CODES',
        headline: 'PROGRAM ALARMS',
        fields: [{ label: 'FROM', value: 'J. GARMAN' }],
        body: '1201 EXEC OVERFLOW - GO\n1202 EXEC OVERFLOW - GO',
        marks: [{ text: '1202 EXEC OVERFLOW - GO', at: 1.2 }],
      });
      memo.position.set(0, 0, 0.02);
      return { objects: [desktop, memo], hero: memo, look: [0, 0], px: 1.5 };
    },
  },
};

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  const state = SETUPS[SETUP].build(kit);
  scene.add(...state.objects.filter((object) => !object.parent));
  return state;
}

export function update(t, state, ctx) {
  state.objects.forEach((object) => object.update(t));
  if (state.crane) {
    const target = state.hero.anchor('screen').add(state.hero.position);
    const d = state.hero.fitDistance(2) * 1.15;
    ctx.camera.crane({
      target: [target.x, target.y, target.z],
      dist: d,
      height: [0.9, 0.2],
      degrees: -8,
    })(t);
    return;
  }
  const [x, y] = state.look;
  const pose = frontal(ctx, state.hero, x, y, state.px);
  if (state.pan) {
    const [y0, y1] = state.pan;
    ctx.camera.dolly({
      start: [x, y0, pose.position[2]],
      end: [x, y1, pose.position[2]],
      target: [x, y0, 0],
      targetEnd: [x, y1, 0],
      fov: 50,
    })(t);
  } else {
    ctx.camera.set(pose);
  }
  if (state.notes) {
    ctx.annotate.ring({
      id: 'yes',
      target: { object: state.notes.dialog, anchor: 'button' },
      at: 2.2,
      until: 4.5,
    });
  }
}
